export function parseTimeToMinutes(time: string | Date) {
  let hours: number, minutes: number;

  if (time instanceof Date) {
    hours = time.getHours();
    minutes = time.getMinutes();
  } else {
    const parts = time.split(':').map(Number);
    hours = parts[0];
    minutes = parts[1] ?? 0;
  }

  return hours * 60 + minutes;
}
