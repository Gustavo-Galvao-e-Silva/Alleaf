import styles from "./page.module.css";
import TypedName from "./components/TypedName";
import BottomNav from "./components/BottomNav";

const EXERCISES = [
  {
    id: "breathing",
    name: "Breathing Exercise",
    desc: "Deep breathing for relaxation",
    duration: "5 min",
    accent: "blue",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
];

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
    <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" opacity="0.7">
      <rect x="6" y="6" width="4" height="16" rx="2" />
      <rect x="16" y="6" width="4" height="16" rx="2" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <div className={styles.videoBg} aria-hidden="true" />
      <main className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <span className={styles.sparkleIcon}>
            <SparkleIcon />
          </span>
          <h1 className={styles.greeting}>Hello, <TypedName name="Deep" /></h1>
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

      {/* Wellness Exercises */}
      <section className={styles.exercisesSection}>
        <h2 className={styles.sectionTitle}>Wellness Exercises</h2>
        <div className={styles.exerciseList}>
          {EXERCISES.map((ex) => (
            <div key={ex.id} className={styles.exerciseCard} data-accent={ex.accent}>
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
