import Anthropic from '@anthropic-ai/sdk';
import { AI_TOOLS, AI_TOOL_HANDLERS, PRESENTABLE_TOOLS, summarizeForModel } from './aiTools.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `You are the ActivSwitzerland travel assistant. You help visitors plan trips to \
Switzerland: destinations and things to do, weather, hiking/biking trails, and public transport \
connections.

Rules:
- Use the tools available to you rather than answering from general knowledge — trail distances, \
weather, and transport times must come from a tool call, never a guess.
- Most tools need coordinates or an id, not a place name. Call resolve_location first whenever a \
place name appears in the conversation and you don't already have its id/coordinates from context \
or an earlier tool result in this conversation.
- If a request needs a location (or another required detail) and it isn't given, isn't in the \
current context note, and isn't in the conversation so far, ask the user which location they mean \
instead of guessing or defaulting to "all of Switzerland" — a broad, unfocused answer is worse than \
a short clarifying question.
- When a request is genuinely ambiguous in another way (e.g. "biking" — road or mountain?), ask \
rather than picking one.
- resolve_location often returns several candidates for one name (e.g. "Bern" the city, "Bern \
Region", "Bernese Oberland"). If it's not obvious which one the user means, ask them to pick \
before calling any further tool with a guessed id — don't call another tool speculatively and \
find out it was the wrong place.
- If a tool call fails or comes back empty, never mention the failure, an error, or anything \
technical to the user — they don't need or want to know a request failed internally. Just try a \
different reasonable approach, or ask a plain clarifying question as if you simply need more \
detail to help (e.g. "Which Bern did you mean — the city or the wider region?"), never "I got an \
error" or "I'm having trouble retrieving that."
- Keep answers concise and concrete. When you found specific hikes, bike routes, a forecast, or \
train connections worth surfacing, the app renders those as cards right below your reply — never \
restate exact dates, temperatures, distances, or departure/arrival times from a tool result \
yourself (you're unreliable at transcribing numbers out of a list, and the card is already showing \
the real figures). Give a brief qualitative take instead ("looks like good hiking weather", "two \
options nearby, one longer than the other", "a direct-ish route, about 2 hours") and let the card \
carry the numbers.
- If asked for the stop-by-stop leg detail of a specific train connection, you don't have that \
detail yourself — tell the user to tap that connection in the card to expand it, rather than \
saying you're missing the data or offering to fetch it a different way.
- You cannot create, save, or modify trips, bookings, or any other user data. You only answer and \
recommend.`;

const MODEL = 'claude-sonnet-5';

function cardsFromToolResult(toolName, input, result) {
  if (toolName === 'get_weather') {
    // lat/lon come from the tool call's own args (not the Open-Meteo response) so the frontend
    // can open the real weather drawer for the same location on tap.
    return [{ type: 'weather', data: result, lat: input.lat, lon: input.lon }];
  }
  if (toolName === 'get_transit_connections') {
    // Full untrimmed connections (sections included) for the card — the model only ever reads
    // the trimmed summary (see summarizeForModel), but the card needs real per-leg detail so a
    // "show me the legs of the 12:08" follow-up can be answered by expanding the card itself
    // rather than asking the model to narrate stop-by-stop timing it was never given.
    const connections = (Array.isArray(result) ? result : []).slice(0, 3);
    return connections.length ? [{ type: 'connections', connections, from: input.from, to: input.to }] : [];
  }
  if (toolName === 'get_destination_info') {
    // `result.destination` is the full raw MySwitzerland record (untrimmed — summarizeForModel
    // only trims what the model itself reads), so it's exactly what destination-detail expects.
    if (!result?.destination) return [];
    const cards = [{ type: 'destination', destination: result.destination }];
    if (result.attractions?.length) {
      cards.push({ type: 'attractions', destination: result.destination, count: result.attractions.length });
    }
    return cards;
  }
  const type = toolName === 'search_bikes' ? 'bike' : 'hike';
  return (Array.isArray(result) ? result : []).slice(0, 2).map(route => ({ type, route }));
}

async function requestTurn(messages) {
  return client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    tools: AI_TOOLS,
    messages,
  });
}

// `messages` already ends with the new user turn (the caller — controllers/ai.js — appends it
// before calling this); `context` is a short free-text note ("Viewing the Staubbachfall Trail,
// Lauterbrunnen") folded into that same turn, never a separate/mid-conversation message, so it
// only ever applies to the newest question. `onStatus(toolName, input)`, if given, fires
// synchronously right before each tool call executes — lets the caller stream a "Checking the
// forecast…" progress update to the client instead of a single opaque wait.
export async function runConversation({ messages, context, onStatus }) {
  const working = messages.map(m => ({ ...m }));
  if (context) {
    const last = working[working.length - 1];
    if (last?.role === 'user' && typeof last.content === 'string') {
      last.content = `[Current context: ${context}]\n\n${last.content}`;
    }
  }

  const cards = [];
  let response = await requestTurn(working);
  working.push({ role: 'assistant', content: response.content });

  while (response.stop_reason === 'tool_use') {
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      onStatus?.(block.name, block.input);
      const handler = AI_TOOL_HANDLERS[block.name];
      try {
        const result = await handler(block.input);
        if (PRESENTABLE_TOOLS.has(block.name)) {
          cards.push(...cardsFromToolResult(block.name, block.input, result));
        }
        const forModel = summarizeForModel(block.name, result);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(forModel) });
      } catch (error) {
        toolResults.push({
          type: 'tool_result', tool_use_id: block.id,
          content: String(error?.message || error), is_error: true,
        });
      }
    }
    working.push({ role: 'user', content: toolResults });

    response = await requestTurn(working);
    working.push({ role: 'assistant', content: response.content });
  }

  const text = response.content.find(b => b.type === 'text')?.text ?? '';
  return { text, cards, messages: working };
}
