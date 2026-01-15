import { ChatSession } from 'src/ai/interface/chat-session.interface';
import { extractDate } from '../date_time_helpers/extract-date.helper';
import { extractTime } from '../date_time_helpers/extract-time.helper';
import { formatLocalDate } from '../date_time_helpers/format-local-date.helper';
import { getWeekdayName } from '../date_time_helpers/get-week-day-name.helper';
import { parseTimeTo24Hour } from '../date_time_helpers/parse-time-to-24-hour.helper';
import { formatTime12Hour } from '../date_time_helpers/format-time-12-hour.helper';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { OpenAiService } from 'src/ai/service/openai.service';
import { PrismaService } from 'src/prisma/prisma.service';

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

  /* ---------------- INIT STEP ---------------- */
  if (!session.aiArgs.step) {
    session.aiArgs.step = 'name';
  }

  /* ================= STEP 1: NAME ================= */
  if (session.aiArgs.step === 'name') {
    // 🚫 Prevent date/time as name
    if (extractDate(userMessage) || extractTime(userMessage)) {
      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for patient's name.

RULES:
- Short
- Polite
- WhatsApp tone
        `,
        user: userMessage,
      });
    }

    session.aiArgs.patientName = userMessage.trim();
    session.aiArgs.step = 'date';

    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for appointment date.

RULES:
- Roman Urdu preferred
- Examples: aaj, kal, monday, 15 january
      `,
      user: userMessage,
    });
  }

  /* ================= STEP 2: DATE ================= */
  if (session.aiArgs.step === 'date') {
    const extractedDate = extractDate(userMessage);

    if (!extractedDate) {
      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for appointment date.

RULES:
- Roman Urdu preferred
- Short WhatsApp message
        `,
        user: userMessage,
      });
    }

    session.aiArgs.date = extractedDate;
    session.aiArgs.step = 'time';

    // ✅ Check doctor availability
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
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Inform patient doctor is not available and ask for another date.

RULES:
- Roman Urdu preferred
        `,
        user: `Doctor is not available on this day.\n\nAvailable days:\n${formattedHours}`,
      });
    }

    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for appointment time.

RULES:
- Roman Urdu preferred
- Accept: 5 pm, 10:30 am, shaam 6 baje
      `,
      user: userMessage,
    });
  }

  /* ================= STEP 3: TIME ================= */
  if (session.aiArgs.step === 'time') {
    const extractedTime = extractTime(
      userMessage,
      new Date(session.aiArgs.date!),
    );

    if (!extractedTime) {
      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for appointment time.

RULES:
- Short
- Polite
        `,
        user: userMessage,
      });
    }

    session.aiArgs.time = `${extractedTime.hour
      .toString()
      .padStart(2, '0')}:${extractedTime.minute.toString().padStart(2, '0')}`;

    if (extractedTime.date) {
      session.aiArgs.date = formatLocalDate(extractedTime.date);
    }

    session.aiArgs.step = 'confirmed';

    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Confirm appointment details.

RULES:
- Roman Urdu preferred
- Ask Yes or No
      `,
      user: `
Name: ${session.aiArgs.patientName}
Date: ${session.aiArgs.date}
Time: ${session.aiArgs.time}
      `,
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
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Inform appointment cancelled politely.
        `,
        user: userMessage,
      });
    }

    const { hour, minute } = parseTimeTo24Hour(session.aiArgs.time!);

    const appointmentDateTime = new Date(session.aiArgs.date!);
    appointmentDateTime.setHours(hour, minute, 0, 0);

    if (appointmentDateTime <= new Date()) {
      session.aiArgs.time = undefined;
      session.aiArgs.step = 'time';

      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask for future time.
        `,
        user: userMessage,
      });
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

    const dateStr = appointmentDateTime.toDateString();
    const timeStr = formatTime12Hour(appointmentDateTime);

    session.aiArgs = {};

    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Confirm appointment successfully.

RULES:
- Friendly
- WhatsApp tone
      `,
      user: `
Date: ${dateStr}
Time: ${timeStr}
      `,
    });
  }

  /* ================= FALLBACK ================= */
  return await openAiService.chatSingle({
    system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask user to try again politely.
    `,
    user: userMessage,
  });
}
