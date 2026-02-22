const FLASK_URL = process.env.FLASK_URL ?? "http://localhost:8080";

export async function POST(req) {
  try {
    const body = await req.json();
    const { userData, currentRR } = body;

    if (!currentRR || !Array.isArray(currentRR) || currentRR.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty currentRR array" }),
        { status: 400 },
      );
    }

    const flaskRes = await fetch(`${FLASK_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userData, currentRR }),
    });

    const result = await flaskRes.json();
    return new Response(JSON.stringify(result), {
      status: flaskRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[heart-data] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
