import { db } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, title, body: journalBody, text, type, prompt, action, id } = body;

    // --- CASE 1: LISTING HISTORY (Triggered when you click the History tab) ---
    if (action === "list") {
      const q = query(
        collection(db, "users", userId, "journals"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }));
      return NextResponse.json({ items });
    }

    // --- CASE 2: SAVING NEW ENTRY (The "Double Save") ---
    
    // 1. Save to Firestore (For the UI/History tab)
    const docRef = await addDoc(collection(db, "users", userId, "journals"), {
      title,
      body: journalBody,
      type,
      prompt: prompt || null,
      createdAt: serverTimestamp(),
      preview: journalBody.length > 80 ? journalBody.slice(0, 80) + "…" : journalBody
    });

    // 2. Save to Vector DB via Python Bridge (For AI Therapist Memory)
    try {
      await fetch('http://localhost:5001/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          text: text, // This is the "Title + Content" string Gemini needs
          id: id || Date.now()
        })
      });
    } catch (pythonError) {
      console.error("Python Bridge unreachable, but Firestore saved.");
    }

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error) {
    console.error("Journal API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
