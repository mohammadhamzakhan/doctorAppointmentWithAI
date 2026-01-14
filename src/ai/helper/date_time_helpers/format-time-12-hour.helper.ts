export function formatTime12Hour(date: Date): string {
  let hours = date.getHours(); // 0-23
  const minutes = date.getMinutes(); // 0-59
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12; // convert 13 -> 1, 0 -> 0
  if (hours === 0) hours = 12; // handle midnight and noon

  // Pad minutes to always have 2 digits
  const minutesStr = minutes.toString().padStart(2, '0');

  return `${hours}:${minutesStr} ${ampm}`;
}
