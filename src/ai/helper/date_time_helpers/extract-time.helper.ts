export function extractTime(
  message: string,
  baseDate?: Date,
): { hour: number; minute: number; date?: Date } | null {
  const text = message.toLowerCase().trim();
  const now = new Date();
  const today = baseDate ?? now;

  let hour = 0;
  let minute = 0;

  // 1️⃣ Explicit am/pm or 24-hour format
  const amPmMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (amPmMatch) {
    hour = parseInt(amPmMatch[1], 10);
    minute = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
    const period = amPmMatch[3].toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }

  const twentyFourMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourMatch) {
    hour = parseInt(twentyFourMatch[1], 10);
    minute = parseInt(twentyFourMatch[2], 10);
    return { hour, minute };
  }

  // 2️⃣ Roman Urdu time markers
  const timeMarkers: Record<string, number> = {
    subha: 9, // morning → default 9 AM if hour missing
    dopahar: 13, // afternoon → PM
    shaam: 18, // evening
    raat: 21, // night
  };

  // Match phrases like "10 subha", "2 dopahar", "6 shaam"
  const romanTimeMatch = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(subha|dopahar|shaam|raat)?/i,
  );
  if (romanTimeMatch) {
    hour = parseInt(romanTimeMatch[1], 10);
    minute = romanTimeMatch[2] ? parseInt(romanTimeMatch[2], 10) : 0;

    const marker = romanTimeMatch[3]?.toLowerCase();
    if (marker && timeMarkers[marker] !== undefined) {
      if (marker === 'subha' && hour > 12) hour -= 12; // morning should be AM
      if (marker === 'dopahar' && hour < 12) hour += 12;
      if (marker === 'shaam' && hour < 12) hour += 12;
      if (marker === 'raat' && hour < 12) hour += 12;
    } else {
      // If no marker, apply simple logic: if hour < current hour, assume PM
      const currentHour = today.getHours();
      if (hour <= currentHour) hour += 12;
    }

    return { hour, minute };
  }

  // 3️⃣ Words like "aj subha", "kal dopahar", "parso shaam" → adjust date
  let targetDate = new Date(today);
  if (/aj/.test(text)) targetDate = new Date(today);
  if (/kal/.test(text)) targetDate.setDate(targetDate.getDate() + 1);
  if (/parso/.test(text)) targetDate.setDate(targetDate.getDate() + 2);
  if (/agle haftay|next week/.test(text))
    targetDate.setDate(targetDate.getDate() + 7);

  // Look for hour number
  const hourOnly = text.match(/(\d{1,2})/);
  if (hourOnly) {
    hour = parseInt(hourOnly[1], 10);
    // AM/PM based on context
    if (/subha/.test(text) && hour > 12) hour -= 12;
    if (/dopahar|shaam|raat/.test(text) && hour < 12) hour += 12;

    return { hour, minute, date: targetDate };
  }

  return null;
}
