import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    // 1. Add 'agenda' to the destructured body
    const { messages, userId, userNotes, agenda } = body; 

    const userText = messages?.[messages.length - 1]?.content || "Hello";

    const bridgeRes = await fetch('http://localhost:5001/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message: userText,
        notes: userNotes || "",
        transcript: messages,
        // 2. Pass the agenda to the Python Bridge
        agenda: agenda || "" 
      })
    });

    if (!bridgeRes.ok) {
        throw new Error(`Python Bridge returned ${bridgeRes.status}`);
    }

    const data = await bridgeRes.json();

    // 2. Stream the response back to the professional UI
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: ({ writer }) => {
        const blockId = `text-${Date.now()}`;
        writer.write({ type: "text-start", id: blockId });
        writer.write({ type: "text-delta", id: blockId, delta: data.reply });
        writer.write({ type: "text-end", id: blockId });
      },
    });

    return createUIMessageStreamResponse({ stream });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Clinical engine connection failed" }, { status: 500 });
  }
}
