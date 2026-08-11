// Covers the realistic input space for Swiss/French/German place names in trip titles
// (Zürich, Genève, Château-d'Œx, ...) without pulling in a full slug-library dependency.
const TRANSLITERATIONS = {
    ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
    é: 'e', è: 'e', ê: 'e', ë: 'e',
    à: 'a', â: 'a', ô: 'o', ç: 'c', î: 'i', ï: 'i', û: 'u', ù: 'u', œ: 'oe',
};

export function slugify(text) {
    const lower = (text ?? '').toLowerCase();
    const mapped = [...lower].map(ch => TRANSLITERATIONS[ch] ?? ch).join('');
    const DIACRITIC_MARKS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
    return mapped
        .normalize('NFKD').replace(DIACRITIC_MARKS, '') // strip any remaining diacritics
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');
}

// Mirrors frontend/src/app/shared/utils/date-range.ts's tripDayCount() — needed server-side
// to fold a duration hint into the slug (e.g. "zermatt-interlaken-3-day-hike") so near-duplicate
// trip names don't all collide down to a bare numeric suffix.
function tripDayCount(range) {
    if (!range) return null;
    if (range.mode === 'days') {
        return range.startDay != null && range.endDay != null && range.endDay >= range.startDay
            ? range.endDay - range.startDay + 1
            : null;
    }
    if (!range.startDate || !range.endDate) return null;
    const diff = Math.round((Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000);
    return diff >= 0 ? diff + 1 : null;
}

export function tripDurationLabel(range) {
    const count = tripDayCount(range);
    return count ? `${count} day` : '';
}

/** isTaken: (slug) => Promise<boolean>, e.g. `slug => Trip.exists({ slug }).then(Boolean)` */
export async function generateUniqueSlug(baseText, isTaken) {
    const base = slugify(baseText) || 'trip';
    let candidate = base;
    let n = 2;
    while (await isTaken(candidate)) {
        candidate = `${base}-${n++}`;
    }
    return candidate;
}
