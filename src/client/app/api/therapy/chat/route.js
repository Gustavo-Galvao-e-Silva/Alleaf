// src/client/app/api/therapy/chat/route.js
export async function POST(req) {
  const { userId, message } = await req.json();

  const res = await fetch('http://localhost:5001/agent/run_session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: userId, // Match Python's 'user_id'
        message: message  // Match Python's 'message'
    })
  });

  if (!res.ok) {
      const errorText = await res.text();
      console.error("Python Bridge Error:", errorText);
      throw new Error("Bridge failed");
  }

  const data = await res.json();
  return Response.json({ reply: data.therapy_response });
}
