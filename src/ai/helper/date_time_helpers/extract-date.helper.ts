import { formatLocalDate } from './format-local-date.helper';

export function extractDate(message: string): string | null {
  const text = message.toLowerCase().trim();
  const today = new Date();

  //We set setHours(0, 0, 0, 0)
  // to reset the time to the start
  //  of the day so date comparisons
  //  work correctly and don’t break
  // due to hidden time or timezone
  // differences

  today.setHours(0, 0, 0, 0);

  // 🔹 Today
  if (/(aj|aaj|today)/i.test(text)) {
    return formatLocalDate(today);
  }

  // 🔹 Tomorrow
  if (/(kal|tomorrow)/i.test(text)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return formatLocalDate(t);
  }

  // 🔹 Weekdays (with optional "next")
  const WEEK_DAYS: Record<string, number> = {
    sunday: 0,
    itwar: 0,
    monday: 1,
    peer: 1,
    tuesday: 2,
    mangal: 2,
    wednesday: 3,
    budh: 3,
    thursday: 4,
    jumeraat: 4,
    jumrat: 4,
    friday: 5,
    jumma: 5,
    saturday: 6,
    hafta: 6,
  };

  for (const day in WEEK_DAYS) {
    if (text.includes(day)) {
      const targetDay = WEEK_DAYS[day];
      const currentDay = today.getDay();

      let diff = targetDay - currentDay;

      // Check for "next" in Roman Urdu or English
      if (
        text.includes('next') ||
        text.includes('agle') ||
        text.includes('agle haftay')
      )
        diff += 7;

      if (diff <= 0) diff += 7;

      const result = new Date(today);
      result.setDate(today.getDate() + diff);

      return formatLocalDate(result);
    }
  }

  // 🔹 Full date like "15 Sep" or "15 September"
  const dateMatch = text.match(
    /(\d{1,2})\s*(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)/i,
  );

  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthName = dateMatch[2];
    const monthIndex = new Date(
      `${monthName} 1, ${today.getFullYear()}`,
    ).getMonth();
    const parsedDate = new Date(today.getFullYear(), monthIndex, day);

    if (parsedDate < today)
      parsedDate.setFullYear(parsedDate.getFullYear() + 1);

    return formatLocalDate(parsedDate);
  }

  // 🔹 Plain day numbers (1-31)
  const plainDayMatch = text.match(/\b([1-9]|[12][0-9]|3[01])\b/);
  if (plainDayMatch) {
    const day = parseInt(plainDayMatch[1], 10);
    const month = today.getMonth(); // current month
    let year = today.getFullYear();

    let result = new Date(year, month, day);

    // If the day is already passed in current month, move to next month
    if (result < today) {
      if (month === 11) {
        // December → January next year
        result = new Date(year + 1, 0, day);
      } else {
        result = new Date(year, month + 1, day);
      }
    }

    return formatLocalDate(result);
  }

  return null;
}
