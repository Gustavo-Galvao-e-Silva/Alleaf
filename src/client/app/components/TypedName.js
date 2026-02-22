"use client";

import { useState, useEffect, useRef } from "react";

export default function TypedName({ name, className }) {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;

    const interval = setInterval(() => {
      const i = indexRef.current;
      setDisplayedText(name.slice(0, i + 1));
      indexRef.current += 1;
      if (indexRef.current >= name.length) clearInterval(interval);
    }, 120);

    return () => clearInterval(interval);
  }, [name]);

  return <span className={className}>{displayedText}</span>;
}
