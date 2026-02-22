export async function POST(req) {
  try {
    const body = await req.json();

    const res = await fetch('http://localhost:5001/agent/end_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          user_id: body.userId,
          transcript: body.transcript,
          evidence: body.evidence,
	  agenda: body.agenda
      })
    });

    if (!res.ok) throw new Error("Bridge failed");

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
