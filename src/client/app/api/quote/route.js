export async function GET() {
  try {
    const res = await fetch("https://zenquotes.io/api/random", {
      next: { revalidate: 86400 },
    });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return new Response(
        JSON.stringify({ q: data[0].q, a: data[0].a }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ q: "", a: "" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(
      JSON.stringify({ q: "", a: "" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
