"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import BottomNav from "../components/BottomNav";

const PROMPTS = [
  "What are three things you're grateful for today?",
  "Describe a challenge you faced recently and how you overcame it.",
  "What does your ideal day look like?",
  "Write about a person who inspires you and why.",
  "What are your goals for the next month?",
];

function formatDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return { date, time };
}

const TABS = ["Free Writing", "Prompted", "History"];

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
    </svg>
  );
}

function NoteEditor({ title, body, onTitleChange, onBodyChange, titlePlaceholder, bodyPlaceholder }) {
  const bodyRef = useRef(null);

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      bodyRef.current?.focus();
    }
  };

  return (
    <div className={styles.noteContainer}>
      <input
        className={styles.noteTitle}
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={handleTitleKeyDown}
        placeholder={titlePlaceholder}
        spellCheck="false"
        autoComplete="off"
      />
      <textarea
        ref={bodyRef}
        className={styles.noteBody}
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder={bodyPlaceholder}
        spellCheck="true"
      />
    </div>
  );
}

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [freeTitle, setFreeTitle] = useState("");
  const [freeBody, setFreeBody] = useState("");
  const [promptedTitle, setPromptedTitle] = useState("");
  const [promptedBody, setPromptedBody] = useState("");
  const [currentPrompt] = useState(
    PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
  );

  const [history, setHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [freeDirty, setFreeDirty] = useState(false);
  const [promptedDirty, setPromptedDirty] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");

  const handleFreeTitleChange = (val) => {
    setFreeTitle(val);
    if (!freeDirty && val) setFreeDirty(true);
    if (saveLabel) setSaveLabel("");
  };
  const handleFreeBodyChange = (val) => {
    setFreeBody(val);
    if (!freeDirty && val) setFreeDirty(true);
    if (saveLabel) setSaveLabel("");
  };
  const handlePromptedTitleChange = (val) => {
    setPromptedTitle(val);
    if (!promptedDirty && val) setPromptedDirty(true);
    if (saveLabel) setSaveLabel("");
  };
  const handlePromptedBodyChange = (val) => {
    setPromptedBody(val);
    if (!promptedDirty && val) setPromptedDirty(true);
    if (saveLabel) setSaveLabel("");
  };

  useEffect(() => {
    if (saveLabel === "saved") {
      const timer = setTimeout(() => setSaveLabel(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveLabel]);

  const isDirty = activeTab === 0 ? freeDirty : activeTab === 1 ? promptedDirty : false;
  const showSave = isDirty && saveLabel !== "saved";

	// Alleaf/src/client/app/journal/page.js

const handleSave = async () => {
  const title = activeTab === 0 ? freeTitle : promptedTitle;
  const body = activeTab === 0 ? freeBody : promptedBody;
  const type = activeTab === 0 ? "Free Writing" : "Prompted";
  const { date, time } = formatDateTime();

  // Combine title and body for the vector DB searchability
  const fullTextForAI = `Title: ${title}\nContent: ${body}`;

  if (!body.trim()) return; // Don't save empty notes

  setSaving(true); // Optional: add a saving state to your component

  try {
    // 1. Send to our API route which proxies to the Python Bridge
    const response = await fetch('/api/journal/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id, // Clerk User ID
        text: fullTextForAI,
        id: editingId || Date.now(),
      })
    });

    if (!response.ok) throw new Error("Failed to sync with database");

    // 2. Update local UI state (keeping your friend's logic)
    const entry = {
      id: editingId || Date.now(),
      title: title || "Untitled",
      date,
      time,
      type,
      body,
      preview: body.length > 80 ? body.slice(0, 80) + "…" : body,
    };

    if (editingId) {
      setHistory((prev) => prev.map((h) => (h.id === editingId ? entry : h)));
    } else {
      setHistory((prev) => [entry, ...prev]);
    }

    setSaveLabel("saved");

    // 3. Clear inputs if it was a new entry
    if (!editingId) {
      if (activeTab === 0) {
        setFreeTitle("");
        setFreeBody("");
      } else {
        setPromptedTitle("");
        setPromptedBody("");
      }
    }

    setFreeDirty(false);
    setPromptedDirty(false);

  } catch (err) {
    console.error("Journal Save Error:", err);
    alert("Could not save to the cloud. Check if the backend bridge is running.");
  } finally {
    setSaving(false);
  }
};

  const handleHistoryClick = (entry) => {
    const tabIndex = entry.type === "Free Writing" ? 0 : 1;
    if (tabIndex === 0) {
      setFreeTitle(entry.title === "Untitled" ? "" : entry.title);
      setFreeBody(entry.body);
      setFreeDirty(false);
    } else {
      setPromptedTitle(entry.title === "Untitled" ? "" : entry.title);
      setPromptedBody(entry.body);
      setPromptedDirty(false);
    }
    setEditingId(entry.id);
    setSaveLabel("");
    setActiveTab(tabIndex);
  };

  return (
    <>
      <div className={styles.bg} aria-hidden="true" />
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Journal</h1>
              <p className={styles.subtitle}>Express your thoughts</p>
            </div>
            {(showSave || saveLabel === "saved") && (
              <button
                className={`${styles.saveBtn} ${saveLabel === "saved" ? styles.saveBtnDone : ""}`}
                onClick={saveLabel === "saved" ? undefined : handleSave}
                disabled={saveLabel === "saved"}
              >
                {saveLabel === "saved" ? "Saved!" : "Save"}
              </button>
            )}
          </div>
        </header>

        <div className={styles.tabBar}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={styles.tab}
              data-active={i === activeTab ? "true" : undefined}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 0 && (
          <section className={styles.content}>
            <NoteEditor
              title={freeTitle}
              body={freeBody}
              onTitleChange={handleFreeTitleChange}
              onBodyChange={handleFreeBodyChange}
              titlePlaceholder="Title"
              bodyPlaceholder="Body"
            />
          </section>
        )}

        {activeTab === 1 && (
          <section className={styles.content}>
            <div className={styles.promptCard}>
              <span className={styles.promptIcon}>
                <SparkleIcon />
              </span>
              <div>
                <p className={styles.promptLabel}>Today&apos;s Prompt</p>
                <p className={styles.promptText}>{currentPrompt}</p>
              </div>
            </div>
            <NoteEditor
              title={promptedTitle}
              body={promptedBody}
              onTitleChange={handlePromptedTitleChange}
              onBodyChange={handlePromptedBodyChange}
              titlePlaceholder="Title"
              bodyPlaceholder="Body"
            />
          </section>
        )}

        {activeTab === 2 && (
          <section className={styles.content}>
            {history.length === 0 && (
              <p className={styles.emptyHistory}>No entries yet. Save a note to see it here.</p>
            )}
            {history.map((entry) => (
              <div key={entry.id} className={styles.historyCard} onClick={() => handleHistoryClick(entry)}>
                <div className={styles.historyHeader}>
                  <span className={styles.historyTitle}>{entry.title}</span>
                  <span className={styles.historyMeta}>
                    {entry.date} &middot; {entry.time}
                  </span>
                </div>
                <span className={styles.historyType}>{entry.type}</span>
                <p className={styles.historyPreview}>{entry.preview}</p>
              </div>
            ))}
          </section>
        )}

        <BottomNav activeItem="journal" />
      </main>
    </>
  );
}
