"use client";
import { useState } from 'react';
import ExerciseList from '../components/ExerciseList';

export default function TherapyPage() {
  const [session, setSession] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState(null);

  // STEP 2 & 3: Start session and get "Food for Thought"
  const startSession = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:5001/agent/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'horyzon' })
    });
    const data = await res.json();
    
    setSession({ 
      evidence: data.evidence, 
      user_id: 'horyzon' 
    });
    setChat([{ role: 'assistant', content: data.food_for_thought }]);
    setLoading(false);
  };

  // STEP 5: Main Chat Loop
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    const newChat = [...chat, userMsg];
    setChat(newChat);
    setInput("");
    setLoading(true);

    const res = await fetch('http://localhost:5001/agent/run_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'horyzon',
        message: input,
        transcript: chat,
        evidence: session.evidence
      })
    });
    const data = await res.json();
    setChat([...newChat, { role: 'assistant', content: data.therapy_response }]);
    setLoading(false);
  };

  // STEP 7: Wrap up and get Exercises
  const finishSession = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:5001/agent/end_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'horyzon',
        transcript: chat,
        evidence: session.evidence
      })
    });
    const data = await res.json();
    setExercises(data.exercises);
    setLoading(false);
  };

  if (exercises) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Session Complete</h2>
        <p className="mb-6 text-gray-600">Based on our talk, here are some exercises to help you move forward:</p>
        <ExerciseList exercises={exercises} />
        <button onClick={() => window.location.reload()} className="mt-8 text-blue-600 underline">Start New Session</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col gap-4">
      {!session ? (
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold mb-4">Ready for your session?</h1>
          <p className="mb-8 text-gray-500">I'll take a moment to review your recent journals first.</p>
          <button 
            onClick={startSession} 
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full transition-all"
          >
            {loading ? "Analyzing Journals..." : "Begin Therapy"}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4 h-[500px] overflow-y-auto border p-4 rounded-xl bg-white shadow-sm">
            {chat.map((m, i) => (
              <div key={i} className={`${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-gray-400 text-sm animate-pulse">Assistant is thinking...</div>}
          </div>
          
          <div className="flex gap-2">
            <input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your message..."
            />
            <button onClick={sendMessage} className="bg-blue-600 text-white px-6 rounded-lg font-medium">Send</button>
          </div>
          
          <button 
            onClick={finishSession} 
            className="mt-4 text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            End session and generate exercises →
          </button>
        </>
      )}
    </div>
  );
}
