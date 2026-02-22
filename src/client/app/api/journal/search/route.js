import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { userId, query } = await req.json();
    const res = await fetch('http://localhost:5001/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, query: query })
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
