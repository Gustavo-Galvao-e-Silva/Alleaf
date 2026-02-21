"use client";

import { useState, useEffect } from "react";

export default function TypedName({ name, className }) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < name.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + name[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 120); // typing speed in ms

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, name]);

  return (
    <span className={className}>
      {displayedText}
    </span>
  );
}
