export async function POST(req) {
  const body = await req.json();
  const res = await fetch('http://localhost:5001/agent/end_session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: body.userId,
        transcript: body.transcript,
        evidence: body.evidence
    })
  });
  const data = await res.json();
  return Response.json(data);
}
