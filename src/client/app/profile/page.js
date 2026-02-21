"use client";

import { useState } from "react";
import styles from "./page.module.css";
import BottomNav from "../components/BottomNav";

// ═══════════════════════════════════════════════════════════════════════════════
// CLERK INTEGRATION PLACEHOLDER
// ═══════════════════════════════════════════════════════════════════════════════
// To integrate Clerk authentication:
// 1. Install: npm install @clerk/nextjs
// 2. Wrap your app with <ClerkProvider> in layout.js
// 3. Import and use: import { useUser, UserButton } from "@clerk/nextjs";
// 4. Replace the placeholder data below with: const { user } = useUser();
// 5. Use <UserButton /> for the avatar/account management
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_CLERK_USER = {
  firstName: "Deep",
  lastName: "Patel",
  email: "deep@example.com",
  imageUrl: null, // Clerk provides this
};

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const SLEEP_QUALITY_OPTIONS = ["Poor", "Fair", "Good", "Excellent"];
const ACTIVITY_LEVEL_OPTIONS = ["Sedentary", "Light", "Moderate", "Active", "Very Active"];

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function SectionCard({ title, children, onEdit, isEditing, onSave, onCancel, showEditButton = true }) {
  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {showEditButton && !isEditing && (
          <button className={styles.editBtn} onClick={onEdit} aria-label="Edit">
            <EditIcon />
          </button>
        )}
      </div>
      <div className={styles.sectionContent}>
        {children}
      </div>
      {isEditing && (
        <div className={styles.sectionActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.saveBtn} onClick={onSave}>Save</button>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, isEditing, children }) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      {isEditing ? children : <span className={styles.fieldValue}>{value || "—"}</span>}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleInfo}>
        <span className={styles.toggleLabel}>{label}</span>
        <span className={styles.toggleDescription}>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={styles.toggle}
        data-checked={checked ? "true" : undefined}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  );
}

export default function ProfilePage() {
  // ─────────────────────────────────────────────────────────────────────────────
  // CLERK PLACEHOLDER: Replace with useUser() hook when integrating Clerk
  // const { user, isLoaded } = useUser();
  // ─────────────────────────────────────────────────────────────────────────────
  const user = MOCK_CLERK_USER;

  // Section 2: Personal Info State
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalInfo, setPersonalInfo] = useState({
    dateOfBirth: "",
    gender: "",
  });
  const [tempPersonalInfo, setTempPersonalInfo] = useState({ ...personalInfo });

  // Section 3: Health Profile State
  const [editingHealth, setEditingHealth] = useState(false);
  const [healthProfile, setHealthProfile] = useState({
    sleepDuration: "",
    sleepQuality: "",
    activityLevel: "",
    height: "",
    weight: "",
    dailySteps: "",
  });
  const [tempHealthProfile, setTempHealthProfile] = useState({ ...healthProfile });

  // Section 4: Preferences State
  const [preferences, setPreferences] = useState({
    pushNotifications: true,
    automaticVibration: true,
  });

  // Personal Info Handlers
  const handleEditPersonal = () => {
    setTempPersonalInfo({ ...personalInfo });
    setEditingPersonal(true);
  };

  const handleSavePersonal = () => {
    setPersonalInfo({ ...tempPersonalInfo });
    setEditingPersonal(false);
  };

  const handleCancelPersonal = () => {
    setTempPersonalInfo({ ...personalInfo });
    setEditingPersonal(false);
  };

  // Health Profile Handlers
  const handleEditHealth = () => {
    setTempHealthProfile({ ...healthProfile });
    setEditingHealth(true);
  };

  const handleSaveHealth = () => {
    setHealthProfile({ ...tempHealthProfile });
    setEditingHealth(false);
  };

  const handleCancelHealth = () => {
    setTempHealthProfile({ ...healthProfile });
    setEditingHealth(false);
  };

  // Format display values
  const formatHeight = (cm) => {
    if (!cm) return "—";
    const feet = Math.floor(cm / 30.48);
    const inches = Math.round((cm % 30.48) / 2.54);
    return `${feet}'${inches}" (${cm} cm)`;
  };

  const formatWeight = (kg) => {
    if (!kg) return "—";
    const lbs = Math.round(kg * 2.205);
    return `${kg} kg (${lbs} lbs)`;
  };

  const formatSteps = (steps) => {
    if (!steps) return "—";
    return Number(steps).toLocaleString() + " steps";
  };

  const formatSleepDuration = (hours) => {
    if (!hours) return "—";
    return `${hours} hours`;
  };

  return (
    <>
      <div className={styles.bg} aria-hidden="true" />
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Profile</h1>
        </header>

        <div className={styles.scrollContent}>
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: ACCOUNT (Clerk Integration Placeholder)                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <SectionCard title="Account" showEditButton={false}>
            <div className={styles.accountSection}>
              {/* CLERK PLACEHOLDER: Replace with <UserButton /> component */}
              <div className={styles.avatarWrapper}>
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="Profile" className={styles.avatar} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <span>{user.firstName?.[0]}{user.lastName?.[0]}</span>
                  </div>
                )}
              </div>
              <div className={styles.accountInfo}>
                <p className={styles.userName}>{user.firstName} {user.lastName}</p>
                <p className={styles.userEmail}>{user.email}</p>
                {/* CLERK PLACEHOLDER: Add sign out button or manage account link */}
                <p className={styles.clerkNote}>Managed by Clerk</p>
              </div>
            </div>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: PERSONAL INFORMATION                                     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <SectionCard
            title="Personal Information"
            isEditing={editingPersonal}
            onEdit={handleEditPersonal}
            onSave={handleSavePersonal}
            onCancel={handleCancelPersonal}
          >
            <FieldRow
              label="Date of Birth"
              value={personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null}
              isEditing={editingPersonal}
            >
              <input
                type="date"
                className={styles.input}
                value={tempPersonalInfo.dateOfBirth}
                onChange={(e) => setTempPersonalInfo({ ...tempPersonalInfo, dateOfBirth: e.target.value })}
              />
            </FieldRow>

            <FieldRow
              label="Gender"
              value={personalInfo.gender}
              isEditing={editingPersonal}
            >
              <select
                className={styles.select}
                value={tempPersonalInfo.gender}
                onChange={(e) => setTempPersonalInfo({ ...tempPersonalInfo, gender: e.target.value })}
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FieldRow>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: HEALTH PROFILE                                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <SectionCard
            title="Health Profile"
            isEditing={editingHealth}
            onEdit={handleEditHealth}
            onSave={handleSaveHealth}
            onCancel={handleCancelHealth}
          >
            <FieldRow
              label="Sleep Duration"
              value={formatSleepDuration(healthProfile.sleepDuration)}
              isEditing={editingHealth}
            >
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="8"
                  min="1"
                  max="24"
                  value={tempHealthProfile.sleepDuration}
                  onChange={(e) => setTempHealthProfile({ ...tempHealthProfile, sleepDuration: e.target.value })}
                />
                <span className={styles.inputUnit}>hours</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Sleep Quality"
              value={healthProfile.sleepQuality}
              isEditing={editingHealth}
            >
              <select
                className={styles.select}
                value={tempHealthProfile.sleepQuality}
                onChange={(e) => setTempHealthProfile({ ...tempHealthProfile, sleepQuality: e.target.value })}
              >
                <option value="">Select quality</option>
                {SLEEP_QUALITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FieldRow>

            <FieldRow
              label="Activity Level"
              value={healthProfile.activityLevel}
              isEditing={editingHealth}
            >
              <select
                className={styles.select}
                value={tempHealthProfile.activityLevel}
                onChange={(e) => setTempHealthProfile({ ...tempHealthProfile, activityLevel: e.target.value })}
              >
                <option value="">Select level</option>
                {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FieldRow>

            <FieldRow
              label="Height"
              value={formatHeight(healthProfile.height)}
              isEditing={editingHealth}
            >
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="170"
                  min="50"
                  max="300"
                  value={tempHealthProfile.height}
                  onChange={(e) => setTempHealthProfile({ ...tempHealthProfile, height: e.target.value })}
                />
                <span className={styles.inputUnit}>cm</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Weight"
              value={formatWeight(healthProfile.weight)}
              isEditing={editingHealth}
            >
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="70"
                  min="20"
                  max="500"
                  value={tempHealthProfile.weight}
                  onChange={(e) => setTempHealthProfile({ ...tempHealthProfile, weight: e.target.value })}
                />
                <span className={styles.inputUnit}>kg</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Daily Steps Goal"
              value={formatSteps(healthProfile.dailySteps)}
              isEditing={editingHealth}
            >
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="10000"
                  min="0"
                  max="100000"
                  step="500"
                  value={tempHealthProfile.dailySteps}
                  onChange={(e) => setTempHealthProfile({ ...tempHealthProfile, dailySteps: e.target.value })}
                />
                <span className={styles.inputUnit}>steps</span>
              </div>
            </FieldRow>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 4: PREFERENCES                                              */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <SectionCard title="Preferences" showEditButton={false}>
            <ToggleRow
              label="Push Notifications"
              description="Receive daily reminders and updates"
              checked={preferences.pushNotifications}
              onChange={(val) => setPreferences({ ...preferences, pushNotifications: val })}
            />
            <ToggleRow
              label="Automatic Vibration"
              description="Haptic feedback for interactions"
              checked={preferences.automaticVibration}
              onChange={(val) => setPreferences({ ...preferences, automaticVibration: val })}
            />
          </SectionCard>
        </div>

        <BottomNav activeItem="profile" />
      </main>
    </>
  );
}
