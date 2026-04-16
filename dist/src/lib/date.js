export function getSingaporeToday() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date());
}
export function parseSingaporeDate(raw) {
    if (raw === null || raw === undefined)
        return null;
    const value = String(raw).trim();
    if (!value)
        return null;
    const normalized = value.toLowerCase();
    if (['na', 'n/a', 'nil', 'null', 'tbc', '-'].includes(normalized)) {
        return null;
    }
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match)
        return null;
    const [, day, month, year] = match;
    const d = day.padStart(2, '0');
    const m = month.padStart(2, '0');
    return `${year}-${m}-${d}`;
}
