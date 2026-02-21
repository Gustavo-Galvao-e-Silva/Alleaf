"use client";

import { useState } from "react";
import styles from "./page.module.css";
import VideoBackground from "../components/VideoBackground";

const PROMPTS = [
  "What are three things you're grateful for today?",
  "Describe a challenge you faced recently and how you overcame it.",
  "What does your ideal day look like?",
  "Write about a person who inspires you and why.",
  "What are your goals for the next month?",
];

const JOURNAL_HISTORY = [
  {
    id: 1,
    date: "Feb 20",
    time: "9:30 AM",
    type: "Free Writing",
    preview: "Today was a beautiful day. I woke up feeling refreshed and...",
  },
  {
    id: 2,
    date: "Feb 19",
    time: "8:15 PM",
    type: "Prompted",
    preview: "I'm grateful for my family, my health, and the opportunity to...",
  },
  {
    id: 3,
    date: "Feb 18",
    time: "7:45 AM",
    type: "Free Writing",
    preview: "Reflecting on my week, I've learned so much about myself...",
  },
  {
    id: 4,
    date: "Feb 17",
    time: "6:00 PM",
    type: "Prompted",
    preview: "My ideal day starts with a peaceful morning routine...",
  },
];

const TABS = ["Free Writing", "Prompted", "History"];

const NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "journal",
    label: "Journal",
    href: "/journal",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M6.5 2A2.5 2.5 0 004 4.5v15A2.5 2.5 0 006.5 22H20V2H6.5zM6 19.5V5h12v14H6.5a1 1 0 000 2H18v-1.5H6z" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    href: "/chat",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    id: "data",
    label: "Data",
    href: "/data",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
    </svg>
  );
}

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [freeText, setFreeText] = useState("");
  const [promptedText, setPromptedText] = useState("");
  const [currentPrompt] = useState(
    PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
  );

  return (
    <>
      <VideoBackground className={styles.bg} />
      <main className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Journal</h1>
          <p className={styles.subtitle}>Express your thoughts</p>
        </header>

        {/* Tabs */}
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

        {/* Free Writing */}
        {activeTab === 0 && (
          <section className={styles.content}>
            <div className={styles.card}>
              <label className={styles.label}>
                Write freely about anything on your mind
              </label>
              <textarea
                className={styles.textarea}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Start writing..."
                rows={12}
              />
              <div className={styles.cardFooter}>
                <span className={styles.charCount}>
                  {freeText.length} characters
                </span>
                <button
                  className={styles.saveButton}
                  disabled={!freeText.trim()}
                >
                  <SendIcon />
                  Save Entry
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Prompted Writing */}
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

            <div className={styles.card}>
              <textarea
                className={styles.textarea}
                value={promptedText}
                onChange={(e) => setPromptedText(e.target.value)}
                placeholder="Respond to the prompt..."
                rows={10}
              />
              <div className={styles.cardFooter}>
                <span className={styles.charCount}>
                  {promptedText.length} characters
                </span>
                <button
                  className={styles.saveButton}
                  disabled={!promptedText.trim()}
                >
                  <SendIcon />
                  Save Entry
                </button>
              </div>
            </div>
          </section>
        )}

        {/* History */}
        {activeTab === 2 && (
          <section className={styles.content}>
            {JOURNAL_HISTORY.map((entry) => (
              <div key={entry.id} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <span className={styles.historyType}>{entry.type}</span>
                  <span className={styles.historyMeta}>
                    {entry.date} &middot; {entry.time}
                  </span>
                </div>
                <p className={styles.historyPreview}>{entry.preview}</p>
              </div>
            ))}
          </section>
        )}

        {/* Bottom Navigation */}
        <nav className={styles.bottomNav}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={styles.navItem}
                  data-active={item.id === "journal" ? "true" : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </>
  );
}
