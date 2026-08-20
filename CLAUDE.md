# tac-voice — Claude guidance

## Project overview

AI voice agent booth experience. Core source files:

- **server.ts** — Fastify server, TAC (Twilio Agent Connect) init, static files
- **agent.ts** — OpenAI Responses API WebSocket, session state, tool execution, drink-type presets
- **frontend.ts** — API routes, Sync token generation, Cintel callback, order fulfillment, stats dashboard, admin config API
- **config.ts** — merges `/admin` runtime overrides (Sync) over `.env` defaults
- **sync.ts** — Twilio Sync helpers (call tracker map, booth config document)

TypeScript, ES modules (`"type": "module"` in package.json). Run with `tsx`.

## Running locally

ngrok must be running before starting the server — Twilio needs a public URL to deliver webhooks:

```bash
pnpm install
cp .env.example .env   # fill in secrets
ngrok http 8000        # copy the https URL into NGROK_BASE_URL in .env
pnpm dev               # tsx server.ts
```

The UI is at `http://localhost:8000`. `SIP_PHONE_ADDRESS` is a comma-separated list of E.164 numbers and/or SIP URIs; `/admin` picks which one is active (see `boothConfig.ts` and `sipAddresses.ts`).

## Key design decisions

- **OpenAI Responses API** (not Chat Completions): streaming WebSocket for low-latency voice. The WebSocket is pre-warmed before a call starts.
- **Twilio Sync** is the shared state layer between backend and browser frontend. Every call is a Sync map item with a 7-day TTL.
- **Function calling** drives side effects: `submit_order`, `complete_drink_question`, `complete_twilio_question`, `end_call` (plus `search_knowledge_base` if a knowledge base is configured). These are OpenAI tools that call back into `frontend.ts` routes.
- Responses are kept short (1–2 sentences) because this runs over a phone call — no markdown, no lists.

## Agent behavior

The agent is "Olivia." Her role and venue label depend on `DRINK_TYPE` (`coffee` → Barista at Twilio Cafe, `smoothie` → Smoothie Bartender, `drinks` → Mixologist at a Cocktail Bar) — see `DRINK_TYPE_PRESETS` in `agent.ts`. The system prompt is defined in `agent.ts`. It handles:
- Twilio product questions (answered directly, plus an optional knowledge-base lookup)
- Drink questions (brewing, ingredients, preferences) for whichever drink type is configured
- Order taking from the configured menu (`MENU_ITEMS` env var, or the `DRINK_TYPE` default) — forwarded to the "Mixologist" fulfillment backend

Drink type, event name/display name, and menu are configurable per event via `.env` or at runtime via `/admin` — see `config.ts` and CONFIGURATION.md. Do not change the persona or menu without understanding the full event context.

## AI model

The OpenAI model is set in `agent.ts`. The variable is named `model` — do not rename it to something like `gpt-4o` unless you are intentionally changing the model. The current value is intentional.

## Environment variables

All required variables are in `.env.example`. Key ones:

- `NGROK_BASE_URL` — must be set for Twilio webhooks to reach the server
- `TWILIO_SYNC_SERVICE_SID` — shared between backend and browser Sync client, and holds the `/admin` config document
- `TWILIO_API_KEY` / `TWILIO_API_SECRET` — used to mint Sync tokens for the browser
- `MIXOLOGIST_BASE_URL` / `MIXOLOGIST_AUTH` — required; order submission has no fallback without these
- `ADMIN_USER` / `ADMIN_PASS` — basic auth for both `/admin` and `/stats`
- `DRINK_TYPE` / `EVENT_NAME` / `EVENT_DISPLAY_NAME` / `MENU_ITEMS` — booth persona/menu config, all overridable at runtime via `/admin` (persisted to Sync, applied by restarting the process — see `config.ts`)
- `SIP_PHONE_ADDRESS` — comma-separated call destination candidates, fixed at deploy time; which one is *active* is admin-overridable the same way (see `boothConfig.ts`'s stale-selection fallback logic)

## Common tasks

**Add a new agent tool:**
1. Define the tool schema in the `tools` array in `agent.ts`
2. Add a handler in the `tool_call` dispatch block in `agent.ts`
3. If it needs a backend side effect, add a route in `frontend.ts` and call it from the handler

**Change the system prompt:**
Edit the `instructions` string in `agent.ts`. Keep responses short — this is a phone call.

**Add a new API route:**
Add it in `frontend.ts`. Routes are registered on the Fastify instance passed from `server.ts`.

**Update the stats dashboard:**
Stats are aggregated from Twilio Sync map items in `frontend.ts`. The dashboard HTML is `public/stats.html`.

## What to avoid

- Do not add session persistence outside Twilio Sync — it is the single source of truth for call state.
- Do not add Twilio webhook endpoints without registering them in `NGROK_BASE_URL`-relative URLs.
- Do not make the AI responses longer or add markdown formatting — responses go to a phone caller.
- Do not remove the WebSocket pre-warming logic in `agent.ts` — it is intentional for latency.
