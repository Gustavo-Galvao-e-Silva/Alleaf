import { NextResponse } from 'next/server';

export async function POST(req) {
  const { userId, userNotes } = await req.json(); // Capture userNotes

  const res = await fetch('http://localhost:5001/agent/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: userId, 
      user_notes: userNotes // Pass it to Flask
    })
  });

  const data = await res.json();
  return NextResponse.json({
    openingMessage: data.food_for_thought,
    evidenceFound: data.evidence,
    agenda: data.agenda // Pass the generated agenda back to the frontend
  });
}
