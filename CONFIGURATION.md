# Configuration

Every setting has an `.env` default (see `.env.example`). A subset of them — the ones that change per event rather than per deployment — can also be overridden at runtime from `/admin` without redeploying. Overrides are written to a Twilio Sync Document and merged over the `.env` defaults in `config.ts`; saving `/admin` restarts the process so the new values take effect.

## Environment variable reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Used for webhook signature validation only |
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | Yes | Used for all Twilio SDK calls and to mint Sync tokens for the browser |
| `TWILIO_PHONE_NUMBER` | Yes | The Twilio number outbound calls are placed from |
| `TWILIO_SYNC_SERVICE_SID` | Yes | Sync service holding the call tracker map and the `/admin` config document |
| `TWILIO_CONVERSATION_CONFIGURATION_ID` | Yes | Conversation Orchestrator configuration SID |
| `TWILIO_TAC_CI_CONFIGURATION_ID` | Yes | Conversation Intelligence configuration SID |
| `SIP_PHONE_ADDRESS` | Yes | Default call destination — an E.164 number or SIP URI |
| `OPENAI_API_KEY` | Yes | OpenAI API key for the Responses API |
| `NGROK_BASE_URL` | Yes (local dev) | Public HTTPS URL Twilio delivers webhooks to |
| `STATS_USER` / `STATS_PASS` | Yes | Basic auth for both `/stats` and `/admin` |
| `MIXOLOGIST_BASE_URL` / `MIXOLOGIST_AUTH` | Yes | Order-fulfillment backend base URL and `user:password` basic auth — see [Order fulfillment](#order-fulfillment) |
| `TWILIO_TAC_KNOWLEDGE_BASE_ID` | No | Knowledge base SID — see [Knowledge base](#knowledge-base) |
| `DRINK_TYPE` | No (admin-overridable) | See [Booth persona and menu](#booth-persona-and-menu) |
| `MENU_ITEMS` | No (admin-overridable) | See [Booth persona and menu](#booth-persona-and-menu) |
| `EVENT_NAME` | No (admin-overridable) | Lowercase-hyphenated identifier sent in order payloads |
| `EVENT_DISPLAY_NAME` | No (admin-overridable) | Human-readable event name mentioned in the agent's greeting and system prompt; omitted if unset |
| `ATTRACT_MODE` / `ATTRACT_DEV` | No (admin-overridable) | See [Attract mode](#attract-mode) |
| `ALLOW_PHONE_NUMBER_OVERRIDE` | No (admin-overridable) | See [Phone number override](#phone-number-override) |

## Runtime config via /admin

Visit `/admin` (protected by `STATS_USER`/`STATS_PASS`) to change the following without editing `.env` or redeploying: attract mode, phone number override, drink type, event name, event display name, and menu items. The page shows the current effective config and the number of active calls, validates input, writes it to the Sync document, and restarts the process to apply it.

## Booth persona and menu

`DRINK_TYPE` selects a persona preset (role label, venue label, icon, and hero image) and the default menu if `MENU_ITEMS` isn't set:

| `DRINK_TYPE` | Role | Venue | Icon |
|--------------|------|-------|------|
| `coffee` (default) | Barista | Twilio Cafe | ☕ |
| `smoothie` | Smoothie Bartender | Smoothie Bar | 🍹 |
| `drinks` | Mixologist | Cocktail Bar | 🍸 |

`MENU_ITEMS` is a comma-separated list; items with descriptions use `Name(ingredient, ingredient, ...)` syntax, e.g.:

```
Macarena(Strawberry, Pineapple, Apple, Passion Fruit, Goji, Vanilla),La Isla Bonita(Pineapple, Banana, Coconut Milk, Dates, Blue Spirulina)
```

## Attract mode

Attract mode is designed for unattended event booths. When no one is interacting with the screen, a popup appears after a random idle period inviting passers-by to pick up the phone. As soon as the physical phone is answered, the popup closes and the browser navigates to the live call view. Any interaction with the page (mouse move, keypress, touch) resets the idle timer.

| Variable | Effect |
|----------|--------|
| `ATTRACT_MODE=true` | Popup fires after a random 5–10 minute idle interval, then repeats |
| `ATTRACT_DEV=true` | Popup fires once after 20 seconds — useful for testing the flow without waiting |

## Phone number override

By default, every call goes to the fixed `SIP_PHONE_ADDRESS`. Setting `ALLOW_PHONE_NUMBER_OVERRIDE=true` lets visitors type their own destination number or SIP address on the start page instead — useful for testing or for setups without a single fixed booth phone.

## Order fulfillment

Orders are placed via the `submit_order` tool. When called, the backend POSTs to `{MIXOLOGIST_BASE_URL}/api/order` with basic auth from `MIXOLOGIST_AUTH`:

```json
{
  "event": "<EVENT_NAME>",
  "order": {
    "status": "queued",
    "key": "<timestamp>",
    "manual": true,
    "address": "Manual Order",
    "name": "AI Phone Booth",
    "item": "<menu item name>",
    "originalText": "",
    "modifiers": ["<modifier>", "..."]
  }
}
```

The order number returned in the response is read back to the caller. Both `MIXOLOGIST_BASE_URL` and `MIXOLOGIST_AUTH` must be set — there is no fallback if they're missing.

## Knowledge base

Custom knowledge can be inserted via a Twilio Knowledge Base. Set `TWILIO_TAC_KNOWLEDGE_BASE_ID` to inject a `search_knowledge_base` tool the agent can call to look up domain-specific facts before answering. If unset, the tool is not added and the agent relies only on its system prompt.
