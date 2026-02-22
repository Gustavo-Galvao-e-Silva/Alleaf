export async function POST(req) {
  const body = await req.json();

  const res = await fetch('http://localhost:5001/agent/chat_stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return new Response("Bridge Connection Failed", { status: 500 });

  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
