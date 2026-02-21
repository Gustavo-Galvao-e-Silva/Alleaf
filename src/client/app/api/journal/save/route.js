import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { userId, text, id } = await req.json();

    // No vectorization here! Just send the raw text to Python.
    const res = await fetch('http://localhost:5001/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        text: text,
        id: id
      })
    });

    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
