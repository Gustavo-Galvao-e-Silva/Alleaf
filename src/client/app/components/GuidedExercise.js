"use client";
import { useState, useEffect } from 'react';

export default function GuidedExercise({ title, script, onExit }) {
  // Split the script by our special token
  const sentences = script.split("[BREAK]").map(s => s.trim()).filter(s => s);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const speak = (text) => {
    // Stop any existing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for therapy

    utterance.onend = () => {
      setIsPlaying(false);
      // Auto-advance the index so the UI highlights the next sentence
      if (index < sentences.length - 1) {
        setIndex(prev => prev + 1);
      }
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6">
      <button onClick={onExit} className="absolute top-6 right-6 text-gray-400 hover:text-black">✕ Close</button>

      <div className="max-w-2xl w-full text-center">
        <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">Guided Session</span>
        <h2 className="text-3xl font-bold mt-2 mb-12">{title}</h2>

        {/* The Karaoke Display */}
        <div className="space-y-6 mb-12 text-2xl leading-relaxed">
          {sentences.map((s, i) => (
            <p key={i} className={`transition-all duration-500 ${
              i === index ? "text-black font-medium scale-105" : "text-gray-200"
            }`}>
              {s}
            </p>
          ))}
        </div>

        {/* Control Button */}
        <button
          onClick={() => isPlaying ? window.speechSynthesis.cancel() : speak(sentences[index])}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${
            isPlaying ? "bg-red-500" : "bg-green-600 hover:scale-110"
          } text-white`}
        >
          {isPlaying ? (
            <div className="flex gap-1"><div className="w-2 h-6 bg-white"></div><div className="w-2 h-6 bg-white"></div></div>
          ) : (
            <span className="text-3xl ml-1">▶</span>
          )}
        </button>

        <p className="mt-6 text-gray-400 text-sm italic">
          {index === sentences.length - 1 && !isPlaying ? "Exercise Complete" : "Press play to continue"}
        </p>
      </div>
    </div>
  );
}
