import { ChatSession } from 'src/ai/interface/chat-session.interface';
import { extractDate } from '../date_time_helpers/extract-date.helper';
import { extractTime } from '../date_time_helpers/extract-time.helper';
import { getWeekdayName } from '../date_time_helpers/get-week-day-name.helper';
import { parseTimeTo24Hour } from '../date_time_helpers/parse-time-to-24-hour.helper';
import { formatTime12Hour } from '../date_time_helpers/format-time-12-hour.helper';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { OpenAiService } from 'src/ai/service/openai.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { formatDate } from '../date_time_helpers/format-date.helper';
import {
  askForAppointmentDate,
  askForAppointmentTime,
  askForPatientName,
  doctorNotAvailableOnThatDay,
} from 'src/ai/prompts';

export async function bookingAppointment(
  doctorId: number,
  userMessage: string,
  session: ChatSession,
  patientPhone: string,
  appointmentService: AppointmentsService,
  openAiService: OpenAiService,
  prisma: PrismaService,
): Promise<string> {
  session.aiArgs ??= {};
  session.aiArgs.doctorId = doctorId;

  /* ================= STEP 1: NAME ================= */
  if (!session.aiArgs.step || session.aiArgs.step === 'name') {
    if (extractDate(userMessage) || extractTime(userMessage)) {
      return openAiService.chatSingle({
        system: askForPatientName,
        user: userMessage,
      });
    }

    session.aiArgs.patientName = userMessage.trim();
    session.aiArgs.step = 'date';

    return openAiService.chatSingle({
      system: askForAppointmentDate,
      user: `Hello ${session.aiArgs.patientName}! Please select a date for your appointment.`,
    });
  }

  /* ================= STEP 2: DATE ================= */
  if (session.aiArgs.step === 'date') {
    const extractedDate = extractDate(userMessage);

    if (!extractedDate) {
      return openAiService.chatSingle({
        system: askForAppointmentDate,
        user: `Please provide a valid date.`,
      });
    }

    session.aiArgs.date = extractedDate;
    session.aiArgs.step = 'time';

    const dateObj = new Date(extractedDate);
    const day = dateObj.getDay();

    const availability = await prisma.doctorAvailability.findFirst({
      where: { doctorId, day, isActive: true },
    });

    if (!availability) {
      const hours = await prisma.doctorAvailability.findMany({
        where: { doctorId, isActive: true },
        orderBy: { day: 'asc' },
      });

      const formatted = hours
        .map((a) => `${getWeekdayName(a.day)}: ${a.startTime} - ${a.endTime}`)
        .join('\n');

      session.aiArgs.step = 'date';
      session.aiArgs.date = undefined;

      return openAiService.chatSingle({
        system: doctorNotAvailableOnThatDay,
        user: `Doctor is not available.\n\nAvailable days:\n${formatted}`,
      });
    }
    const selectedDate = new Date(session.aiArgs.date!);

    let availableSlots = await appointmentService.getRemainingSlots(
      doctorId,
      selectedDate,
    );
    const now = new Date();

    // Remove past slots ONLY if date is today
    availableSlots = availableSlots.filter((slot) => {
      // if selected date is today
      if (selectedDate.toDateString() === now.toDateString()) {
        return slot.start > now;
      }

      // future date → keep all
      return true;
    });

    const formattedSlots = availableSlots
      .map(
        (slot) =>
          `${formatTime12Hour(slot.start)} → ${formatTime12Hour(slot.end)}`,
      )
      .join('\n');

    return openAiService.chatSingle({
      system: askForAppointmentTime,
      user: `📅 Date: ${formatDate(selectedDate)}

Available time slots:
${formattedSlots}

Meherbani kar ke in mein se koi aik time select karein.`,
    });
  }

  /* ================= STEP 3: TIME ================= */
  if (session.aiArgs.step === 'time') {
    const selectedDate = new Date(session.aiArgs.date!);

    let availableSlots = await appointmentService.getRemainingSlots(
      doctorId,
      selectedDate,
    );

    const now = new Date();

    // Remove past slots ONLY if date is today
    availableSlots = availableSlots.filter((slot) => {
      // if selected date is today
      if (selectedDate.toDateString() === now.toDateString()) {
        return slot.start > now;
      }

      // future date → keep all
      return true;
    });

    if (!availableSlots.length) {
      session.aiArgs.step = 'date';
      session.aiArgs.date = undefined;
      return `All slots are booked on ${formatDate(selectedDate)}. Please choose another date.`;
    }

    const normalizedMessage = userMessage
      .toLowerCase()
      .replace(/\b(\d{1,2})\s+(\d{2})\b/g, '$1:$2');

    const requestedTime = extractTime(normalizedMessage, selectedDate);
    let chosenSlot = availableSlots[0];
    let message = '';

    if (requestedTime) {
      const reqMinutes = requestedTime.hour * 60 + requestedTime.minute;

      const match = availableSlots.find((s) => {
        const slotStart = s.start.getHours() * 60 + s.start.getMinutes();
        const slotEnd = s.end.getHours() * 60 + s.end.getMinutes();

        return reqMinutes >= slotStart && reqMinutes < slotEnd;
      });

      if (match) {
        chosenSlot = match;
        message = `Great! Aap ka requested time available hai.`;
      } else {
        message = `Requested time available nahi hai. Neeche diye gaye slots mein se koi aik select karein.`;
      }
    } else {
      message = `Available slots hain: ${availableSlots
        .map((s) => `${formatTime12Hour(s.start)} → ${formatTime12Hour(s.end)}`)
        .join(', ')}`;
    }

    session.aiArgs.time = `${chosenSlot.start
      .getHours()
      .toString()
      .padStart(2, '0')}:${chosenSlot.start
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    session.aiArgs.step = 'confirmed';

    // ❗ IMPORTANT: NO AI HERE
    return `${message}

Do you want to confirm your appointment at ${formatTime12Hour(
      chosenSlot.start,
    )}?

Reply YES to confirm or NO to cancel.`;
  }

  /* ================= STEP 4: CONFIRM ================= */
  if (session.aiArgs.step === 'confirmed') {
    const text = userMessage.toLowerCase().trim();

    const yesWords = ['yes', 'haan', 'han', 'confirm', 'bilkul', 'g'];
    const noWords = ['no', 'cancel', 'nah'];

    if (noWords.includes(text)) {
      session.aiArgs = {};
      return `Appointment cancelled. You can start again anytime.`;
    }

    if (!yesWords.includes(text)) {
      return `Please reply YES to confirm or NO to cancel.`;
    }

    const { hour, minute } = parseTimeTo24Hour(session.aiArgs.time!);
    const appointmentDateTime = new Date(session.aiArgs.date!);
    appointmentDateTime.setHours(hour, minute, 0, 0);

    if (appointmentDateTime <= new Date()) {
      session.aiArgs.step = 'time';
      session.aiArgs.time = undefined;
      return `Please choose a future time.`;
    }

    await appointmentService.createAppointment(
      doctorId,
      {
        pateintName: session.aiArgs.patientName!,
        patientPhone,
        scheduledStart: appointmentDateTime,
      },
      'ai',
      doctorId,
    );

    const dateStr = appointmentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const timeStr = formatTime12Hour(appointmentDateTime);

    const patientName = session.aiArgs.patientName!;
    session.aiArgs = {};

    return `✅ ${patientName}, your appointment is confirmed!

📅 Date: ${dateStr}
⏰ Time: ${timeStr}`;
  }

  /* ================= FALLBACK ================= */
  return openAiService.chatSingle({
    system: `You are a WhatsApp medical receptionist in Pakistan.`,
    user: userMessage,
  });
}
