import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const data = await req.json();
    console.log("Data received in Next.js:", data);

    // This is where you talk to your Python bridge
    const res = await fetch('http://localhost:5001/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: data.id || Date.now(),
        text: data.text,
        user_id: data.userId,
        vector: Array(384).fill(0.1) // Temporary: Use real embeddings later
      })
    });

    if (!res.ok) throw new Error("Bridge connection failed");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
