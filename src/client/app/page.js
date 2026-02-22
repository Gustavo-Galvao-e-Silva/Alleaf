"use client";

import { db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore"; // Firestore functions

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, startOfToday } from "date-fns";
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { TimePicker } from "antd";
import styles from "./page.module.css";
import BottomNav from "./components/BottomNav";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  buildAppointmentTitle,
  buildContextItemsFromAppointment,
  cancelAppointment,
  clearActiveAppointmentSession,
  createAppointment,
  formatAppointmentDateTime,
  isFutureDateTime,
  markAppointmentSessionStarted,
  readActiveAppointmentSession,
  readAppointments,
  updateAppointmentById,
  writeActiveAppointmentSession,
} from "@/app/lib/appointments";

import { useAuth } from "@clerk/nextjs";
import exerciseData from "./testData/exercises.json";

const ACCENT_CYCLE = ["teal", "blue", "purple", "rose"];

const ICON_BY_TYPE = {
  interactive: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  asynchronous: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 017 7c0 3-1.5 5-3 6.5V18H8v-2.5C6.5 14 5 12 5 9a7 7 0 017-7z" />
      <path d="M9 22h6" />
      <path d="M10 18v4" />
      <path d="M14 18v4" />
    </svg>
  ),
};

function parseExercises(data) {
  // Ensure we are working with an array
  const exerciseList = Array.isArray(data) ? data : data.exercises || [];

  return exerciseList.map((raw, i) => {
    const isInteractive = raw.type === "interactive";

    let lines = [];
    if (isInteractive) {
      if (Array.isArray(raw.content)) {
        // It's already an array (from your JSON file)
        lines = raw.content;
      } else if (typeof raw.content === "string") {
        // It's a string (from the AI/Firestore) -> Split it into lines
        lines = raw.content
          .split(/\n|\[BREAK\]/) // Split by newlines OR your [BREAK] tag
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    const estimatedMinutes = isInteractive
      ? Math.max(1, Math.round((lines.length * 10) / 60))
      : Math.max(1, Math.round((raw.content?.length || 0) / 800));

    return {
      id: raw.id || raw.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: raw.title,
      type: raw.type,
      accent: ACCENT_CYCLE[i % ACCENT_CYCLE.length],
      icon: ICON_BY_TYPE[raw.type] || ICON_BY_TYPE.interactive,
      duration: raw.duration || `${estimatedMinutes} min`,
      content: lines, // Now guaranteed to be an array
      rawContent: !isInteractive ? raw.content : null,
    };
  });
}

const EXERCISES = parseExercises(exerciseData);

const REPEAT_OPTIONS = ["weekly", "monthly"];

function SparkleIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <path
        d="M18 2l2.5 10.5L31 15l-10.5 2.5L18 28l-2.5-10.5L5 15l10.5-2.5L18 2z"
        fill="currentColor"
      />
      <circle cx="28" cy="6" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="currentColor"
      opacity="0.7"
    >
      <rect x="6" y="6" width="4" height="16" rx="2" />
      <rect x="16" y="6" width="4" height="16" rx="2" />
    </svg>
  );
}

const LINE_DURATION_MS = 10000;

function normalizeLineForTts(line) {
  return line
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function ExercisePlayer({ exercise, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const currentAudioRef = useRef(null);
  const currentAudioUrlRef = useRef("");
  const speechRequestIdRef = useRef(0);
  const lines = useMemo(() => exercise.content || [], [exercise.content]);
  const totalDuration = lines.length * LINE_DURATION_MS;

  const stopCurrentPlayback = useCallback(() => {
    const activeAudio = currentAudioRef.current;
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.src = "";
      currentAudioRef.current = null;
    }

    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    if (isFinished) return;
    const start = Date.now();
    let raf;

    const tick = () => {
      const elapsed = Date.now() - start;
      const currentIndex = Math.min(
        Math.floor(elapsed / LINE_DURATION_MS),
        lines.length - 1,
      );

      setActiveIndex(currentIndex);
      setProgress(Math.min(elapsed / totalDuration, 1));

      if (elapsed >= totalDuration) {
        setIsFinished(true);
        setProgress(1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isFinished, lines.length, totalDuration]);

  useEffect(() => {
    const activeLine = lineRefs.current[activeIndex];
    if (activeLine && containerRef.current) {
      activeLine.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  useEffect(() => {
    if (isFinished || lines.length === 0) {
      stopCurrentPlayback();
      return;
    }

    const activeLine = lines[activeIndex];
    const text = normalizeLineForTts(activeLine || "");
    if (!text) return;

    const requestId = speechRequestIdRef.current + 1;
    speechRequestIdRef.current = requestId;
    const controller = new AbortController();

    const speakLine = async () => {
      stopCurrentPlayback();

      try {
        const response = await fetch("/api/elevenlabs/speak", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!response.ok) return;

        const audioBlob = await response.blob();
        if (controller.signal.aborted) return;
        if (speechRequestIdRef.current !== requestId) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        currentAudioRef.current = audio;
        currentAudioUrlRef.current = audioUrl;

        audio.onended = () => {
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }
          if (currentAudioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            currentAudioUrlRef.current = "";
          }
        };

        audio.onerror = () => {
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }
          if (currentAudioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            currentAudioUrlRef.current = "";
          }
        };

        await audio.play().catch(() => {});
      } catch {}
    };

    speakLine();

    return () => {
      controller.abort();
    };
  }, [activeIndex, isFinished, lines, stopCurrentPlayback]);

  useEffect(() => {
    return () => {
      stopCurrentPlayback();
    };
  }, [stopCurrentPlayback]);

  const handleRestart = useCallback(() => {
    speechRequestIdRef.current += 1;
    stopCurrentPlayback();
    setActiveIndex(0);
    setProgress(0);
    setIsFinished(false);
  }, [stopCurrentPlayback]);

  return (
    <div className={styles.playerOverlay}>
      <div className={styles.playerHeader}>
        <button
          type="button"
          className={styles.playerCloseButton}
          onClick={onClose}
          aria-label="Close exercise"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.playerHeaderInfo}>
          <p className={styles.playerTitle}>{exercise.name}</p>
          <p className={styles.playerSubtitle}>{exercise.duration}</p>
        </div>
      </div>

      <div className={styles.playerLyrics} ref={containerRef}>
        <div className={styles.playerLyricsSpacer} />
        {lines.map((line, i) => (
          <p
            key={i}
            ref={(el) => (lineRefs.current[i] = el)}
            className={styles.playerLine}
            data-state={
              i === activeIndex ? "active" : i < activeIndex ? "past" : "future"
            }
          >
            {line}
          </p>
        ))}
        <div className={styles.playerLyricsSpacer} />
      </div>

      <div className={styles.playerFooter}>
        <div className={styles.playerProgressTrack}>
          <div
            className={styles.playerProgressFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className={styles.playerFooterActions}>
          <span className={styles.playerTimeLabel}>
            {Math.floor((activeIndex * LINE_DURATION_MS) / 60000)}:
            {String(
              Math.floor(((activeIndex * LINE_DURATION_MS) % 60000) / 1000),
            ).padStart(2, "0")}
          </span>
          {isFinished && (
            <button
              type="button"
              className={styles.playerRestartButton}
              onClick={handleRestart}
            >
              Restart
            </button>
          )}
          <span className={styles.playerTimeLabel}>
            {Math.floor(totalDuration / 60000)}:
            {String(Math.floor((totalDuration % 60000) / 1000)).padStart(
              2,
              "0",
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function toLocalDateTimeInputValue(date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000,
  );
  return localDate.toISOString().slice(0, 16);
}

function toLocalDateInputValue(date) {
  return toLocalDateTimeInputValue(date).slice(0, 10);
}

function dateStringToDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString
    .split("-")
    .map((value) => Number(value));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDefaultScheduleSelection() {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  return {
    date: toLocalDateInputValue(nextHour),
    time: toLocalDateTimeInputValue(nextHour).slice(11, 16),
    repeat: null,
  };
}

function buildScheduledDateFromSelection(selection) {
  if (!selection?.date) return null;

  const [year, month, day] = selection.date
    .split("-")
    .map((value) => Number(value));

  if (!year || !month || !day) return null;

  const [hourText, minuteText] = (selection.time || "").split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText);
  if (
    Number.isNaN(hour24) ||
    Number.isNaN(minute) ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const scheduledDate = new Date(year, month - 1, day, hour24, minute, 0, 0);
  return Number.isNaN(scheduledDate.getTime()) ? null : scheduledDate;
}

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [sessionMemory, setSessionMemory] = useState(null);
  const [displayExercises, setDisplayExercises] = useState(EXERCISES); // Start with templates

  // 1. Fetch Session Recap from Vector DB (Actian Cortex)
  useEffect(() => {
    const loadRecentMemory = async () => {
      if (!userId) return;
      try {
        const response = await fetch('/api/journal/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, query: "latest session summary" })
        });
        const data = await response.json();
        if (data && data.length > 0) setSessionMemory(data[0].text);
      } catch (err) { console.log("No recap found."); }
    };
    loadRecentMemory();
  }, [userId]);



useEffect(() => {
  if (!userId) return;

  const planDocRef = doc(db, "users", userId, "plans", "current");

  const unsubscribe = onSnapshot(planDocRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.exercises) {
        // CRITICAL: Parse the AI exercises so the 'content' string becomes an array
        const formatted = parseExercises(data.exercises);
        setDisplayExercises(formatted);
      }
    } else {
      setDisplayExercises(EXERCISES);
    }
  });

  return () => unsubscribe();
}, [userId]);


  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  const [dailyQuote, setDailyQuote] = useState({ q: "", a: "" });

  useEffect(() => {
    const STORAGE_KEY = "alleaf_daily_quote";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const today = new Date().toDateString();
        if (parsed.date === today) {
          setDailyQuote({ q: parsed.q, a: parsed.a });
          return;
        }
      } catch {}
    }
    fetch("/api/quote")
      .then((res) => res.json())
      .then((data) => {
        if (data.q) {
          setDailyQuote({ q: data.q, a: data.a });
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ q: data.q, a: data.a, date: new Date().toDateString() }),
          );
        }
      })
      .catch(() => {});
  }, []);

  const [activeExercise, setActiveExercise] = useState(null);
  const [activeTextExercise, setActiveTextExercise] = useState(null);

const [appointments, setAppointments] = useState([]); // Start empty
const [hasMounted, setHasMounted] = useState(false)

useEffect(() => {
  setAppointments(readAppointments());
  setHasMounted(true);
}, []);

  const [scheduleSelection, setScheduleSelection] = useState(() =>
    getDefaultScheduleSelection(),
  );
  const [therapistNotes, setTherapistNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const selectedScheduleDate = dateStringToDate(scheduleSelection.date);
  const selectedScheduleTime = useMemo(() => {
    if (!scheduleSelection.time) return null;
    const parsed = dayjs(`2000-01-01T${scheduleSelection.time}`);
    return parsed.isValid() ? parsed : null;
  }, [scheduleSelection.time]);

  const scheduledAppointments = useMemo(() => {
    return [...appointments]
      .sort((first, second) => {
        return (
          new Date(first.scheduledAt).getTime() -
          new Date(second.scheduledAt).getTime()
        );
      })
      .filter((appointment) => appointment.status === "scheduled");
  }, [appointments]);

  const resetScheduleFields = () => {
    setScheduleSelection(getDefaultScheduleSelection());
    setTherapistNotes("");
    setFormError("");
  };

  const handleEditSession = (appointment) => {
    const scheduled = new Date(appointment.scheduledAt);
    setScheduleSelection({
      date: toLocalDateInputValue(scheduled),
      time: toLocalDateTimeInputValue(scheduled).slice(11, 16),
      repeat: appointment.repeat || null,
    });
    setTherapistNotes(appointment.therapistNotes || "");
    setEditingAppointmentId(appointment.id);
    setFormError("");
    setIsScheduleDialogOpen(true);
  };

  const handleCreateAppointment = (event) => {
    event.preventDefault();
    setFormError("");

    if (!scheduleSelection.date) {
      setFormError("Please choose a date and time.");
      return;
    }

    const scheduledDate = buildScheduledDateFromSelection(scheduleSelection);
    if (!scheduledDate) {
      setFormError("Please choose a valid date and time.");
      return;
    }

    if (!isFutureDateTime(scheduledDate.toISOString())) {
      setFormError("Appointments must be scheduled in the future.");
      return;
    }

    if (editingAppointmentId) {
      updateAppointmentById(editingAppointmentId, (prev) => ({
        ...prev,
        scheduledAt: scheduledDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        therapistNotes,
        repeat: scheduleSelection.repeat || null,
      }));
    } else {
      createAppointment({
        scheduledAt: scheduledDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        therapistNotes,
        repeat: scheduleSelection.repeat,
      });
    }

    setAppointments(readAppointments());
    resetScheduleFields();
    setEditingAppointmentId(null);
    setIsScheduleDialogOpen(false);
  };

const handleStartSession = (appointmentId) => {
  const startedAppointment = markAppointmentSessionStarted(appointmentId);
  if (!startedAppointment || startedAppointment.status !== "scheduled") return;

  // Keep local tracking logic
  const activeSession = {
    appointmentId: startedAppointment.id,
    startedAt: startedAppointment.startedAt || new Date().toISOString(),
    contextItems: buildContextItemsFromAppointment(startedAppointment),
  };
  writeActiveAppointmentSession(activeSession);
  setAppointments(readAppointments());

  // REDIRECT CHANGE: Go to /chat and pass the therapistNotes
  const notes = startedAppointment.therapistNotes || "";
  router.push(`/chat?appointment=${startedAppointment.id}&notes=${encodeURIComponent(notes)}`);
};

  const handleCancelSession = (appointmentId) => {
    const activeSession = readActiveAppointmentSession();
    cancelAppointment(appointmentId);
    if (activeSession?.appointmentId === appointmentId) {
      clearActiveAppointmentSession();
    }
    setAppointments(readAppointments());
  };

  if (isLoaded && !isSignedIn)
    return <div className={styles.videoBg} aria-hidden="true" />;

  return (
    <>
      <div className={styles.videoBg} aria-hidden="true" />
      <main className={styles.page}>






        {/* Hero */}
        <section className={styles.hero}>
          <span className={styles.sparkleIcon}>
            <SparkleIcon />
          </span>
          <h1 className={styles.greeting}>Hello, there</h1>
          <p className={styles.subtitle}>Welcome back to your wellness space</p>
        </section>

        {/* Daily Quote */}
        <section className={styles.quoteSection}>
          <div className={`${styles.quoteCard} ${dailyQuote.q ? styles.quoteVisible : ""}`}>
            {dailyQuote.q && (
              <>
                <p className={styles.quoteText}>{dailyQuote.q}</p>
                <p className={styles.quoteAttribution}>— {dailyQuote.a}</p>
              </>
            )}
          </div>
        </section>

        {/* Schedule Section */}
        <section className={styles.scheduleSection}>
          <div className={styles.scheduleHeader}>
            <h2 className={styles.sectionTitle}>Schedule</h2>
            <button
              type="button"
              className={styles.openScheduleButton}
              onClick={() => {
                resetScheduleFields();
                setEditingAppointmentId(null);
                setIsScheduleDialogOpen(true);
              }}
            >
              Schedule a meeting
            </button>
          </div>

              <div className={styles.scheduleCard}>
                <div className={styles.appointmentList}>
                  {/* Wrap with hasMounted check */}
                  {!hasMounted ? (
                    null // Or a small loading spinner
                  ) : scheduledAppointments.length === 0 ? (
                    <p className={styles.emptySchedule}>No scheduled meetings yet.</p>
                  ) : (
              scheduledAppointments.map((appointment) => {
                const scheduledDate = new Date(appointment.scheduledAt);
                const today = new Date();
                const isToday =
                  scheduledDate.getFullYear() === today.getFullYear() &&
                  scheduledDate.getMonth() === today.getMonth() &&
                  scheduledDate.getDate() === today.getDate();

                return (
                  <article
                    key={appointment.id}
                    className={styles.appointmentCard}
                  >
                    <div className={styles.appointmentHeader}>
                      <p className={styles.appointmentTitle}>
                        {buildAppointmentTitle(appointment)}
                      </p>
                      <div className={styles.headerActions}>
                        <span
                          className={styles.statusBadge}
                          data-status="scheduled"
                        >
                          scheduled
                        </span>
                        <button
                          type="button"
                          className={styles.editSessionButton}
                          onClick={() => handleEditSession(appointment)}
                        >
                          Edit session
                        </button>
                      </div>
                    </div>

                    <p className={styles.appointmentMeta}>
                      {formatAppointmentDateTime(
                        appointment.scheduledAt,
                        appointment.timezone,
                      )}
                    </p>
                    <p className={styles.appointmentRepeat}>
                      {appointment.repeat
                        ? `Repeats ${appointment.repeat}`
                        : "One-time session"}
                    </p>

                    <div className={styles.appointmentActions}>
                      {isToday && (
                        <button
                          type="button"
                          className={styles.startSessionButton}
                          onClick={() => handleStartSession(appointment.id)}
                        >
                          Start Session
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.cancelSessionButton}
                        onClick={() => handleCancelSession(appointment.id)}
                      >
                        Cancel Session
                      </button>
                    </div>
                  </article>
                );
              })
            )}
            </div>
          </div>

          <Dialog
            open={isScheduleDialogOpen}
            onOpenChange={(open) => {
              setIsScheduleDialogOpen(open);
              if (!open) setEditingAppointmentId(null);
            }}
          >
            <DialogContent className={styles.scheduleDialog}>
              <DialogHeader>
                <DialogTitle className={styles.scheduleDialogTitle}>
                  {editingAppointmentId ? "Edit Session" : "Schedule Meeting"}
                </DialogTitle>
              </DialogHeader>
              <form
                className={styles.scheduleForm}
                onSubmit={handleCreateAppointment}
              >
                <div className={styles.dropdownField}>
                  <p className={styles.formLabel}>
                    <span className={styles.formLabelText}>
                      Date<span className={styles.requiredStar}>*</span>
                    </span>
                  </p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          styles.datePickerTrigger,
                          !scheduleSelection.date &&
                            styles.datePickerTriggerEmpty,
                        )}
                      >
                        <CalendarIcon
                          className={styles.datePickerTriggerIcon}
                        />
                        {selectedScheduleDate ? (
                          format(selectedScheduleDate, "PPP")
                        ) : (
                          <span>Select date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className={styles.datePickerPopoverContent}
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={selectedScheduleDate || undefined}
                        onSelect={(value) =>
                          setScheduleSelection((previous) => ({
                            ...previous,
                            date: value ? toLocalDateInputValue(value) : "",
                          }))
                        }
                        disabled={{ before: startOfToday() }}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className={styles.dropdownField}>
                  <p className={styles.formLabel}>
                    <span className={styles.formLabelText}>
                      Time<span className={styles.requiredStar}>*</span>
                    </span>
                  </p>
                  <TimePicker
                    value={selectedScheduleTime}
                    format="HH:mm"
                    minuteStep={5}
                    allowClear={false}
                    className={styles.timePicker}
                    popupClassName={styles.timePickerDropdown}
                    getPopupContainer={(trigger) =>
                      trigger.parentElement || trigger
                    }
                    onChange={(_, timeString) =>
                      setScheduleSelection((previous) => ({
                        ...previous,
                        time: typeof timeString === "string" ? timeString : "",
                      }))
                    }
                  />
                </div>

                <div className={styles.repeatField}>
                  <p className={styles.formLabel}>
                    <span className={styles.formLabelText}>
                      Repeat{" "}
                      <span className={styles.optionalTag}>(optional)</span>
                    </span>
                  </p>
                  <div className={styles.repeatOptions}>
                    {REPEAT_OPTIONS.map((repeatValue) => (
                      <button
                        key={repeatValue}
                        type="button"
                        className={styles.repeatOption}
                        data-active={scheduleSelection.repeat === repeatValue}
                        onClick={() =>
                          setScheduleSelection((previous) => ({
                            ...previous,
                            repeat:
                              previous.repeat === repeatValue
                                ? null
                                : repeatValue,
                          }))
                        }
                      >
                        {repeatValue}
                      </button>
                    ))}
                  </div>
                </div>

                <label className={styles.formLabel}>
                  <span className={styles.formLabelText}>
                    Notes for therapist{" "}
                    <span className={styles.optionalTag}>(optional)</span>
                  </span>
                  <textarea
                    value={therapistNotes}
                    onChange={(event) => setTherapistNotes(event.target.value)}
                    className={styles.formTextarea}
                    rows={3}
                    placeholder="What should Samantha focus on in this session?"
                  />
                </label>

                {formError ? (
                  <p className={styles.formError}>{formError}</p>
                ) : null}

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.dialogCancelButton}
                    onClick={() => setIsScheduleDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.scheduleButton}>
                    {editingAppointmentId ? "Save Changes" : "Schedule"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </section>

        {/* Wellness Exercises */}
        <section className={styles.exercisesSection}>
          <h2 className={styles.sectionTitle}>Wellness Exercises</h2>
          <div className={styles.exerciseList}>
            {displayExercises.map((ex) => {
              const isInteractive = ex.type === "interactive";
              const typeLabel = isInteractive ? "Meditation" : "Exercise";
              return (
                <div
                  key={ex.id}
                  className={styles.exerciseCard}
                  data-accent={ex.accent}
                >
                  <div className={styles.exerciseIcon} data-accent={ex.accent}>
                    {ex.icon}
                  </div>
                  <div className={styles.exerciseInfo}>
                    <p className={styles.exerciseName}>
                      {ex.name}
                      <span className={styles.exerciseTypeBadge}>{typeLabel}</span>
                    </p>
                    <p className={styles.exerciseDuration}>{ex.duration}</p>
                  </div>
                  <button
                    className={styles.startButton}
                    onClick={() => isInteractive ? setActiveExercise(ex) : setActiveTextExercise(ex)}
                  >
                    {isInteractive ? "Start" : "Begin"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <BottomNav activeItem="home" />

        {activeExercise && (
          <ExercisePlayer
            exercise={activeExercise}
            onClose={() => setActiveExercise(null)}
          />
        )}

        {activeTextExercise && (
          <div className={styles.playerOverlay}>
            <div className={styles.playerHeader}>
              <button
                type="button"
                className={styles.playerCloseButton}
                onClick={() => setActiveTextExercise(null)}
                aria-label="Close exercise"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className={styles.playerHeaderInfo}>
                <p className={styles.playerTitle}>{activeTextExercise.name}</p>
                <p className={styles.playerSubtitle}>{activeTextExercise.duration}</p>
              </div>
            </div>
            <div className={styles.textExerciseBody}>
              {(activeTextExercise.rawContent || "").split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className={styles.textExerciseSpacer} />;
                const listMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
                const renderBold = (text) =>
                  text.split(/(\*\*.*?\*\*)/).map((part, j) =>
                    part.startsWith("**") && part.endsWith("**")
                      ? <strong key={j}>{part.slice(2, -2)}</strong>
                      : part
                  );
                if (listMatch) {
                  return (
                    <div key={i} className={styles.textExerciseListItem}>
                      <span className={styles.textExerciseListNum}>{listMatch[1]}</span>
                      <p>{renderBold(listMatch[2])}</p>
                    </div>
                  );
                }
                return <p key={i} className={styles.textExerciseParagraph}>{renderBold(trimmed)}</p>;
              })}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
