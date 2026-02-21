import { NextResponse } from 'next/server';
import { pipeline } from '@xenova/transformers';

export async function POST(req) {
  try {
    const { text, userId } = await req.json();

    // 1. Vectorize the journal entry
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data);

    // 2. Send to Python Bridge to save in Actian
    const response = await fetch('http://localhost:5001/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: Date.now(), // Unique ID
        text: text,
        user_id: userId,
        vector: vector
      })
    });

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
