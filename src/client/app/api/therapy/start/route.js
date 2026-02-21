import { NextResponse } from 'next/server';

export async function POST(req) {
  const { userId } = await req.json();

  // Call the Python agent's research node
  const res = await fetch('http://localhost:5001/agent/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });

  const data = await res.json();
  return NextResponse.json({
    openingMessage: data.food_for_thought,
    evidenceFound: data.evidence
  });
}
