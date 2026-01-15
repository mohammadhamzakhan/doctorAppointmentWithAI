export function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long', // Monday, Tuesday
    day: 'numeric', // 15
    month: 'long', // January
  };
  return date.toLocaleDateString('en-US', options); // English
} // Helper: "HH:MM" -> minutes
