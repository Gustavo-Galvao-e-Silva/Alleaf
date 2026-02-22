"use client";
import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import styles from "./page.module.css";

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CALIBRATION_DURATION_MS = 45_000;
const CALIBRATION_BEATS = 5; // beats needed before the 45s timer starts

// Phase: IDLE | CONNECTING | CONNECTED | WAITING_FINGER | CALIBRATING | DONE | ERROR
export default function HardwareCalibrationPage() {
  const { user } = useUser();

  const [phase, setPhase] = useState("IDLE");
  const [statusMsg, setStatusMsg] = useState("");
  const [sensorState, setSensorState] = useState("NO_FINGER"); // NO_FINGER | CALIBRATING | TRACKING
  const [beatProgress, setBeatProgress] = useState(0); // initial beat detection progress
  const [timeLeft, setTimeLeft] = useState(CALIBRATION_DURATION_MS / 1000);
  const [rxCharacteristic, setRxCharacteristic] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const dsp = useRef({
    ema: 0,
    smoothed: 0,
    lastSignal: 0,
    lastBeatTime: 0,
    avgIBI: 0,
    signalMax: 0,
    isRising: false,
    fingerPresent: false,
    isInitialCalibrating: true, // waiting for CALIBRATION_BEATS before starting timer
    rrBuffer: [],
  });

  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const calibrationStartedRef = useRef(false);

  // --- Start the 45-second calibration timer ---
  const startCalibrationTimer = () => {
    if (calibrationStartedRef.current) return;
    calibrationStartedRef.current = true;
    setPhase("CALIBRATING");
    setTimeLeft(CALIBRATION_DURATION_MS / 1000);

    let secondsLeft = CALIBRATION_DURATION_MS / 1000;
    countdownRef.current = setInterval(() => {
      secondsLeft -= 1;
      setTimeLeft(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(countdownRef.current);
      }
    }, 1000);

    timerRef.current = setTimeout(() => {
      clearInterval(countdownRef.current);
      finishCalibration();
    }, CALIBRATION_DURATION_MS);
  };

  const finishCalibration = async () => {
    const buffer = [...dsp.current.rrBuffer];
    setSaving(true);
    setPhase("DONE");

    try {
      const res = await fetch("/api/saveBaselineRR", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baselineRR: buffer }),
      });
      if (!res.ok) throw new Error("Failed to save baseline");

      // Mark calibration complete in Clerk metadata
      const metaRes = await fetch("/api/calibration-complete", {
        method: "POST",
      });
      if (!metaRes.ok) throw new Error("Failed to update metadata");

      await user.reload();
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "Something went wrong saving your calibration. Please try again.",
      );
      setPhase("ERROR");
    } finally {
      setSaving(false);
    }
  };

  // --- BLE data handler ---
  const handleData = (event) => {
    const rawString = new TextDecoder().decode(event.target.value);
    if (rawString === "NO_SENSOR") return;

    const irValue = parseInt(rawString, 10);
    if (isNaN(irValue)) return;

    const state = dsp.current;
    const now = performance.now();

    // Finger proximity check
    if (irValue < 50000) {
      if (state.fingerPresent) {
        state.fingerPresent = false;
        state.isInitialCalibrating = true;
        state.ema = 0;
        state.smoothed = 0;
        state.lastBeatTime = 0;
        state.avgIBI = 0;
        state.signalMax = 0;
        // Only reset buffer and timer if calibration hasn't started yet
        if (!calibrationStartedRef.current) {
          state.rrBuffer = [];
          setBeatProgress(0);
        }
        setSensorState("NO_FINGER");
        if (!calibrationStartedRef.current) {
          setPhase("WAITING_FINGER");
        }
      }
      return;
    }

    if (!state.fingerPresent) {
      state.fingerPresent = true;
      state.isInitialCalibrating = true;
      setSensorState("CALIBRATING");
      if (!calibrationStartedRef.current) {
        setPhase("WAITING_FINGER");
      }
    }

    // Dual-stage filtering: DC removal + smoothing
    if (state.ema === 0) state.ema = irValue;
    state.ema = state.ema * 0.95 + irValue * 0.05;
    const dcFiltered = irValue - state.ema;
    state.smoothed = state.smoothed * 0.8 + dcFiltered * 0.2;
    const signal = state.smoothed;
    state.signalMax *= 0.998;

    // Peak detection
    if (signal > state.lastSignal) {
      state.isRising = true;
    } else if (state.isRising && signal < state.lastSignal) {
      state.isRising = false;

      const dynamicThreshold = state.signalMax * 0.6;
      if (signal > dynamicThreshold && signal > 20) {
        const timeSinceLastBeat = now - state.lastBeatTime;

        if (timeSinceLastBeat > 400 && timeSinceLastBeat < 2000) {
          const isArtifact =
            state.avgIBI > 0 &&
            Math.abs(timeSinceLastBeat - state.avgIBI) > state.avgIBI * 0.3;

          if (!isArtifact) {
            state.signalMax = signal;
            state.lastBeatTime = now;
            state.avgIBI =
              state.avgIBI === 0
                ? timeSinceLastBeat
                : state.avgIBI * 0.8 + timeSinceLastBeat * 0.2;

            state.rrBuffer.push(Math.round(timeSinceLastBeat));

            // Initial beat detection phase (before 45s timer starts)
            if (state.isInitialCalibrating) {
              const beatsFound = Math.min(
                state.rrBuffer.length,
                CALIBRATION_BEATS,
              );
              setBeatProgress(beatsFound);
              if (beatsFound >= CALIBRATION_BEATS) {
                state.isInitialCalibrating = false;
                setSensorState("TRACKING");
                startCalibrationTimer();
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
    setPhase("CONNECTING");
    setStatusMsg("Searching for wearable...");
    setErrorMsg("");
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "XIAO_Biofeedback" }],
        optionalServices: [SERVICE_UUID],
      });

      setStatusMsg("Connecting...");
      const server = await device.gatt.connect();

      device.addEventListener("gattserverdisconnected", () => {
        setStatusMsg("Disconnected");
        setRxCharacteristic(null);
        setSensorState("NO_FINGER");
        setBeatProgress(0);
        dsp.current.fingerPresent = false;
        if (!calibrationStartedRef.current) {
          dsp.current.rrBuffer = [];
          setPhase("IDLE");
        }
      });

      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic =
        await service.getCharacteristic(CHARACTERISTIC_UUID);
      setRxCharacteristic(characteristic);
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleData);
      setStatusMsg("Connected!");
      setPhase("WAITING_FINGER");
    } catch (error) {
      console.error("Bluetooth Error:", error);
      setPhase("ERROR");
      setErrorMsg(
        "Could not connect to wearable. Make sure it's powered on and nearby.",
      );
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  // --- UI helpers ---
  const renderStep = (num, label, active, done) => (
    <div
      className={`${styles.step} ${active ? styles.stepActive : ""} ${done ? styles.stepDone : ""}`}
    >
      <div className={styles.stepCircle}>
        {done ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 7L5.5 10L11.5 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span>{num}</span>
        )}
      </div>
      <span className={styles.stepLabel}>{label}</span>
    </div>
  );

  const step1Done = phase !== "IDLE" && phase !== "CONNECTING";
  const step2Done = calibrationStartedRef.current;
  const step3Done = phase === "DONE";

  return (
    <>
      <div className={styles.bg} />
      <div className={styles.page}>
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.title}>Set Up Your Wearable</h1>
            <p className={styles.subtitle}>
              Let&apos;s connect your device and calibrate your baseline heart
              rhythm.
            </p>
          </div>

          {/* Steps */}
          <div className={styles.steps}>
            {renderStep(
              1,
              "Connect device",
              phase !== "IDLE" && phase !== "CONNECTING",
              false,
            )}
            <div className={styles.stepLine} />
            {renderStep(2, "Wear device", step1Done, step2Done)}
            <div className={styles.stepLine} />
            {renderStep(3, "Calibrate (45s)", step2Done, step3Done)}
          </div>

          {/* Main content area */}
          <div className={styles.content}>
            {/* IDLE — connect prompt */}
            {phase === "IDLE" && (
              <div className={styles.section}>
                <p className={styles.hint}>
                  Make sure your wearable is powered on and within range.
                </p>
                <button className={styles.primaryBtn} onClick={connectToDevice}>
                  Connect Wearable
                </button>
              </div>
            )}

            {/* CONNECTING */}
            {phase === "CONNECTING" && (
              <div className={styles.section}>
                <div className={styles.spinner} />
                <p className={styles.hint}>{statusMsg}</p>
              </div>
            )}

            {/* WAITING_FINGER — connected, waiting for finger */}
            {phase === "WAITING_FINGER" && (
              <div className={styles.section}>
                <div
                  className={styles.statusBadge}
                  data-state={sensorState === "NO_FINGER" ? "warn" : "info"}
                >
                  {sensorState === "NO_FINGER" ? (
                    <span>⚠️ Place your finger firmly on the sensor</span>
                  ) : (
                    <>
                      <span>Detecting heartbeat…</span>
                      <div className={styles.beatBar}>
                        <div
                          className={styles.beatFill}
                          style={{
                            width: `${(beatProgress / CALIBRATION_BEATS) * 100}%`,
                          }}
                        />
                        <span className={styles.beatLabel}>
                          {beatProgress} / {CALIBRATION_BEATS} beats
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <p className={styles.hintSmall}>
                  The calibration will automatically begin once a stable signal
                  is detected.
                </p>
              </div>
            )}

            {/* CALIBRATING — 45s timer running */}
            {phase === "CALIBRATING" && (
              <div className={styles.section}>
                <div className={styles.timerRing}>
                  <svg viewBox="0 0 100 100" className={styles.timerSvg}>
                    <circle
                      className={styles.timerTrack}
                      cx="50"
                      cy="50"
                      r="44"
                    />
                    <circle
                      className={styles.timerProgress}
                      cx="50"
                      cy="50"
                      r="44"
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      strokeDashoffset={`${2 * Math.PI * 44 * (1 - timeLeft / (CALIBRATION_DURATION_MS / 1000))}`}
                    />
                  </svg>
                  <div className={styles.timerInner}>
                    <span className={styles.timerCount}>{timeLeft}</span>
                    <span className={styles.timerUnit}>sec</span>
                  </div>
                </div>
                <div className={styles.statusBadge} data-state="success">
                  💚 Calibrating — keep your finger still
                </div>
                <p className={styles.hintSmall}>
                  This 45-second calibration measures your baseline heart
                  rhythm. Please stay relaxed and keep the sensor in place.
                </p>
              </div>
            )}

            {/* DONE / saving */}
            {phase === "DONE" && (
              <div className={styles.section}>
                {saving ? (
                  <>
                    <div className={styles.spinner} />
                    <p className={styles.hint}>Saving your baseline data…</p>
                  </>
                ) : (
                  <>
                    <div className={styles.successIcon}>✅</div>
                    <p className={styles.hint}>Calibration complete!</p>
                  </>
                )}
              </div>
            )}

            {/* ERROR */}
            {phase === "ERROR" && (
              <div className={styles.section}>
                <p className={styles.errorMsg}>{errorMsg}</p>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    setPhase("IDLE");
                    setErrorMsg("");
                    calibrationStartedRef.current = false;
                    dsp.current.rrBuffer = [];
                    dsp.current.fingerPresent = false;
                    setBeatProgress(0);
                    setTimeLeft(CALIBRATION_DURATION_MS / 1000);
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
