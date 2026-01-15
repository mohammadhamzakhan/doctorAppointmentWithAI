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

  /* ---------------- STEP 1: NAME ---------------- */
  if (!session.aiArgs.step || session.aiArgs.step === 'name') {
    if (extractDate(userMessage) || extractTime(userMessage)) {
      return await openAiService.chatSingle({
        system: askForPatientName,
        user: userMessage,
      });
    }

    session.aiArgs.patientName = userMessage.trim();
    session.aiArgs.step = 'date';

    return await openAiService.chatSingle({
      system: askForAppointmentDate,
      user: `Hello ${session.aiArgs.patientName}! Please select a date for your appointment.`,
    });
  }

  /* ---------------- STEP 2: DATE ---------------- */
  if (session.aiArgs.step === 'date') {
    const extractedDate = extractDate(userMessage);
    if (!extractedDate) {
      return await openAiService.chatSingle({
        system: askForAppointmentDate,
        user: `Please provide a valid date for your appointment.`,
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
      const doctorWorkingHours = await prisma.doctorAvailability.findMany({
        where: { doctorId, isActive: true },
        orderBy: { day: 'asc' },
      });

      const formattedHours = doctorWorkingHours
        .map((a) => `${getWeekdayName(a.day)}: ${a.startTime} to ${a.endTime}`)
        .join('\n');

      session.aiArgs.date = undefined;
      session.aiArgs.step = 'date';

      return await openAiService.chatSingle({
        system: doctorNotAvailableOnThatDay,
        user: `Doctor is not available on this day. Available days and timings:\n${formattedHours}`,
      });
    }

    return await openAiService.chatSingle({
      system: askForAppointmentTime,
      user: `Available date selected: ${formatDate(dateObj)}. Please choose a time.`,
    });
  }

  /* ================= STEP 3: TIME ================= */
  if (session.aiArgs.step === 'time') {
    const selectedDate = new Date(session.aiArgs.date!);

    // 1️⃣ Get remaining slots
    let availableSlots: { start: Date; end: Date }[] = [];
    try {
      availableSlots = await appointmentService.getRemainingSlots(
        doctorId,
        selectedDate,
      );
    } catch (err) {
      session.aiArgs.step = 'date';
      session.aiArgs.date = undefined;
      return await openAiService.chatSingle({
        system: `WhatsApp receptionist`,
        user: `Sorry, the doctor is not available on ${formatDate(
          selectedDate,
        )}. Please choose another date.`,
      });
    }

    if (!availableSlots.length) {
      session.aiArgs.step = 'date';
      session.aiArgs.date = undefined;
      return await openAiService.chatSingle({
        system: `WhatsApp receptionist`,
        user: `Sorry, all slots on ${formatDate(
          selectedDate,
        )} are booked. Please select another date.`,
      });
    }

    // 2️⃣ Check if user requested a specific time
    const requestedTime = extractTime(userMessage, selectedDate);
    let chosenSlot = availableSlots[0]; // default to first available

    let message: string;

    if (requestedTime) {
      const requestedMinutes = requestedTime.hour * 60 + requestedTime.minute;
      const matchSlot = availableSlots.find((slot) => {
        const slotMinutes =
          slot.start.getHours() * 60 + slot.start.getMinutes();
        return slotMinutes === requestedMinutes;
      });

      if (matchSlot) {
        chosenSlot = matchSlot;
        message = `Great! The time you requested is available.`;
      } else {
        chosenSlot = availableSlots[0];
        const slotsList = availableSlots
          .map((s) => formatTime12Hour(s.start))
          .join(', ');
        message = `The time you requested is not available. Available slots on ${formatDate(
          selectedDate,
        )}: ${slotsList}. I have tentatively selected the first available slot for you.`;
      }
    } else {
      // no time requested, suggest first available
      message = `Available slots on ${formatDate(
        selectedDate,
      )} are: ${availableSlots.map((s) => formatTime12Hour(s.start)).join(', ')}. I have selected the first available slot for you.`;
    }

    // 3️⃣ Store chosen slot
    session.aiArgs.time = `${chosenSlot.start
      .getHours()
      .toString()
      .padStart(2, '0')}:${chosenSlot.start
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    session.aiArgs.step = 'confirmed';

    return await openAiService.chatSingle({
      system: `WhatsApp receptionist`,
      user: `${message}\n\nDo you want to confirm this appointment at ${formatTime12Hour(
        chosenSlot.start,
      )}? (Yes/No)`,
    });
  }

  /* ================= STEP 4: CONFIRM ================= */
  if (session.aiArgs.step === 'confirmed') {
    const text = userMessage.toLowerCase().trim();
    const confirmations = [
      'yes',
      'haan',
      'han',
      'confirm',
      'bilkul',
      'g',
      'book kardein',
    ];

    if (!confirmations.includes(text)) {
      session.aiArgs = {};
      return await openAiService.chatSingle({
        system: `WhatsApp receptionist`,
        user: `Okay, appointment cancelled. You can start again if you want.`,
      });
    }

    const { hour, minute } = parseTimeTo24Hour(session.aiArgs.time!);
    const appointmentDateTime = new Date(session.aiArgs.date!);
    appointmentDateTime.setHours(hour, minute, 0, 0);

    if (appointmentDateTime <= new Date()) {
      session.aiArgs.time = undefined;
      session.aiArgs.step = 'time';
      return await openAiService.chatSingle({
        system: `WhatsApp receptionist`,
        user: `Please select a future time for your appointment.`,
      });
    }

    // Book appointment
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

    const patientName = session.aiArgs.patientName!;
    const dateStr = appointmentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const timeStr = formatTime12Hour(appointmentDateTime);

    session.aiArgs = {};

    return await openAiService.chatSingle({
      system: `WhatsApp receptionist`,
      user: `✅ ${patientName}, your appointment is confirmed!\n📅 Date: ${dateStr}\n⏰ Time: ${timeStr}`,
    });
  }

  /* ---------------- FALLBACK ---------------- */
  return await openAiService.chatSingle({
    system: `You are a WhatsApp medical receptionist in Pakistan.`,
    user: userMessage,
  });
}
