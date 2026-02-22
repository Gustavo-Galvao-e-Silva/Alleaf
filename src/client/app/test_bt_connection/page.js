"use client";
import { useState, useRef, useEffect } from "react";

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const SEND_INTERVAL_MS = 45_000;
const CALIBRATION_BEATS = 5;
const BACKEND_URL = "/api/heart-data"; // update to your actual endpoint

export default function BleConnect() {
  const [status, setStatus] = useState("Disconnected ❌");
  const [sensorState, setSensorState] = useState("NO_FINGER"); // NO_FINGER | CALIBRATING | TRACKING
  const [progress, setProgress] = useState(0); // beats collected out of CALIBRATION_BEATS
  const [rxCharacteristic, setRxCharacteristic] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [rrCount, setRrCount] = useState(0);

  // All signal processing state lives here — never triggers re-renders
  const dsp = useRef({
    ema: 0,
    smoothed: 0,
    lastSignal: 0,
    lastBeatTime: 0,
    avgIBI: 0,
    signalMax: 0,
    isRising: false,
    fingerPresent: false,
    isCalibrating: false,
    // Collected RR intervals (beat-to-beat in ms) — sent to backend every 45s
    rrBuffer: [],
  });

  // --- 45-second send interval ---
  useEffect(() => {
    const interval = setInterval(() => {
      const buffer = dsp.current.rrBuffer;
      if (buffer.length === 0) return;

      const payload = {
        rr_intervals_ms: [...buffer],
        collected_at: new Date().toISOString(),
      };
      dsp.current.rrBuffer = []; // clear buffer after sending
      setRrCount(0);

      console.log("Sending to backend:", payload);
      fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Backend response:", data);
          setLastSentAt(new Date().toLocaleTimeString());
        })
        .catch((err) => console.error("Failed to send heart data:", err));
    }, SEND_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // --- BLE data handler ---
  const handleData = (event) => {
    const rawString = new TextDecoder().decode(event.target.value);
    if (rawString === "NO_SENSOR") return;

    const irValue = parseInt(rawString, 10);
    if (isNaN(irValue)) return;

    const state = dsp.current;
    const now = performance.now();

    // 1. Finger proximity check — IR below threshold means no finger
    if (irValue < 50000) {
      if (state.fingerPresent) {
        state.fingerPresent = false;
        state.isCalibrating = false;
        state.ema = 0;
        state.smoothed = 0;
        state.lastBeatTime = 0;
        state.avgIBI = 0;
        state.signalMax = 0;
        state.rrBuffer = [];
        setSensorState("NO_FINGER");
        setProgress(0);
        setRrCount(0);
      }
      return;
    }

    if (!state.fingerPresent) {
      state.fingerPresent = true;
      state.isCalibrating = true;
      setSensorState("CALIBRATING");
      setProgress(0);
    }

    // 2. Dual-stage filtering: DC removal + smoothing
    if (state.ema === 0) state.ema = irValue;
    state.ema = state.ema * 0.95 + irValue * 0.05;
    const dcFiltered = irValue - state.ema;
    state.smoothed = state.smoothed * 0.8 + dcFiltered * 0.2;
    const signal = state.smoothed;
    state.signalMax *= 0.998;

    // 3. Peak detection (rising edge → falling edge = heartbeat)
    if (signal > state.lastSignal) {
      state.isRising = true;
    } else if (state.isRising && signal < state.lastSignal) {
      state.isRising = false;

      const dynamicThreshold = state.signalMax * 0.6;
      if (signal > dynamicThreshold && signal > 20) {
        const timeSinceLastBeat = now - state.lastBeatTime;

        if (timeSinceLastBeat > 400 && timeSinceLastBeat < 2000) {
          // Artifact rejection: discard if >30% deviation from running average
          const isArtifact =
            state.avgIBI > 0 &&
            Math.abs(timeSinceLastBeat - state.avgIBI) > state.avgIBI * 0.3;

          if (!isArtifact) {
            state.signalMax = signal;
            state.lastBeatTime = now;

            // Update running average IBI
            state.avgIBI =
              state.avgIBI === 0
                ? timeSinceLastBeat
                : state.avgIBI * 0.8 + timeSinceLastBeat * 0.2;

            // Collect the RR interval into the send buffer
            state.rrBuffer.push(Math.round(timeSinceLastBeat));
            setRrCount(state.rrBuffer.length);

            // Calibration: wait for CALIBRATION_BEATS confirmed beats
            if (state.isCalibrating) {
              const beatsFound = Math.min(
                state.rrBuffer.length,
                CALIBRATION_BEATS,
              );
              setProgress(beatsFound);
              if (beatsFound >= CALIBRATION_BEATS) {
                state.isCalibrating = false;
                setSensorState("TRACKING");
              }
            }
          }
        } else if (timeSinceLastBeat >= 2000) {
          state.lastBeatTime = now;
        }
      }
    }
    state.lastSignal = signal;
  };

  // --- BLE connection ---
  const connectToDevice = async () => {
    try {
      setStatus("Searching for Wearable...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "XIAO_Biofeedback" }],
        optionalServices: [SERVICE_UUID],
      });

      setStatus("Connecting...");
      const server = await device.gatt.connect();

      device.addEventListener("gattserverdisconnected", () => {
        setStatus("Disconnected ❌");
        setRxCharacteristic(null);
        setSensorState("NO_FINGER");
        setProgress(0);
        dsp.current.fingerPresent = false;
        dsp.current.rrBuffer = [];
        setRrCount(0);
      });

      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic =
        await service.getCharacteristic(CHARACTERISTIC_UUID);
      setRxCharacteristic(characteristic);
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleData);
      setStatus("Connected! 🚀");
    } catch (error) {
      console.error("Bluetooth Error:", error);
      setStatus("Connection failed.");
    }
  };

  const triggerBilateralStimulation = async () => {
    if (!rxCharacteristic) return;
    try {
      await rxCharacteristic.writeValue(new Uint8Array([1]));
    } catch (error) {
      console.error("Failed to send trigger:", error);
    }
  };

  // --- Status bar ---
  const renderStatusBar = () => {
    if (sensorState === "NO_FINGER") {
      return (
        <div style={styles.statusRed}>
          ⚠️ Please secure sensor firmly to skin
        </div>
      );
    }
    if (sensorState === "CALIBRATING") {
      const pct = (progress / CALIBRATION_BEATS) * 100;
      return (
        <div
          style={{
            ...styles.statusBlue,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ ...styles.progressFill, width: `${pct}%` }} />
          <span style={{ position: "relative", zIndex: 1 }}>
            ⏱️ Detecting beats... {progress}/{CALIBRATION_BEATS}
          </span>
        </div>
      );
    }
    return <div style={styles.statusGreen}>✅ Collecting heart rate data</div>;
  };

  return (
    <div style={styles.page}>
      <h2>Wearable Status: {status}</h2>

      <div style={{ margin: "20px 0" }}>{renderStatusBar()}</div>

      <div style={styles.infoBox}>
        <div style={styles.infoRow}>
          <span style={styles.label}>RR Intervals Buffered</span>
          <span style={styles.value}>
            {sensorState === "TRACKING" ? rrCount : "--"}
          </span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>Send Interval</span>
          <span style={styles.value}>45s</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>Last Sent</span>
          <span style={styles.value}>{lastSentAt ?? "Not yet"}</span>
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button onClick={connectToDevice} style={styles.btnDark}>
          Connect Wearable
        </button>
        <button
          onClick={triggerBilateralStimulation}
          disabled={!rxCharacteristic}
          style={rxCharacteristic ? styles.btnGreen : styles.btnDisabled}
        >
          Test Soothing Motors
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "40px",
    fontFamily: "sans-serif",
    maxWidth: "500px",
    margin: "0 auto",
    textAlign: "center",
  },
  statusRed: {
    padding: "12px",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    borderRadius: "8px",
    fontWeight: "bold",
  },
  statusBlue: {
    padding: "12px",
    backgroundColor: "#e0f2fe",
    color: "#075985",
    borderRadius: "8px",
    fontWeight: "bold",
  },
  statusGreen: {
    padding: "12px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: "8px",
    fontWeight: "bold",
  },
  progressFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "#bae6fd",
    transition: "width 0.2s ease",
    zIndex: 0,
  },
  infoBox: {
    backgroundColor: "#f4f4f5",
    borderRadius: "12px",
    padding: "24px 30px",
    margin: "20px 0",
    boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "14px",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  value: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#18181b",
  },
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginTop: "30px",
  },
  btnDark: {
    padding: "14px 28px",
    fontSize: "16px",
    backgroundColor: "#18181b",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnGreen: {
    padding: "14px 28px",
    fontSize: "16px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnDisabled: {
    padding: "14px 28px",
    fontSize: "16px",
    backgroundColor: "#d1d5db",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "not-allowed",
    fontWeight: "bold",
  },
};
