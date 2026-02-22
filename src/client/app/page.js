"use client";

import { useMemo, useState, useEffect } from "react";
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
  writeActiveAppointmentSession,
} from "@/app/lib/appointments";

import { useAuth } from "@clerk/nextjs";

const EXERCISES = [
  {
    id: "breathing",
    name: "Breathing Exercise",
    desc: "Deep breathing for relaxation",
    duration: "5 min",
    accent: "blue",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    id: "mindfulness",
    name: "Mindfulness Meditation",
    desc: "Focus on the present moment",
    duration: "10 min",
    accent: "purple",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a7 7 0 017 7c0 3-1.5 5-3 6.5V18H8v-2.5C6.5 14 5 12 5 9a7 7 0 017-7z" />
        <path d="M9 22h6" />
        <path d="M10 18v4" />
        <path d="M14 18v4" />
        <path d="M9 9h2" />
        <path d="M13 9h2" />
      </svg>
    ),
  },
  {
    id: "gratitude",
    name: "Gratitude Practice",
    desc: "Reflect on what you're thankful for",
    duration: "7 min",
    accent: "rose",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
];

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
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  const [appointments, setAppointments] = useState(() => readAppointments());
  const [scheduleSelection, setScheduleSelection] = useState(() =>
    getDefaultScheduleSelection(),
  );
  const [therapistNotes, setTherapistNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
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

    createAppointment({
      scheduledAt: scheduledDate.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      therapistNotes,
      repeat: scheduleSelection.repeat,
    });

    setAppointments(readAppointments());
    resetScheduleFields();
    setIsScheduleDialogOpen(false);
  };

  const handleStartSession = (appointmentId) => {
    const startedAppointment = markAppointmentSessionStarted(appointmentId);
    if (!startedAppointment || startedAppointment.status !== "scheduled")
      return;

    const activeSession = {
      appointmentId: startedAppointment.id,
      startedAt: startedAppointment.startedAt || new Date().toISOString(),
      contextItems: buildContextItemsFromAppointment(startedAppointment),
    };

    writeActiveAppointmentSession(activeSession);
    setAppointments(readAppointments());
    router.push(
      `/chat?appointment=${encodeURIComponent(startedAppointment.id)}`,
    );
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
          <div className={styles.quoteCard}>
            <p className={styles.quoteText}>
              Your limitation—it&apos;s only your imagination.
            </p>
            <p className={styles.quoteAttribution}>— Unknown</p>
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
                setIsScheduleDialogOpen(true);
              }}
            >
              Schedule Meeting
            </button>
          </div>

          <div className={styles.appointmentList}>
            {scheduledAppointments.length === 0 ? (
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
                      <span
                        className={styles.statusBadge}
                        data-status="scheduled"
                      >
                        scheduled
                      </span>
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

                    {appointment.therapistNotes ? (
                      <p className={styles.appointmentNotes}>
                        {appointment.therapistNotes}
                      </p>
                    ) : (
                      <p className={styles.appointmentNotesPlaceholder}>
                        No therapist notes added.
                      </p>
                    )}

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

          <Dialog
            open={isScheduleDialogOpen}
            onOpenChange={setIsScheduleDialogOpen}
          >
            <DialogContent className={styles.scheduleDialog}>
              <DialogHeader>
                <DialogTitle className={styles.scheduleDialogTitle}>
                  Schedule Meeting
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
                    Schedule
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
            {EXERCISES.map((ex) => (
              <div
                key={ex.id}
                className={styles.exerciseCard}
                data-accent={ex.accent}
              >
                <div className={styles.exerciseIcon} data-accent={ex.accent}>
                  {ex.icon}
                </div>
                <div className={styles.exerciseInfo}>
                  <p className={styles.exerciseName}>{ex.name}</p>
                  <p className={styles.exerciseDesc}>{ex.desc}</p>
                  <p className={styles.exerciseDuration}>{ex.duration}</p>
                </div>
                <button className={styles.startButton}>Start</button>
              </div>
            ))}
          </div>
        </section>

        <BottomNav activeItem="home" />
      </main>
    </>
  );
}
