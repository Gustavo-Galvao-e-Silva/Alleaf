export async function POST(req) {
  const { userId, message, transcript, evidence } = await req.json();

  const res = await fetch('http://localhost:5001/agent/run_session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: userId,
        message: message,
        transcript: transcript, // Pass history back to Python
        evidence: evidence      // Pass evidence back to Python
    })
  });

  if (!res.ok) throw new Error("Bridge failed");

  const data = await res.json();
  return Response.json({
    reply: data.therapy_response,
    fullTranscript: data.full_transcript
  });
}
