import { NextResponse } from "next/server";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  addDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase";

export async function POST(req) {
  try {
    const payload = await req.json();
    const { action, userId } = payload;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId required" },
        { status: 400 }
      );
    }

    // --------------------
    // LIST MODE
    // --------------------
    if (action === "list") {
      const pageSize = payload.pageSize || 50;

      const q = query(
        collection(db, "users", userId, "journals"),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );

      const snap = await getDocs(q);

      const items = snap.docs.map((d) => {
        const data = d.data() || {};
        return { id: d.id, ...data };
      });

      return NextResponse.json({ success: true, items }, { status: 200 });
    }

    // --------------------
    // SAVE MODE (default)
    // --------------------
    const { title, body, type, prompt, id } = payload;

    if (!body || !body.trim()) {
      return NextResponse.json(
        { success: false, error: "body required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const data = {
      title: title || "Untitled",
      body,
      type: type || "free",     // "free" or "prompted"
      prompt: prompt || null,   // optional
      updatedAt: now,
      createdAt: now,
    };

    // If id provided: overwrite/update that doc (edit flow)
    if (id) {
      await setDoc(doc(db, "users", userId, "journals", String(id)), data, {
        merge: true,
      });
      return NextResponse.json({ success: true, id: String(id) }, { status: 200 });
    }

    // Otherwise: create a new entry with auto-id
    const ref = await addDoc(collection(db, "users", userId, "journals"), data);
    return NextResponse.json({ success: true, id: ref.id }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}