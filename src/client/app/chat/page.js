"use client";

import { db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@clerk/nextjs";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AssistantRuntimeProvider,
  useAuiState,
  useThreadRuntime,
} from "@assistant-ui/react";
import { Orb } from "@/components/ui/orb";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import {
  buildAppointmentTitle,
  buildContextItemsFromAppointment,
  clearActiveAppointmentSession,
  completeAppointment,
  markAppointmentSessionStarted,
  readActiveAppointmentSession,
  readAppointments,
  writeActiveAppointmentSession,
} from "@/app/lib/appointments";
import BottomNav from "../components/BottomNav";
import styles from "./page.module.css";

const ORB_COLORS = ["#9ed7ae", "#2f6f4a"];
const ORB_OPACITY = 0.76;
const INPUT_LEVEL_SENSITIVITY = 5;
const MIN_OUTPUT_LEVEL = 0.28;
const OUTPUT_LEVEL_BOOST = 0.72;

function useVoiceLevels(isActive) {
  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);

  const getInputVolume = useCallback(() => inputLevelRef.current, []);
  const getOutputVolume = useCallback(() => outputLevelRef.current, []);

  useEffect(() => {
    if (!isActive) {
      inputLevelRef.current = 0;
      outputLevelRef.current = 0;
      return;
    }

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextImpl) {
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let stream;
    let source;
    let analyser;
    let audioContext;
    let data;

    const updateLevels = () => {
      if (cancelled || !analyser || !data) return;

      analyser.getByteTimeDomainData(data);

      let energy = 0;
      for (let index = 0; index < data.length; index += 1) {
        const sample = (data[index] - 128) / 128;
        energy += sample * sample;
      }

      const rms = Math.sqrt(energy / data.length);
      const inputLevel = Math.min(1, rms * INPUT_LEVEL_SENSITIVITY);
      const outputTarget = Math.min(
        1,
        MIN_OUTPUT_LEVEL + inputLevel * OUTPUT_LEVEL_BOOST,
      );

      inputLevelRef.current += (inputLevel - inputLevelRef.current) * 0.35;
      outputLevelRef.current += (outputTarget - outputLevelRef.current) * 0.25;

      rafId = window.requestAnimationFrame(updateLevels);
    };

    const startMonitoring = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContextImpl();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.45;
        source.connect(analyser);
        data = new Uint8Array(analyser.fftSize);
        updateLevels();
      } catch {
        inputLevelRef.current = 0;
        outputLevelRef.current = 0;
      }
    };

    startMonitoring();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      analyser?.disconnect();
      source?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
      inputLevelRef.current = 0;
      outputLevelRef.current = 0;
    };
  }, [isActive]);

  return { getInputVolume, getOutputVolume };
}

function VoiceInputController({
  isVoiceRunning,
  onVoiceInputError,
  onAwaitingResponseChange,
}) {
  const threadRuntime = useThreadRuntime();
  const isThreadRunning = useAuiState((state) => state.thread.isRunning);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    onAwaitingResponseChange?.(Boolean(isVoiceRunning && isThreadRunning));
  }, [isVoiceRunning, isThreadRunning, onAwaitingResponseChange]);


  useEffect(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
      isListeningRef.current = false;
    }

    if (!isVoiceRunning || isThreadRunning || typeof window === "undefined") {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onVoiceInputError?.("Voice input is not supported in this browser.");
      return;
    }

    const nextRecognition = new SpeechRecognition();
    nextRecognition.continuous = true;
    nextRecognition.interimResults = false;
    nextRecognition.maxAlternatives = 1;
    nextRecognition.lang = "en-US";

    nextRecognition.onresult = (event) => {
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) continue;
        const transcript = result[0]?.transcript;
        if (typeof transcript === "string" && transcript.trim()) {
          finalText += `${transcript.trim()} `;
        }
      }

      const text = finalText.trim();
      if (!text) return;

      isListeningRef.current = false;
      try {
        nextRecognition.stop();
      } catch {}

      Promise.resolve(
        threadRuntime.append({
          role: "user",
          content: [{ type: "text", text }],
        }),
      ).catch(() => {
        onVoiceInputError?.("Failed to send voice transcription.");
      });
    };

    nextRecognition.onerror = (event) => {
      const errorCode = event?.error;
      if (errorCode === "aborted") return;
      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        isListeningRef.current = false;
        onVoiceInputError?.("Microphone permission was denied.");
        return;
      }
      if (errorCode === "audio-capture") {
        isListeningRef.current = false;
        onVoiceInputError?.("No microphone input was detected.");
      }
    };

    nextRecognition.onend = () => {
      if (!isListeningRef.current) return;
      try {
        nextRecognition.start();
      } catch {}
    };

    recognitionRef.current = nextRecognition;
    isListeningRef.current = true;

    try {
      nextRecognition.start();
    } catch {
      isListeningRef.current = false;
      onVoiceInputError?.("Unable to start voice input.");
    }

    return () => {
      isListeningRef.current = false;
      nextRecognition.onresult = null;
      nextRecognition.onerror = null;
      nextRecognition.onend = null;
      try {
        nextRecognition.stop();
      } catch {}
      if (recognitionRef.current === nextRecognition) {
        recognitionRef.current = null;
      }
    };
  }, [isVoiceRunning, isThreadRunning, onVoiceInputError, threadRuntime]);

  return null;
}

function extractAssistantText(message) {
  if (!message || message.role !== "assistant") return "";

  const chunks = [];

  if (typeof message.content === "string") {
    chunks.push(message.content);
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part?.type === "text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").replace(/\s+/g, " ").trim();
}

function VoiceOutputController({ isVoiceRunning, onVoiceOutputError }) {
  const isThreadRunning = useAuiState((state) => state.thread.isRunning);
  const messages = useAuiState((state) => state.thread.messages);

  const spokenMessageIdsRef = useRef(new Set());
  const lastSpokenSignatureRef = useRef("");
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);

  const stopCurrentPlayback = useCallback(() => {
    queueRef.current = [];
    isPlayingRef.current = false;

    const activeAudio = currentAudioRef.current;
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.src = "";
      currentAudioRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const playViaSpeechSynthesis = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const playFromElevenLabs = useCallback(async (text) => {
    const response = await fetch("/api/elevenlabs/speak", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details?.error || "Failed to fetch ElevenLabs audio");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    await new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        reject(new Error("Audio playback failed"));
      };

      audio.play().catch((error) => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        reject(error);
      });
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    if (!isVoiceRunning) return;

    const nextItem = queueRef.current.shift();
    if (!nextItem) return;

    isPlayingRef.current = true;
    try {
      try {
        await playFromElevenLabs(nextItem.text);
      } catch {
        const fallbackUsed = playViaSpeechSynthesis(nextItem.text);
        if (!fallbackUsed) {
          onVoiceOutputError?.("Unable to play agent voice response.");
        }
      }
      lastSpokenSignatureRef.current = nextItem.signature;
    } finally {
      isPlayingRef.current = false;
      if (queueRef.current.length > 0) {
        processQueue();
      }
    }
  }, [isVoiceRunning, onVoiceOutputError, playFromElevenLabs, playViaSpeechSynthesis]);

  useEffect(() => {
    if (isVoiceRunning) return;
    stopCurrentPlayback();
  }, [isVoiceRunning, stopCurrentPlayback]);

  useEffect(() => {
    return () => {
      stopCurrentPlayback();
    };
  }, [stopCurrentPlayback]);

  useEffect(() => {
    if (!isVoiceRunning || isThreadRunning || !Array.isArray(messages)) return;

    const index = messages.length - 1;
    const message = messages[index];
    if (!message || message.role !== "assistant") return;

    const text = extractAssistantText(message);
    if (!text) return;

    const messageId = message.id || `assistant-${index}`;
    const signature = `${messageId}:${text}`;

    if (lastSpokenSignatureRef.current === signature) return;
    if (spokenMessageIdsRef.current.has(messageId)) return;
    if (queueRef.current.some((item) => item.signature === signature)) return;

    spokenMessageIdsRef.current.add(messageId);
    queueRef.current.push({
      signature,
      text,
    });
    processQueue();
  }, [isVoiceRunning, isThreadRunning, messages, processQueue]);

  return null;
}

function deriveAppointmentSessionState(requestedAppointmentId, revision) {
  void revision;
  const appointments = readAppointments();
  const findById = (appointmentId) =>
    appointments.find((appointment) => appointment.id === appointmentId);

  let session = readActiveAppointmentSession();
  let appointment = null;
  let shouldPersistSession = false;
  let shouldClearSession = false;
  let shouldMarkStarted = false;

  if (requestedAppointmentId) {
    const requestedAppointment = findById(requestedAppointmentId);
    if (requestedAppointment && requestedAppointment.status === "scheduled") {
      const startedAt =
        requestedAppointment.startedAt ||
        (session?.appointmentId === requestedAppointment.id
          ? session.startedAt
          : null) ||
        new Date().toISOString();

      session = {
        appointmentId: requestedAppointment.id,
        startedAt,
        contextItems:
          session?.appointmentId === requestedAppointment.id &&
          Array.isArray(session.contextItems)
            ? session.contextItems
            : buildContextItemsFromAppointment(requestedAppointment),
      };

      appointment = {
        ...requestedAppointment,
        startedAt,
      };
      shouldPersistSession = true;
      shouldMarkStarted = !requestedAppointment.startedAt;
    }
  }

  if (!appointment && session?.appointmentId) {
    const linkedAppointment = findById(session.appointmentId);
    if (linkedAppointment && linkedAppointment.status === "scheduled") {
      appointment = linkedAppointment;
      shouldMarkStarted = !linkedAppointment.startedAt && Boolean(session.startedAt);
    } else {
      session = null;
      shouldClearSession = true;
    }
  }

  return {
    session,
    appointment,
    shouldPersistSession,
    shouldClearSession,
    shouldMarkStarted,
  };
}

// This component "lives" inside the provider, so it can see the messages
function MessageSync({ onUpdate }) {
  const messages = useAuiState((state) => state.thread.messages);
  useEffect(() => {
    onUpdate(messages);
  }, [messages, onUpdate]);
  return null;
}

function ClinicalInitializer({ userId, userNotes, hasMounted, setSessionAgenda }) {
  const threadRuntime = useThreadRuntime();
  const didInitRef = useRef(false);

  useEffect(() => {
    const initializeClinicalSession = async () => {
      if (!hasMounted || !userId || didInitRef.current) return;
      didInitRef.current = true;

      try {
        const res = await fetch('http://localhost:5001/agent/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, user_notes: userNotes })
        });

        const data = await res.json();
        if (data.agenda) setSessionAgenda(data.agenda);

        if (data.food_for_thought) {
          threadRuntime.append({
            role: "assistant",
            content: [{ type: "text", text: data.food_for_thought }]
          });
        }
      } catch (e) {
        console.error("Clinical Init Failed:", e);
      }
    };

    initializeClinicalSession();
  }, [hasMounted, userId, userNotes, threadRuntime, setSessionAgenda]);

  return null;
}

export default function ChatPage() {
  const [sessionAgenda, setSessionAgenda] = useState("");
  const didInitRef = useRef(false); // Prevents the AI from greeting you twice
  const messagesRef = useRef([]); // This will hold our real transcript

  const [hasMounted, setHasMounted] = useState(false);

  const { userId } = useAuth(); // Get the real Clerk ID
  const router = useRouter();
  const searchParams = useSearchParams();
  const userNotes = searchParams.get("notes") || "";
  const requestedAppointmentId = searchParams.get("appointment");

const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
      body: {
        userId: userId,
        userNotes: userNotes,
        agenda: sessionAgenda // <--- ADD THIS LINE
      },
    }),
  });

  useEffect(() => { setHasMounted(true); }, []);


  useEffect(() => {
    const initializeClinicalSession = async () => {
      // Guard: Only run if we have a user, it's mounted, and we haven't already started
      if (!hasMounted || !userId || didInitRef.current) return;
      didInitRef.current = true;

      try {
        const res = await fetch('http://localhost:5001/agent/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, user_notes: userNotes })
        });
        
        const data = await res.json();

        // 1. Store the clinical agenda for the therapist to follow
        if (data.agenda) setSessionAgenda(data.agenda);

        // 2. Force the "Assistant" greeting into the UI thread
        if (data.food_for_thought) {
          threadRuntime.append({
            role: "assistant",
            content: [{ type: "text", text: data.food_for_thought }]
          });
        }

      } catch (e) {
        console.error("Clinical Init Failed:", e);
      }
    };

    initializeClinicalSession();
  }, [hasMounted, userId, userNotes, runtime]);




useEffect(() => {
    setHasMounted(true); // Set to true once the browser loads
  }, []);

  const [sessionRevision, setSessionRevision] = useState(0);
  const [isVoiceOpen, setIsVoiceOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("appointment") || readActiveAppointmentSession()?.appointmentId);
  });
  const [isVoiceRunning, setIsVoiceRunning] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("appointment") || readActiveAppointmentSession()?.appointmentId);
  });
  const [isVoiceAwaitingResponse, setIsVoiceAwaitingResponse] = useState(false);
  const [isMiniOrbSettled, setIsMiniOrbSettled] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("appointment") || readActiveAppointmentSession()?.appointmentId);
  });
  const [voiceInputError, setVoiceInputError] = useState("");
  const { getInputVolume, getOutputVolume } = useVoiceLevels(isVoiceRunning);
  const voiceOrbLayoutId = "voice-orb";

  const appointmentSessionState = useMemo(
    () => deriveAppointmentSessionState(requestedAppointmentId, sessionRevision),
    [requestedAppointmentId, sessionRevision],
  );

  const activeAppointmentSession = appointmentSessionState.session;
  const activeAppointment = appointmentSessionState.appointment;

  const handleVoiceInputError = useCallback((message) => {
    setVoiceInputError(message);
    setIsVoiceRunning(false);
  }, []);

  const handleVoiceOutputError = useCallback((message) => {
    setVoiceInputError(message);
  }, []);

  const contextItems = useMemo(() => {
    if (!activeAppointmentSession?.contextItems) return [];
    return Array.isArray(activeAppointmentSession.contextItems)
      ? activeAppointmentSession.contextItems
      : [];
  }, [activeAppointmentSession]);

  const openVoiceMode = useCallback(() => {
    setVoiceInputError("");
    setIsMiniOrbSettled(false);
    setIsVoiceOpen(true);
    setIsVoiceRunning(true);
  }, []);

  const stopVoiceMode = useCallback(() => {
    setIsVoiceRunning(false);
    setIsVoiceAwaitingResponse(false);
  }, []);

  useEffect(() => {
    if (
      appointmentSessionState.shouldMarkStarted &&
      appointmentSessionState.appointment?.id
    ) {
      markAppointmentSessionStarted(
        appointmentSessionState.appointment.id,
        appointmentSessionState.session?.startedAt,
      );
    }

    if (appointmentSessionState.shouldPersistSession && appointmentSessionState.session) {
      writeActiveAppointmentSession(appointmentSessionState.session);
    }

    if (appointmentSessionState.shouldClearSession) {
      clearActiveAppointmentSession();
    }
  }, [appointmentSessionState]);


  const handleOrbClick = () => {
    setVoiceInputError("");
    if (!isVoiceOpen) {
      openVoiceMode();
      return;
    }
    setIsVoiceRunning(true);
  };


  const handleEndSession = async () => {
  if (!activeAppointmentSession?.appointmentId) return;
  stopVoiceMode();
  try {
    // 1. Trigger the Python Wrap-up Node
    const chatTranscript = messagesRef.current; 

    console.log("Sending transcript length:", chatTranscript.length); // Debug log
	 
    const res = await fetch('http://localhost:5001/therapy/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, transcript: chatTranscript })
    });
    const data = await res.json();

    // 2. Overwrite the Firestore document with new exercises
    if (data.exercises) {
      const planDocRef = doc(db, "users", userId, "plans", "current");
      await setDoc(planDocRef, {
        exercises: data.exercises,
        updatedAt: Date.now()
      }, { merge: true });
    }

    // 3. Cleanup local storage and redirect home
    completeAppointment(activeAppointmentSession.appointmentId, { summaryPlaceholder: "" });
    clearActiveAppointmentSession();
    router.replace("/"); // Go back to see the new exercises on the home page!
  } catch (e) { console.error("End session failed", e); }
};


  return (
    <>
      <div className={styles.bg} aria-hidden="true" />
      <main className={styles.page}>
        <LayoutGroup id="voice-orb-layout">
          <div
            className={`${styles.chatContainer} ${
              isVoiceOpen ? styles.chatContainerOpen : ""
            }`}
          >
            <header className={styles.chatTopBar}>

            <p className={styles.chatTopBarTitle}>
              {!hasMounted 
                ? "Therapist Chat" // Default for Server
                : activeAppointment
                  ? buildAppointmentTitle(activeAppointment) // Real data for Client
                  : "Therapist Chat"
              }
            </p>

              {activeAppointment ? (
                <button
                  type="button"
                  className={styles.endSessionButton}
                  onClick={handleEndSession}
                >
                  End Session
                </button>
              ) : null}
            </header>

            <div className={styles.chatPanel}>
              <AssistantRuntimeProvider runtime={runtime}>

<ClinicalInitializer 
    userId={userId} 
    userNotes={userNotes} 
    hasMounted={hasMounted} 
    setSessionAgenda={setSessionAgenda} 
  />

	        <MessageSync onUpdate={(m) => (messagesRef.current = m)} />
                <VoiceInputController
                  isVoiceRunning={isVoiceRunning}
                  onVoiceInputError={handleVoiceInputError}
                  onAwaitingResponseChange={setIsVoiceAwaitingResponse}
                />
                <VoiceOutputController
                  isVoiceRunning={isVoiceRunning}
                  onVoiceOutputError={handleVoiceOutputError}
                />
                <Thread
                  isVoiceOpen={isVoiceOpen}
                  isVoiceRunning={isVoiceRunning}
                  onStopVoice={stopVoiceMode}
                  onStartVoice={handleOrbClick}
                  voiceControl={
                    isVoiceOpen ? (
                      <AnimatePresence initial={false}>
                        {isVoiceRunning ? (
                          <motion.div
                            key="voice-running"
                            className={styles.voiceControlRow}
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.92 }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                          >
                            <div className={styles.voiceControlState}>
                              {!isMiniOrbSettled ? (
                                <motion.div
                                  layoutId={voiceOrbLayoutId}
                                  transition={{ type: "spring", stiffness: 340, damping: 32 }}
                                  className={styles.voiceControlOrbPlaceholder}
                                  onLayoutAnimationComplete={() => setIsMiniOrbSettled(true)}
                                />
                              ) : null}
                              <button
                                type="button"
                                className={`${styles.voiceControlOrbButton} ${
                                  !isMiniOrbSettled ? styles.voiceControlOrbButtonHidden : ""
                                }`}
                                onClick={handleOrbClick}
                                aria-label="Resume voice mode"
                              >
                                <Orb
                                  className={styles.orb}
                                  style={{ opacity: ORB_OPACITY }}
                                  colors={ORB_COLORS}
                                  agentState={isVoiceAwaitingResponse ? "thinking" : "listening"}
                                  volumeMode={isVoiceAwaitingResponse ? "auto" : "manual"}
                                  getInputVolume={getInputVolume}
                                  getOutputVolume={getOutputVolume}
                                />
                              </button>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    ) : null
                  }
                />
                {voiceInputError ? (
                  <p className={styles.voiceError}>{voiceInputError}</p>
                ) : null}
              </AssistantRuntimeProvider>
            </div>

            <AnimatePresence initial={false}>
              {!isVoiceOpen ? (
                <motion.div
                  key="orb-launch"
                  className={styles.orbLaunch}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.button
                    layoutId={voiceOrbLayoutId}
                    transition={{ type: "spring", stiffness: 340, damping: 32 }}
                    type="button"
                    className={styles.voiceOrbButton}
                    onClick={handleOrbClick}
                    aria-label="Start voice mode"
                  >
                    <Orb
                      className={styles.orb}
                      style={{ opacity: ORB_OPACITY }}
                      colors={ORB_COLORS}
                      agentState={null}
                    />
                  </motion.button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </LayoutGroup>

        <BottomNav activeItem="chat" />
      </main>
    </>
  );
}
