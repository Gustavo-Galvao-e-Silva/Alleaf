import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_AGENT_ID = "agent_8001kj0ycbc0e6984qw4vbj1pgaj";
const WS_RESPONSE_IDLE_MS = 550;
const WS_TOTAL_TIMEOUT_MS = 20000;
const AGENT_REPLY_RETRIES = 1;
const MAX_CONTEXT_ITEMS = 12;
const MAX_CONTEXT_CHARS_PER_ITEM = 800;

function isRecord(value) {
  return value !== null && typeof value === "object";
}

function parseIncomingText(message) {
  if (!isRecord(message)) return "";

  if (typeof message.content === "string") {
    return message.content.trim();
  }

  const parts = [];

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!isRecord(part)) continue;
      if (typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }

  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (!isRecord(part)) continue;
      if (part.type === "text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function getLatestUserText(messages) {
  if (!Array.isArray(messages)) return "";

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || message.role !== "user") continue;
    const text = parseIncomingText(message);
    if (text) return text;
  }

  return "";
}

function normalizeContextItems(contextItems) {
  if (!Array.isArray(contextItems)) return [];

  const normalized = [];

  for (const item of contextItems) {
    if (normalized.length >= MAX_CONTEXT_ITEMS) break;

    if (typeof item === "string") {
      const text = item.trim();
      if (!text) continue;
      normalized.push(text.slice(0, MAX_CONTEXT_CHARS_PER_ITEM));
      continue;
    }

    if (!isRecord(item)) continue;

    if (typeof item.text === "string") {
      const text = item.text.trim();
      if (!text) continue;
      normalized.push(text.slice(0, MAX_CONTEXT_CHARS_PER_ITEM));
      continue;
    }

    const serialized = JSON.stringify(item);
    if (!serialized || serialized === "{}") continue;
    normalized.push(serialized.slice(0, MAX_CONTEXT_CHARS_PER_ITEM));
  }

  return normalized;
}

function buildAgentInputText({ userText, contextItems }) {
  if (!contextItems.length) return userText;

  const contextBlock = contextItems
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return `Session context:\n${contextBlock}\n\nUser message:\n${userText}`;
}

async function getSignedUrl({ apiKey, agentId }) {
  const endpoint = new URL(`${ELEVENLABS_API_BASE}/convai/conversation/get-signed-url`);
  endpoint.searchParams.set("agent_id", agentId);

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `ElevenLabs signed URL failed (${response.status}): ${details || "Unknown error"}`,
    );
  }

  const payload = await response.json();
  if (!payload?.signed_url) {
    throw new Error("ElevenLabs signed URL response did not include signed_url");
  }

  return payload.signed_url;
}

function buildUiTextResponse({ text, originalMessages }) {
  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const blockId = `text-${Date.now()}`;
      writer.write({ type: "text-start", id: blockId });
      writer.write({ type: "text-delta", id: blockId, delta: text });
      writer.write({ type: "text-end", id: blockId });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function getAgentTextReply({ signedUrl, userText }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let closedByServer = false;
    let closeCode = 0;
    let closeReason = "";
    let hasSentUserMessage = false;
    let hasReceivedMetadata = false;
    let initFallbackTimer;
    let idleTimer;
    let timeoutTimer;
    let latestResponse = "";
    const socket = new WebSocket(signedUrl);

    const toUtf8String = async (rawData) => {
      if (typeof rawData === "string") return rawData;
      if (rawData instanceof ArrayBuffer) {
        return Buffer.from(rawData).toString("utf8");
      }
      if (ArrayBuffer.isView(rawData)) {
        return Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength).toString("utf8");
      }
      if (typeof Blob !== "undefined" && rawData instanceof Blob) {
        return await rawData.text();
      }
      return "";
    };

    const cleanup = () => {
      clearTimeout(initFallbackTimer);
      clearTimeout(idleTimer);
      clearTimeout(timeoutTimer);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
    };

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close();
      }
      cleanup();
      handler(value);
    };

    const resolveIfReady = () => {
      const message = latestResponse.trim();
      if (!message) return;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else {
        finish(resolve, message);
      }
    };

    const refreshIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        resolveIfReady();
      }, WS_RESPONSE_IDLE_MS);
    };

    timeoutTimer = setTimeout(() => {
      finish(reject, new Error("Timed out waiting for ElevenLabs response"));
    }, WS_TOTAL_TIMEOUT_MS);

    const sendUserMessage = () => {
      if (hasSentUserMessage || socket.readyState !== WebSocket.OPEN) return;
      hasSentUserMessage = true;
      socket.send(
        JSON.stringify({
          type: "user_message",
          text: userText,
        }),
      );
    };

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            conversation: {
              text_only: true,
            },
          },
        }),
      );

      // Fallback for agents/environments that do not emit metadata event.
      initFallbackTimer = setTimeout(() => {
        sendUserMessage();
      }, 500);
    };

    socket.onmessage = async (event) => {
      let payload;
      try {
        const decoded = await toUtf8String(event.data);
        payload = JSON.parse(decoded);
      } catch {
        return;
      }

      if (!isRecord(payload)) return;

      if (payload.type === "conversation_initiation_metadata") {
        hasReceivedMetadata = true;
        sendUserMessage();
        return;
      }

      if (payload.type === "ping") {
        const eventId = payload.ping_event?.event_id;
        socket.send(
          JSON.stringify(
            eventId
              ? {
                  type: "pong",
                  event_id: eventId,
                }
              : { type: "pong" },
          ),
        );
        return;
      }

      if (payload.type === "agent_response") {
        if (!hasSentUserMessage) return;
        const responseText = payload.agent_response_event?.agent_response;
        if (typeof responseText === "string" && responseText.trim().length > 0) {
          const normalized = responseText.trim();
          if (!latestResponse) {
            latestResponse = normalized;
          } else if (normalized.startsWith(latestResponse)) {
            latestResponse = normalized;
          } else if (!latestResponse.includes(normalized)) {
            latestResponse = `${latestResponse} ${normalized}`.trim();
          }
          refreshIdleTimer();
        }
        return;
      }

      if (payload.type === "agent_response_correction") {
        if (!hasSentUserMessage) return;
        const correctionEvent = payload.agent_response_correction_event;
        const correctionText =
          correctionEvent?.corrected_agent_response ||
          correctionEvent?.agent_response ||
          Object.values(correctionEvent || {}).find((value) => typeof value === "string");

        if (typeof correctionText === "string" && correctionText.trim().length > 0) {
          latestResponse = correctionText.trim();
          refreshIdleTimer();
        }
        return;
      }

      if (payload.type === "conversation_end") {
        closedByServer = true;
        const text = latestResponse.trim();
        if (text) {
          finish(resolve, text);
        } else {
          finish(reject, new Error("ElevenLabs ended the conversation without text output"));
        }
      }
    };

    socket.onerror = () => {
      finish(reject, new Error("WebSocket error while talking to ElevenLabs"));
    };

    socket.onclose = (event) => {
      closeCode = event?.code ?? 0;
      closeReason = event?.reason ?? "";
      const text = latestResponse.trim();
      if (text) {
        finish(resolve, text);
        return;
      }

      if (!closedByServer) {
        const metadataState = hasReceivedMetadata
          ? "after metadata"
          : "before metadata";
        finish(
          reject,
          new Error(
            `No text response received ${metadataState}${closeCode ? ` (code ${closeCode}${closeReason ? `: ${closeReason}` : ""})` : ""}`,
          ),
        );
      }
    };
  });
}

async function getAgentTextReplyWithRetry({ apiKey, agentId, userText }) {
  let lastError;

  for (let attempt = 0; attempt <= AGENT_REPLY_RETRIES; attempt += 1) {
    try {
      const signedUrl = await getSignedUrl({ apiKey, agentId });
      return await getAgentTextReply({
        signedUrl,
        userText,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function POST(req) {
  let body = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const inputMode = body?.input_mode === "speech" ? "speech" : "text";
  const contextItems = normalizeContextItems(body?.context_items);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID || DEFAULT_AGENT_ID;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY environment variable" },
      { status: 500 },
    );
  }

  if (inputMode === "speech") {
    try {
      const signed_url = await getSignedUrl({ apiKey, agentId });
      return NextResponse.json({ signed_url, agent_id: agentId });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to create speech session",
        },
        { status: 500 },
      );
    }
  }

  const userText = getLatestUserText(messages);
  if (!userText) {
    return NextResponse.json(
      { error: "No user text found in request payload" },
      { status: 400 },
    );
  }

  const requestText = buildAgentInputText({
    userText,
    contextItems,
  });

  try {
    const agentReply = await getAgentTextReplyWithRetry({
      apiKey,
      agentId,
      userText: requestText,
    });

    return buildUiTextResponse({
      text: agentReply,
      originalMessages: messages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get text response from ElevenLabs",
      },
      { status: 500 },
    );
  }
}
