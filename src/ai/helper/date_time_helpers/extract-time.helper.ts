export function extractTime(
  message: string,
  baseDate?: Date,
): { hour: number; minute: number; date?: Date } | null {
  const text = message.toLowerCase().trim();
  const today = baseDate ?? new Date();

  let hour = 0;
  let minute = 0;

  // 1️⃣ Explicit am/pm or 24-hour format
  let amPmMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!amPmMatch) {
    // Handle "7 30 pm" without colon
    amPmMatch = text.match(/(\d{1,2})\s+(\d{2})\s*(am|pm)/i);
  }

  if (amPmMatch) {
    hour = parseInt(amPmMatch[1], 10);
    minute = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
    const period = amPmMatch[3].toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }

  // 2️⃣ 24-hour format hh:mm
  const twentyFourMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourMatch) {
    hour = parseInt(twentyFourMatch[1], 10);
    minute = parseInt(twentyFourMatch[2], 10);
    return { hour, minute };
  }

  // 3️⃣ Roman Urdu markers (subha, dopahar, shaam, raat, bje)
  const timeMarkers: Record<string, number> = {
    subha: 9,
    dopahar: 13,
    shaam: 18,
    raat: 21,
  };

  const romanMatch = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(subha|dopahar|shaam|raat|bje|baje|bajay)?/i,
  );

  if (romanMatch) {
    hour = parseInt(romanMatch[1], 10);
    minute = romanMatch[2] ? parseInt(romanMatch[2], 10) : 0;

    const marker = romanMatch[3]?.toLowerCase();
    if (marker) {
      if (marker in timeMarkers) {
        if (marker === 'subha' && hour > 12) hour -= 12;
        if (['dopahar', 'shaam', 'raat'].includes(marker) && hour < 12)
          hour += 12;
      } else if (['bje', 'baje', 'bajay'].includes(marker)) {
        // "7 bje" → assume AM or PM based on current time
        const nowHour = today.getHours();
        if (hour <= nowHour) hour += 12;
      }
    }

    return { hour, minute, date: today };
  }

  // 4️⃣ fallback: just number
  const hourOnly = text.match(/(\d{1,2})/);
  if (hourOnly) {
    hour = parseInt(hourOnly[1], 10);
    minute = 0;

    if (/subha/.test(text) && hour > 12) hour -= 12;
    if (/dopahar|shaam|raat/.test(text) && hour < 12) hour += 12;

    return { hour, minute, date: today };
  }

  return null;
}
