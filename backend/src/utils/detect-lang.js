import { francAll } from 'franc';

// franc's ISO 639-3 codes -> this app's SUPPORTED_LANGS.
const ISO_639_3_TO_APP_LANG = { eng: 'en', deu: 'de', fra: 'fr', ita: 'it' };
const MIN_TEXT_LENGTH = 20; // below this, franc's guesses are unreliable — bucket as 'other'

// Best-effort detection for the Explore Trips language filter — never throws, always returns a value.
export function detectReviewLang(text) {
    const trimmed = (text ?? '').trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return 'other';
    const [topGuess] = francAll(trimmed, { minLength: MIN_TEXT_LENGTH });
    const appLang = topGuess && ISO_639_3_TO_APP_LANG[topGuess[0]];
    return appLang ?? 'other';
}
