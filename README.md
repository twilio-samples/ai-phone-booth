# Twilio AI Phone Booth (TAC Edition)

An AI voice agent for phone calls powered by [Twilio Agent Connect (TAC)](https://www.twilio.com/docs/agent-connect), OpenAI, and Twilio Conversation Intelligence. First built as a conference booth experience for **Twilio SIGNAL World Tour Berlin 2026**, where attendees could call a physical phone and chat with "Olivia," an AI barista at the Twilio Cafe.

The persona, menu, and most other booth-specific behavior are configurable per event rather than hardcoded — see [CONFIGURATION.md](CONFIGURATION.md) for the full list of options.

## What it does

- Initiates outbound calls to any phone number or SIP address, and automatically retries if the call comes back busy or no-answer
- Connects the caller to an AI agent (OpenAI Responses API via WebSocket) through Twilio Agent Connect
- The AI agent answers Twilio product questions, answers drink questions, and takes drink orders using function calling
- Can optionally look things up in a Twilio Knowledge Base to answer domain-specific questions
- Forwards submitted orders to an external order-fulfillment backend
- Tracks every call in Twilio Sync for real-time frontend updates
- Runs Conversation Intelligence to capture sentiment and summaries post-call
- Exposes a protected stats dashboard and a runtime config page for adjusting booth settings without redeploying

## Architecture

| File | Responsibility |
|------|----------------|
| [server.ts](server.ts) | Fastify HTTP/WebSocket server, TAC initialization, static file serving |
| [agent.ts](agent.ts) | OpenAI Responses API streaming, session state, tool execution, drink-type presets |
| [frontend.ts](frontend.ts) | API routes, Sync token generation, Conversation Intelligence callback, order fulfillment, stats dashboard, admin config API |
| [config.ts](config.ts) | Resolves runtime booth config — merges admin overrides over `.env` defaults |
| [sync.ts](sync.ts) | Twilio Sync helpers — call tracker map items and the booth config document |
| [scripts/reset-stats.ts](scripts/reset-stats.ts) | Utility to clear out call tracker Sync map items (`pnpm reset-stats`) |
| [public/](public/) | Static HTML pages for the booth UI |

### Agent tools

The agent drives everything through OpenAI function calling:

| Tool | What it does |
|------|-------------|
| `search_knowledge_base` | Looks up domain-specific facts in a configured Knowledge Base (only present if one is configured) |
| `complete_twilio_question` | Logs an answered Twilio product question |
| `complete_drink_question` | Logs an answered drink question |
| `submit_order` | Places a drink order, forwards it to the order-fulfillment backend, and returns an order number |
| `end_call` | Hangs up the call |

## Setup

### 1. Phone numbers

Open the [Twilio Console](https://console.twilio.com) and go to **Products & Services → Numbers & Senders → Overview**, then click **Set up a new phone number**.

You need two numbers, both with the **Voice** channel enabled:

- **Outbound number** (`TWILIO_PHONE_NUMBER`) — the Twilio number the system calls *from*
- **Destination** (`SIP_PHONE_ADDRESS`) — where the call is delivered:
  - **Testing**: any E.164 number you own (e.g. `+14155551234`)
  - **Production / event booth**: a SIP URI pointing to the physical phone (e.g. `sip:booth@your-pbx.example.com`)

### 2. Twilio cloud services

All steps below are in the [Twilio Console](https://console.twilio.com). Note the SIDs as you go — you'll need them in `.env`.

**API Key**

Go to **Develop → API Keys & Creds → API Keys & Auth Tokens** and click **Create API key**. Give it a name (e.g. `tac-voice`).

Save the Key SID (`SK...`) as `TWILIO_API_KEY` and the secret as `TWILIO_API_SECRET`.

**Sync Service**

Go to **Develop → Sync → Services** and click **Create new Sync Service**. Give it a name (e.g. `tac-voice`).

Save the Service SID (`IS...`) as `TWILIO_SYNC_SERVICE_SID`.

**Conversation Intelligence**

Go to **Products & Services → Conversation Intelligence → Intelligence Configurations** and click **Create Intelligence Configuration**. Follow these steps:

1. **Conversation configuration** — click **Create Conversation configuration** ([docs](https://www.twilio.com/docs/conversations/intelligence/create-intelligence-configuration)):
   - Give it a name (e.g. `tac-voice-conv`)
   - Group by: **Address**
   - Messaging/Chat traffic: leave empty
   - Ingestion: **Capture automatically (passive ingestion)**
   - Voice number: select your outbound Twilio number
   - Conversation lifecycle: **Basic**
   - Closed timeout: **On hangup**
   - Memory store: create a new one when prompted (give it a name, e.g. `tac-voice-mem`), then select it
   - Turn on **Observations and summaries**
   - Click **Create Conversation configuration**

2. **Intelligence configuration** — back on the main page, click **Create Intelligence configuration**:
   - Give it a name (e.g. `tac-voice-intel`)
   - Select the Conversation configuration you just created
   - Click **Submit**

3. **Rule** — click **Create rule**, then:
   - Select **Sentiment** and **Summary**, click **Next**
   - Set both rule parameters to **Automatic**, click **Next**
   - Trigger: **At conversation end**
   - Action webhook: point it at your deployment's `/intelligence-results` endpoint, HTTP POST
   - Click **Next**
   - On the **Add context** page, enable **Conversation Memory**
   - Click **Next**, review the summary, click **Create rule**

4. Once all three steps show as completed, click **Go to Intelligence configurations**. Find the entry you created and copy its SID (pattern: `intelligence_configuration_000aaabbb111`) — save it as `TWILIO_TAC_CI_CONFIGURATION_ID`.

5. **Conversation configuration SID** — go to **Products & Services → Conversation Orchestrator → Conversation Configurations**. Find the configuration created in step 1 and copy its SID (pattern: `conv_configuration_000aaabbb111`) — save it as `TWILIO_CONVERSATION_CONFIGURATION_ID`.

### 3. Order fulfillment backend

Orders placed by callers are forwarded to an external fulfillment backend — set `MIXOLOGIST_BASE_URL` and `MIXOLOGIST_AUTH` to point at it. This is required: the order-submission route has no fallback if these aren't set. See [CONFIGURATION.md](CONFIGURATION.md) for the payload shape.

### 4. Local development

Install dependencies and copy the env file:

```bash
pnpm install
cp .env.example .env
```

ngrok must be running before starting the server — Twilio needs a public HTTPS URL to send webhooks to your local machine:

```bash
ngrok http 8000
```

Copy the `https://` URL ngrok prints and set it as `NGROK_BASE_URL` in `.env`. Then fill in the remaining values from the steps above and start the server:

```bash
pnpm dev
```

The booth UI is at [http://localhost:8000](http://localhost:8000).

### 5. Deploying

Deploy to any host that can run a long-lived Node process and give it a public HTTPS URL. Set the environment variables from `.env.example` (see [CONFIGURATION.md](CONFIGURATION.md) for the full reference) in your hosting environment, then run:

```bash
pnpm start
```

The runtime config page persists changes and then restarts the process to apply them (see [CONFIGURATION.md](CONFIGURATION.md)). Whatever you deploy to needs to bring the process back up automatically when it exits — check that your host's restart/process-supervision policy does this, otherwise a config change will take the booth offline until someone restarts it manually.

## Maintenance

`pnpm reset-stats` clears out the call tracker Sync map used by the stats dashboard and the runtime config page's active-call count. Use it to reset stats between events without deleting the Sync service itself.
