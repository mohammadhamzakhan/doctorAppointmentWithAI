export function parseTimeTo24Hour(timeStr: string): {
  hour: number;
  minute: number;
} {
  let hour = 0;
  let minute = 0;
  const text = timeStr.toLowerCase().trim();

  // 3:30 pm or 3 pm
  const amPmMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (amPmMatch) {
    hour = parseInt(amPmMatch[1], 10);
    minute = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
    if (amPmMatch[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (amPmMatch[3].toLowerCase() === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }

  // 24-hour format like 15:00
  const twentyFourMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourMatch) {
    hour = parseInt(twentyFourMatch[1], 10);
    minute = parseInt(twentyFourMatch[2], 10);
    return { hour, minute };
  }

  // Roman Urdu: "4 baje", "5 baje sham ko"
  const romanBaje = text.match(
    /(\d{1,2})\s*(baj[ae]|bje|bajy)(?:\s*(sham|shaam|morning|subah|day))?/i,
  );
  if (romanBaje) {
    hour = parseInt(romanBaje[1], 10);
    const partOfDay = romanBaje[2]?.toLowerCase();
    // interpret "sham" or afternoon/evening
    if (partOfDay?.includes('sham') && hour < 12) hour += 12;
    return { hour, minute };
  }

  // fallback
  return { hour: 0, minute: 0 };
}
