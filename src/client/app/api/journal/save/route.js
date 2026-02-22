import { db } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, getDocs, orderBy } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, title, body: journalBody, text, type, prompt, action, id } = body;

    // --- 1. LISTING HISTORY ---
    if (action === "list") {
      const q = query(
        collection(db, "users", userId, "journals"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAtIso;

        // BULLETPROOF TIMESTAMP CHECK
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAtIso = data.createdAt.toDate().toISOString();
        } else if (data.createdAt instanceof Date) {
          createdAtIso = data.createdAt.toISOString();
        } else {
          // Fallback if timestamp is missing or a string
          createdAtIso = data.createdAt || new Date().toISOString();
        }

        return {
          id: doc.id,
          ...data,
          createdAt: createdAtIso
        };
      });

      return NextResponse.json({ items });
    }

    // --- 2. SAVING NEW ENTRY ---
    
    // Save to Firestore for History
    const docRef = await addDoc(collection(db, "users", userId, "journals"), {
      title,
      body: journalBody,
      type,
      prompt: prompt || null,
      createdAt: serverTimestamp(),
      preview: journalBody.length > 80 ? journalBody.slice(0, 80) + "…" : journalBody
    });

    // Save to Vector DB for AI Memory
    try {
      await fetch('http://localhost:5001/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          text: text, // This is Title + Content
          id: id || Date.now()
        })
      });
    } catch (pythonError) {
      console.error("Vector DB sync failed, but Firestore saved.");
    }

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error) {
    console.error("Journal API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
