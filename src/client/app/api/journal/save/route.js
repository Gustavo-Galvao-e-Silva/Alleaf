import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const data = await req.json();
    
    // We'll just return success for now to test the route
    return NextResponse.json({ 
      message: "Route is working!", 
      received: data.text 
    });
  } catch (err) {
    return NextResponse.json({ error: "JSON Parsing Failed: " + err.message }, { status: 500 });
  }
}
