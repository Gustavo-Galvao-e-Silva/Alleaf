"use client";
import { useState } from 'react';
import ExerciseList from '../components/ExerciseList';

export default function TherapyPage() {
  const [session, setSession] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState(null);

  const startSession = async () => {
    setLoading(true);
    const res = await fetch('/api/therapy/start', {
      method: 'POST',
      body: JSON.stringify({ userId: 'horyzon' })
    });
    const data = await res.json();
    setSession(data);
    setChat([{ role: 'assistant', content: data.openingMessage }]);
    setLoading(false);
  };

  const sendMessage = async () => {
    const newChat = [...chat, { role: 'user', content: input }];
    setChat(newChat);
    setInput("");
    
    const res = await fetch('/api/therapy/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: 'horyzon', 
        message: input,
        transcript: chat,
        evidence: session.evidenceFound
      })
    });
    const data = await res.json();
    setChat([...newChat, { role: 'assistant', content: data.reply }]);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col gap-4">
      {!session ? (
        <button onClick={startSession} className="bg-green-600 text-white p-4 rounded">
          {loading ? "Researching..." : "Start Session"}
        </button>
      ) : (
        <>
          <div className="space-y-4 h-96 overflow-y-auto border p-4 rounded">
            {chat.map((m, i) => (
              <div key={i} className={`${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                <span className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                  {m.content}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 border p-2 rounded" />
            <button onClick={sendMessage} className="bg-blue-600 text-white px-4 rounded">Send</button>
          </div>
        </>
      )}
    </div>
  );
}
