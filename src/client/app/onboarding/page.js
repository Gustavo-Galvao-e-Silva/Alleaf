"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./page.module.css";

export default function OnboardingPage() {
  const { user } = useUser();

  const [form, setForm] = useState({
    name: "",
    dateOfBirth: "",
    sex: "",
    height: "",
    weight: "",
    smoker: "",
    activityLevel: "",
    sleepDuration: "8",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.name ||
      !form.dateOfBirth ||
      !form.sex ||
      !form.height ||
      !form.weight ||
      !form.smoker ||
      !form.activityLevel ||
      !form.sleepDuration
    ) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // 1. Write profile to Firestore via API route
      const profileRes = await fetch("/api/createProfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...form }),
      });
      if (!profileRes.ok) throw new Error("Profile creation failed");

      // 2. Mark onboarding complete in Clerk metadata
      const metaRes = await fetch("/api/onboarding-complete", {
        method: "POST",
      });
      if (!metaRes.ok) throw new Error("Metadata update failed");

      // 3. Reload session so the updated metadata is reflected in the JWT
      await user.reload();

      // 4. Hard navigate so the middleware re-reads the new token
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.bg} />
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Welcome to Alleaf</h1>
          <p className={styles.subtitle}>
            Tell us a little about yourself to get started.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input
                className={styles.input}
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date of Birth</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      styles.datePickerTrigger,
                      !form.dateOfBirth && styles.datePickerEmpty,
                    )}
                  >
                    <CalendarIcon className={styles.datePickerIcon} />
                    {form.dateOfBirth
                      ? format(
                          new Date(form.dateOfBirth + "T00:00:00"),
                          "MMMM d, yyyy",
                        )
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={styles.datePickerPopover}
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={
                      form.dateOfBirth
                        ? new Date(form.dateOfBirth + "T00:00:00")
                        : undefined
                    }
                    onSelect={(date) =>
                      setForm((prev) => ({
                        ...prev,
                        dateOfBirth: date ? format(date, "yyyy-MM-dd") : "",
                      }))
                    }
                    disabled={{ after: new Date() }}
                    captionLayout="dropdown"
                    defaultMonth={new Date(2000, 0)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Sex</label>
              <select
                className={styles.input}
                name="sex"
                value={form.sex}
                onChange={handleChange}
              >
                <option value="" disabled>
                  Select...
                </option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Height (cm)</label>
              <input
                className={styles.input}
                name="height"
                type="text"
                inputMode="numeric"
                value={form.height}
                onChange={handleChange}
                placeholder="170"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Weight (kg)</label>
              <input
                className={styles.input}
                name="weight"
                type="text"
                inputMode="numeric"
                value={form.weight}
                onChange={handleChange}
                placeholder="70"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Do you smoke?</label>
              <div className={styles.toggleGroup}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${form.smoker === "yes" ? styles.toggleActive : ""}`}
                  onClick={() =>
                    setForm((prev) => ({ ...prev, smoker: "yes" }))
                  }
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${form.smoker === "no" ? styles.toggleActive : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, smoker: "no" }))}
                >
                  No
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Activity Level</label>
              <select
                className={styles.input}
                name="activityLevel"
                value={form.activityLevel}
                onChange={handleChange}
              >
                <option value="" disabled>
                  Select...
                </option>
                <option value="sedentary">
                  Sedentary (little or no exercise)
                </option>
                <option value="light">Light (1–3 days/week)</option>
                <option value="moderate">Moderate (3–5 days/week)</option>
                <option value="active">Active (6–7 days/week)</option>
                <option value="very-active">
                  Very active (intensive exercise)
                </option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Average Sleep Duration —{" "}
                <span className={styles.sliderValue}>
                  {form.sleepDuration ? `${form.sleepDuration} hrs` : "--"}
                </span>
              </label>
              <input
                className={styles.slider}
                name="sleepDuration"
                type="range"
                min="1"
                max="12"
                step="1"
                value={form.sleepDuration || 6}
                onChange={handleChange}
              />
              <div className={styles.sliderTicks}>
                {[1, 3, 6, 9, 12].map((v) => (
                  <span key={v} style={{ left: `${((v - 1) / 11) * 100}%` }}>
                    {v}h
                  </span>
                ))}
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? "Saving..." : "Get Started →"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
