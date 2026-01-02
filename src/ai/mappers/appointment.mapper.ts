import { fromZonedTime } from 'date-fns-tz';

export function mapAiArgsToAppointment(
  args: any,
  phoneNumber: string,
  doctorTimezone?: string,
  patientId?: number, // optional patientId if exists
) {
  // Fallback patient name
  const patientName = args.patientName ?? 'AI Booking';

  // Scheduled start as Date object
  if (!args.date || !args.time) {
    throw new Error('Date and time are required for appointment');
  }

  const dateTimeStr = `${args.date}T${args.time}`;
  const scheduledStart = doctorTimezone
    ? fromZonedTime(new Date(dateTimeStr), doctorTimezone)
    : new Date(dateTimeStr);

  return {
    doctorId: args.doctorId ?? 1,
    dto: {
      patientId: patientId ?? null, // use existing patient ID if provided
      pateintName: patientName,
      patientPhone: phoneNumber,
      scheduledStart,
      reason: args.reason ?? null,
    },
    bookedBy: 'ai' as const,
    assistantId: 0,
  };
}
