"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const SEND_INTERVAL_MS = 45_000;
const DETECTION_BEATS = 5;
const IR_THRESHOLD = 50_000;

/**
 * useBleHeartRate
 *
 * Returns { bleStatus, sensorState, connect }.
 * - Call connect() once from a button click (satisfies the browser gesture
 *   requirement). After that, wear-detection and 45s collection are fully
 *   automatic.
 * - bleStatus:  "idle" | "connecting" | "connected" | "error"
 * - sensorState: "NO_FINGER" | "DETECTING" | "TRACKING"
 */
export function useBleHeartRate(userProfile) {
  const [bleStatus, setBleStatus] = useState("idle");
  const [sensorState, setSensorState] = useState("NO_FINGER");
  const [meanHr, setMeanHr] = useState(null);
  const [isStressed, setIsStressed] = useState(null);

  const profileRef = useRef(userProfile);
  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  const dsp = useRef({
    ema: 0,
    smoothed: 0,
    lastSignal: 0,
    lastBeatTime: 0,
    avgIBI: 0,
    signalMax: 0,
    isRising: false,
    fingerPresent: false,
    isDetecting: true,
    detectionBeats: 0,
    rrWindow: [],
  });

  const sendIntervalRef = useRef(null);
  const characteristicRef = useRef(null);

  // ── Send 45s window to backend ───────────────────────────────────────────
  const sendWindow = useCallback(async () => {
    const buffer = [...dsp.current.rrWindow];
    dsp.current.rrWindow = [];

    const profile = profileRef.current;
    if (buffer.length === 0 || !profile) return;

    // Debug log: print RR intervals being sent
    console.log("[DEBUG] Sending currentRR to backend:", buffer);

    try {
      const res = await fetch("/api/heart-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userData: {
            age: profile.age,
            sex: profile.sex,
            height: profile.height,
            weight: profile.weight,
            smoker: profile.smoker,
            baselineRR: profile.baselineRR ?? null,
          },
          currentRR: buffer,
        }),
      });
      const data = await res.json();
      console.log("[BLE] heart-data response:", data);
      if (data.mean_hr !== undefined) setMeanHr(Math.round(data.mean_hr));
      if (data.is_stressed !== undefined) setIsStressed(data.is_stressed);
    } catch (err) {
      console.error("[BLE] Failed to send heart data:", err);
    }
  }, []);

  const startInterval = useCallback(() => {
    if (sendIntervalRef.current) return;
    sendIntervalRef.current = setInterval(sendWindow, SEND_INTERVAL_MS);
  }, [sendWindow]);

  const stopInterval = useCallback(() => {
    clearInterval(sendIntervalRef.current);
    sendIntervalRef.current = null;
  }, []);

  // ── DSP / notification handler ───────────────────────────────────────────
  const handleData = useCallback(
    (event) => {
      const rawString = new TextDecoder().decode(event.target.value);
      if (rawString === "NO_SENSOR") return;

      const irValue = parseInt(rawString, 10);
      if (isNaN(irValue)) return;

      const state = dsp.current;
      const now = performance.now();

      if (irValue < IR_THRESHOLD) {
        if (state.fingerPresent) {
          state.fingerPresent = false;
          state.isDetecting = true;
          state.detectionBeats = 0;
          // Reset all DSP state for fast reacquisition
          state.ema = 0;
          state.smoothed = 0;
          state.lastSignal = 0;
          state.lastBeatTime = 0;
          state.avgIBI = 0;
          state.signalMax = 0;
          state.rrWindow = [];
          setSensorState("NO_FINGER");
          stopInterval();
        }
        return;
      }

      if (!state.fingerPresent) {
        state.fingerPresent = true;
        state.isDetecting = true;
        state.detectionBeats = 0;
        // Reset all DSP state for fast reacquisition
        state.ema = 0;
        state.smoothed = 0;
        state.lastSignal = 0;
        state.lastBeatTime = 0;
        state.avgIBI = 0;
        state.signalMax = 0;
        state.rrWindow = [];
        state.isRising = false;
        setSensorState("DETECTING");
      }

      if (state.ema === 0) state.ema = irValue;
      state.ema = state.ema * 0.95 + irValue * 0.05;
      const dcFiltered = irValue - state.ema;
      state.smoothed = state.smoothed * 0.8 + dcFiltered * 0.2;
      const signal = state.smoothed;
      state.signalMax *= 0.998;

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

              // Collect RR interval
              const rr = Math.round(timeSinceLastBeat);
              state.rrWindow.push(rr);
              // Debug: log live RR interval
              console.log("[DEBUG] Live RR interval:", rr);

              if (state.isDetecting) {
                state.detectionBeats += 1;
                if (state.detectionBeats >= DETECTION_BEATS) {
                  state.isDetecting = false;
                  setSensorState("TRACKING");
                  startInterval();
                }
              }
            }
          } else if (timeSinceLastBeat >= 2000) {
            state.lastBeatTime = now;
          }
        }
      }
      state.lastSignal = signal;
    },
    [startInterval, stopInterval],
  );

  // ── connect — must be called from a user gesture ─────────────────────────
  const connect = useCallback(async () => {
    setBleStatus("connecting");
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "XIAO_Biofeedback" }],
        optionalServices: [SERVICE_UUID],
      });

      const server = await device.gatt.connect();

      device.addEventListener("gattserverdisconnected", () => {
        setBleStatus("idle");
        setSensorState("NO_FINGER");
        const state = dsp.current;
        state.fingerPresent = false;
        state.isDetecting = true;
        state.detectionBeats = 0;
        state.rrWindow = [];
        stopInterval();
      });

      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic =
        await service.getCharacteristic(CHARACTERISTIC_UUID);
      characteristicRef.current = characteristic;
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleData);
      setBleStatus("connected");
    } catch (err) {
      console.error("[BLE] Connection error:", err);
      setBleStatus("error");
    }
  }, [handleData, stopInterval]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopInterval();
      const c = characteristicRef.current;
      if (c) {
        c.stopNotifications().catch(() => {});
        c.removeEventListener("characteristicvaluechanged", handleData);
      }
    };
  }, [handleData, stopInterval]);

  return { bleStatus, sensorState, connect, meanHr, isStressed };
}
