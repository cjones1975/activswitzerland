import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// Every nested object needs its own explicit `additionalProperties: false` — the API rejects
// a schema where only the top level sets it.
const LOCALE_FIELDS_SCHEMA = {
    type: 'object',
    properties: { name: { type: 'string' }, review: { type: 'string' } },
    required: ['name', 'review'],
    additionalProperties: false,
};

const TRANSLATION_SCHEMA = {
    type: 'object',
    properties: {
        de: LOCALE_FIELDS_SCHEMA,
        fr: LOCALE_FIELDS_SCHEMA,
        it: LOCALE_FIELDS_SCHEMA,
    },
    required: ['de', 'fr', 'it'],
    additionalProperties: false,
};

// Translates name/review from English into de/fr/it in one call. Returns null (not a partial
// object) on any failure — callers must treat "no translation yet" and "translation failed" the
// same way: keep whatever was already stored, don't block the save.
export async function translateTripContent({ name, review }) {
    try {
        const response = await client.messages.create({
            model: 'claude-opus-5',
            max_tokens: 2048,
            thinking: { type: 'adaptive' },
            output_config: {
                effort: 'low',
                format: { type: 'json_schema', schema: TRANSLATION_SCHEMA },
            },
            messages: [{
                role: 'user',
                content: `Translate this Swiss travel itinerary's title and traveller review into German, French, and Italian.
Keep place names, trail names, and other proper nouns unchanged. Keep the tone natural and concise, matching
the original. If the review is empty, return an empty string for review in every language.

Title: ${name}
Review: ${review || '(none)'}`,
            }],
        });

        if (response.stop_reason === 'refusal') return null;
        const text = response.content.find(b => b.type === 'text')?.text;
        if (!text) return null;
        const parsed = JSON.parse(text);
        return {
            nameTranslations: { de: parsed.de.name, fr: parsed.fr.name, it: parsed.it.name },
            reviewTranslations: { de: parsed.de.review, fr: parsed.fr.review, it: parsed.it.review },
        };
    } catch {
        return null; // network/API error — degrade gracefully, per Confirmed Decision 6
    }
}
