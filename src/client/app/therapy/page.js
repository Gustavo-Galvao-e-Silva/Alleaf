"use client";
import { useState, useEffect, useRef } from 'react';

import { useAuth } from "@clerk/nextjs"; // <--- ADD THIS

import { db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import ExerciseList from '../components/ExerciseList';

export default function TherapyPage() {
  const { userId } = useAuth();
  const [session, setSession] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState(null);
  const [userNotes, setUserNotes] = useState(""); // NEW
  
  // Ref for auto-scrolling the chat window
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notesFromURL = params.get('notes');
    if (notesFromURL) {
      setUserNotes(notesFromURL);
    }
  }, []);



  // STEP 2 & 3: Start session and get "Food for Thought" from Gemini via Research Node
  const startSession = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/therapy/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, userNotes: userNotes })
      });
      const data = await res.json();

      setSession({
        evidence: data.evidenceFound, // The clinical themes found in Actian
        user_id: userId,
        agenda: data.agenda
      });
      
      // The opening message generated in agents.py
      setChat([{ role: 'assistant', content: data.openingMessage }]);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  };

   const sendMessage = async () => {
     if (!input.trim() || loading) return;
   
     const userMsg = { role: 'user', content: input };
     const currentChat = [...chat, userMsg];
     setChat(prev => [...prev, userMsg, { role: 'assistant', content: "" }]);
     setInput("");
     setLoading(true);
   
     // Add an empty assistant message we will fill up
     setChat(prev => [...prev, { role: 'assistant', content: "" }]);
   
     const response = await fetch('/api/therapy/chat_stream', { // Hit a new streaming proxy
       method: 'POST',
       body: JSON.stringify({ userId: userId, message: input, transcript: currentChat, evidence: session.evidence, agenda: session.agenda })
     });
   
     const reader = response.body.getReader();
     const decoder = new TextDecoder();
     let fullReply = "";
   
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
   
       const chunk = decoder.decode(value);
       fullReply += chunk;
   
       // Update the LAST message in the chat array with the new chunk
       setChat(prev => {
         const newChat = [...prev];
         newChat[newChat.length - 1].content = fullReply;
         return newChat;
       });
     }
     setLoading(false);
   };




const finishSession = async () => {
  if (!userId) return;
  setLoading(true);
  try {
    const res = await fetch('/api/therapy/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId, 
        transcript: chat,
        evidence: session.evidence,
        agenda: session.agenda
      })
    });
    const data = await res.json();
    setExercises(data.exercises);

    // PERSISTENCE: Overwrite the Firestore document
    const planDocRef = doc(db, "users", userId, "plans", "current");
    await setDoc(planDocRef, {
      exercises: data.exercises,
      updatedAt: Date.now()
    }, { merge: true }); // 'merge' ensures we don't delete other user settings

  } catch (err) {
    console.error("Firestore save failed:", err);
  } finally {
    setLoading(false);
  }
};



  // Render Exercise Results View
  if (exercises) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-gray-900">Session Complete</h2>
          <p className="mt-2 text-gray-600">Based on our conversation, here are three tailored tools for you:</p>
        </header>
        <ExerciseList exercises={exercises} />
        <div className="mt-12 text-center">
          <button 
            onClick={() => window.location.reload()} 
            className="text-blue-600 font-medium hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col min-h-screen">
      {!session ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Start your session</h1>
          <p className="mb-8 text-gray-500 max-w-sm">
            I'll review your recent journal logs to help guide our conversation today.
          </p>
	      <textarea
  value={userNotes}
  onChange={(e) => setUserNotes(e.target.value)}
  placeholder="Today I want to talk about..."
  className="w-full p-4 mb-4 border rounded-xl text-sm"
/>
          <button
            onClick={startSession}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-full font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? "Reading Journals..." : "Begin Therapy"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-[85vh]">
          {/* Chat Window */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 mb-4">
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl shadow-sm max-w-[85%] ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                }`}>
                  <p className="leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-tl-none animate-pulse text-gray-400">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex gap-2 p-2 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 p-3 outline-none text-gray-700"
              placeholder="What's on your mind?"
              disabled={loading}
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </div>

          <button
            onClick={finishSession}
            className="mt-6 text-sm text-gray-400 hover:text-red-500 text-center transition-colors"
          >
            End session & view exercises
          </button>
        </div>
      )}
    </div>
  );
}
