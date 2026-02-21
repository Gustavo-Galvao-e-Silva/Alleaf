import { NextResponse } from 'next/server';
import { pipeline } from '@xenova/transformers';

export async function POST(req) {
  try {
    const { userId, topic } = await req.json();

    // 1. Generate the Vector locally on your CPU
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await pipe(topic, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data);

    // 2. Fetch relevant entries from your Python Bridge
    const actianRes = await fetch('http://localhost:5001/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        vector: vector, 
        user_id: userId 
      }),
    });

    const entries = await actianRes.json();
    
    // Combine the retrieved logs into one "context" string
    const context = entries.map(e => e.text).join("\n---\n");

    // 3. Send to Ollama for the final summary
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama3",
        prompt: `Based on these journal entries:\n${context}\n\nSummarize the user's day regarding "${topic}" in one concise sentence.`,
        stream: false
      }),
    });

    const final = await ollamaRes.json();

    return NextResponse.json({ 
      summary: final.response,
      rawContext: context 
    });

  } catch (error) {
    console.error("Pipeline Error:", error);
    return NextResponse.json({ error: "Check if Bridge and Ollama are running" }, { status: 500 });
  }
}
