// MySwitzerland's copyrightHolder field mixes two kinds of text: who holds the copyright
// (a photographer or agency, which we credit) and usage terms such as "Editorial and touristic
// use" (which we comply with, but which are not a credit). Values often combine both, e.g.
// "Partner image for editorial and touristic use / Nendaz Tourisme/Florian Bouvet-Fournier".
// Parts are separated by " / " with spaces; a slash without spaces belongs to the name itself
// ("Switzerland Tourism/Andre Meier").
const USAGE_TERMS = [
  /editorial and touristic use/i,
  /redaktionelle und touristische nutzung/i,
  /full buy-?out/i,
  /^weltweit\s*\/\s*medienunabh/i,
];

// Returns the credit to show ("© name"), or null when nothing but usage terms is left.
export function creditLabel(holder: string | null | undefined): string | null {
  const credit = (holder ?? '')
    .split(/\s+\/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !USAGE_TERMS.some((term) => term.test(part)))
    .join(' / ');

  if (!credit) return null;
  return credit.startsWith('©') ? credit : `© ${credit}`;
}
