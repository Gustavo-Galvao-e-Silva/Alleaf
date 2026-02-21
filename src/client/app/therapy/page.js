"use client";
import { useState } from 'react';

export default function TherapyPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  const startSession = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:5001/agent/start', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: 'horyzon' })
    });
    const data = await res.json();
    setSession(data);
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {!session ? (
        <button onClick={startSession} className="bg-green-600 text-white p-4 rounded">
          {loading ? "Researching your logs..." : "Start Therapy Session"}
        </button>
      ) : (
        <div>
          <div className="bg-blue-50 p-6 rounded-lg mb-4 italic">
            "Food for thought: {session.food_for_thought}"
          </div>
          {/* Chat Interface Goes Here */}
        </div>
      )}
    </div>
  );
}
