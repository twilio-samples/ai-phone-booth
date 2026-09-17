import { config } from "dotenv";
import Fastify from "fastify";
import { TAC, TACConfig, TACServer, VoiceChannel, createLogger } from "twilio-agent-connect";
import { clearConversation, handleMessage, promoteSession, warmSession, WELCOME_GREETING } from "./agent.ts";
import { registerFrontendRoutes } from "./frontend.ts";

config();

const silentLogger = createLogger({ level: "silent" });

const tac = await TAC.create({
  config: TACConfig.fromEnv(),
  logger: silentLogger,
});
const voiceChannel = new VoiceChannel(tac, { memoryMode: "always" });

tac.registerChannel(voiceChannel);

// Map conversationId → callSid so the agent can terminate calls
const callSidByConversationId = new Map<string, string>();
let pendingCallSid: string | undefined;
const pendingCallInfo = new Map<string, { agentPhone: string }>();

let cachedMemoryStoreId: string | undefined;

async function getMemoryStoreId(auth: string): Promise<string | undefined> {
  if (cachedMemoryStoreId) return cachedMemoryStoreId;
  const configId = process.env.TWILIO_CONVERSATION_CONFIGURATION_ID!;
  const res = await fetch(
    `https://conversations.twilio.com/v2/ControlPlane/Configurations/${configId}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) return undefined;
  const { memoryStoreId } = (await res.json()) as { memoryStoreId?: string };
  cachedMemoryStoreId = memoryStoreId;
  return memoryStoreId;
}

async function fixParticipantRoles(conversationId: string, agentPhone: string): Promise<void> {
  const apiKey = process.env.TWILIO_API_KEY!;
  const apiSecret = process.env.TWILIO_API_SECRET!;
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
  const convBase = "https://conversations.twilio.com";
  const memBase = "https://memory.twilio.com";

  const storeId = await getMemoryStoreId(auth);

  const listRes = await fetch(`${convBase}/v2/Conversations/${conversationId}/Participants`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!listRes.ok) return;

  type Participant = {
    id: string;
    type?: string;
    profileId?: string | null;
    addresses?: Array<{ channel: string; address: string; channelId?: string }>;
  };
  const { participants } = (await listRes.json()) as { participants: Participant[] };

  for (const p of participants) {
    const voiceAddr = p.addresses?.find((a) => a.channel === "VOICE")?.address;
    if (!voiceAddr) continue;
    const isAgent = voiceAddr === agentPhone;
    const targetType = isAgent ? "AI_AGENT" : "CUSTOMER";

    const body: { type: string; addresses: unknown; profileId?: string } = {
      type: targetType,
      addresses: p.addresses,
    };

    // For the customer, create (or resolve) a memory profile and link it. The
    // Memory API is idempotent by identifier — a repeat call for the same
    // phone returns the existing profile ID.
    if (!isAgent && storeId && !p.profileId) {
      const profRes = await fetch(`${memBase}/v1/Stores/${storeId}/Profiles`, {
        method: "POST",
        headers,
        body: JSON.stringify({ traits: { Contact: { phone: voiceAddr } } }),
      });
      if (profRes.ok) {
        const { id } = (await profRes.json()) as { id?: string };
        if (id) body.profileId = id;
      }
    }

    if (p.type === targetType && !body.profileId) continue;

    await fetch(`${convBase}/v2/Conversations/${conversationId}/Participants/${p.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
  }
}

voiceChannel.on("setup", ({ callSid, from }: { callSid: string; from?: string }) => {
  pendingCallSid = callSid;
  if (from) pendingCallInfo.set(callSid, { agentPhone: from });
  warmSession(callSid);
});

voiceChannel.on(
  "webSocketConnected",
  ({ conversationId }: { conversationId: string }) => {
    if (pendingCallSid) {
      callSidByConversationId.set(conversationId, pendingCallSid);
      promoteSession(pendingCallSid, conversationId, () => callSidByConversationId.get(conversationId));
      const info = pendingCallInfo.get(pendingCallSid);
      if (info) {
        pendingCallInfo.delete(pendingCallSid);
        fixParticipantRoles(conversationId, info.agentPhone)
          .catch((err: unknown) => console.error(`[${conversationId}] fixParticipantRoles failed:`, err));
      }
      pendingCallSid = undefined;
    }
  },
);

voiceChannel.on(
  "webSocketDisconnected",
  ({ conversationId }: { conversationId: string }) => {
    callSidByConversationId.delete(conversationId);
    pendingCallInfo.delete(conversationId);
  },
);

tac.onMessageReady(async ({ conversationId, message, memory, session }) => {
  const convId = conversationId as string;
  const stream = handleMessage(
    convId,
    message,
    memory,
    session,
    () => callSidByConversationId.get(convId),
  );
  
  await voiceChannel.sendStreamingResponse(conversationId, stream);
  return null;
});

tac.onConversationEnded(({ session }) => {
  clearConversation(session.conversationId as string);
});

const app = Fastify({ logger: { level: "warn" }, trustProxy: true });

// Twilio webhooks POST application/x-www-form-urlencoded
app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_, body, done) => {
    try {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    } catch (err) {
      done(err as Error);
    }
  },
);

app.get("/health", async () => ({ status: "ok" }));

// Frontend API routes + WebSocket handlers
await registerFrontendRoutes(app);

// Serve public/ folder (scenario.html, call.html, assets)
await app.register(import("@fastify/static"), {
  root: new URL("./public", import.meta.url).pathname,
  prefix: "/",
});

const server = new TACServer(tac, {
  fastifyInstance: app,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8000,
  conversationRelayConfig: {
    welcomeGreeting:
      WELCOME_GREETING,
    welcomeGreetingInterruptible: "any",
    // transcriptionProvider: "Deepgram",
    // speechModel: "flux",
    language: "multi",
    elevenlabsTextNormalization: "on",
    ttsProvider: "ElevenLabs",
    voice: "ZF6FPAbjXT4488VcRRnw-flash_v2_5-1.0_1.0_1.0",
  },
});
await server.start();
