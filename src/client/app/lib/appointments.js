const APPOINTMENTS_STORAGE_KEY = "alleaf:appointments:v1";
const ACTIVE_APPOINTMENT_SESSION_KEY = "alleaf:active-appointment-session:v1";

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParseArray(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStorageArray(key) {
  if (!canUseBrowserStorage()) return [];
  return safeParseArray(window.localStorage.getItem(key));
}

function writeStorageArray(key, value) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `appt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function sanitizeNotes(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sortAppointmentsByDate(appointments) {
  return [...appointments].sort((a, b) => {
    const first = new Date(a?.scheduledAt || 0).getTime();
    const second = new Date(b?.scheduledAt || 0).getTime();
    return first - second;
  });
}

export function readAppointments() {
  return sortAppointmentsByDate(readStorageArray(APPOINTMENTS_STORAGE_KEY));
}

export function writeAppointments(appointments) {
  writeStorageArray(APPOINTMENTS_STORAGE_KEY, sortAppointmentsByDate(appointments));
}

export function isFutureDateTime(value) {
  if (typeof value !== "string" || !value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp > Date.now();
}

export function createAppointment({ scheduledAt, timezone, therapistNotes, repeat }) {
  const normalizedRepeat =
    repeat === "weekly" || repeat === "monthly" ? repeat : null;

  const appointment = {
    id: createId(),
    scheduledAt,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    therapistNotes: sanitizeNotes(therapistNotes),
    repeat: normalizedRepeat,
    status: "scheduled",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    canceledAt: null,
    summaryPlaceholder: null,
    durationSeconds: null,
  };

  const current = readAppointments();
  writeAppointments([...current, appointment]);
  return appointment;
}

export function updateAppointmentById(appointmentId, updater) {
  const current = readAppointments();
  const next = current.map((appointment) => {
    if (appointment.id !== appointmentId) return appointment;
    return updater(appointment);
  });
  writeAppointments(next);
  return next.find((appointment) => appointment.id === appointmentId) || null;
}

export function cancelAppointment(appointmentId) {
  return updateAppointmentById(appointmentId, (appointment) => ({
    ...appointment,
    status: "canceled",
    canceledAt: new Date().toISOString(),
  }));
}

export function markAppointmentSessionStarted(appointmentId, startedAt = new Date().toISOString()) {
  return updateAppointmentById(appointmentId, (appointment) => ({
    ...appointment,
    startedAt: appointment.startedAt || startedAt,
  }));
}

export function completeAppointment(appointmentId, { completedAt, summaryPlaceholder } = {}) {
  const completionDate = completedAt || new Date().toISOString();

  return updateAppointmentById(appointmentId, (appointment) => {
    const startedAt = appointment.startedAt || completionDate;
    const durationMs = Math.max(
      0,
      new Date(completionDate).getTime() - new Date(startedAt).getTime(),
    );

    return {
      ...appointment,
      status: "completed",
      completedAt: completionDate,
      durationSeconds: Math.round(durationMs / 1000),
      summaryPlaceholder:
        typeof summaryPlaceholder === "string"
          ? summaryPlaceholder
          : appointment.summaryPlaceholder || "",
    };
  });
}

export function readActiveAppointmentSession() {
  if (!canUseBrowserStorage()) return null;

  const rawValue = window.localStorage.getItem(ACTIVE_APPOINTMENT_SESSION_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveAppointmentSession(session) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(ACTIVE_APPOINTMENT_SESSION_KEY, JSON.stringify(session));
}

export function clearActiveAppointmentSession() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(ACTIVE_APPOINTMENT_SESSION_KEY);
}

export function buildContextItemsFromAppointment(appointment) {
  if (!appointment) return [];
  const notes = sanitizeNotes(appointment.therapistNotes);
  if (!notes) return [];
  return [notes];
}

export function formatAppointmentDateTime(isoDate, timezone) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone || undefined,
  }).format(date);
}

export function buildAppointmentTitle(appointment) {
  return `Appointment with Samantha on ${formatAppointmentDateTime(
    appointment?.scheduledAt,
    appointment?.timezone,
  )}`;
}

export function formatDuration(durationSeconds) {
  if (typeof durationSeconds !== "number" || durationSeconds <= 0) return "0 min";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes}m ${seconds}s`;
}
