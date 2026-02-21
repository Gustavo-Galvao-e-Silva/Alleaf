export async function POST(req) {
  const { userId, message } = await req.json();

  // We call a new Python endpoint that runs the LangGraph workflow
  const response = await fetch('http://localhost:5001/agent/run_session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, input: message })
  });

  const data = await response.json();
  
  return Response.json({
    reply: data.therapy_response,
    patientFile: data.clinical_file // We return this so the UI can show the "Truth"
  });
}
