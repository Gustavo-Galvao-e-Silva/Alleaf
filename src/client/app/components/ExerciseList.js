"use client";
import { useState } from 'react';
import GuidedExercise from './GuidedExercise';

export default function ExerciseList({ exercises }) {
  const [activeExercise, setActiveExercise] = useState(null);

  if (activeExercise) {
    return (
      <GuidedExercise
        title={activeExercise.title}
        script={activeExercise.content}
        onExit={() => setActiveExercise(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {exercises.map((ex, i) => (
        <div key={i} className="p-6 border rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              ex.type === 'interactive' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
            }`}>
              {ex.type}
            </span>
            <h3 className="text-xl font-bold mt-4">{ex.title}</h3>
            <p className="text-gray-600 mt-2 text-sm line-clamp-3">{ex.content}</p>
          </div>

          <button
            onClick={() => ex.type === 'interactive' ? setActiveExercise(ex) : alert(ex.content)}
            className="mt-6 w-full py-3 rounded-xl font-bold bg-gray-900 text-white hover:bg-black transition-colors"
          >
            {ex.type === 'interactive' ? "Start Guided Session" : "View Instructions"}
          </button>
        </div>
      ))}
    </div>
  );
}
