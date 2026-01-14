import { ChatSession } from 'src/ai/interface/chat-session.interface';
import { extractDate } from '../date_time_helpers/extract-date.helper';
import { formatLocalDate } from '../date_time_helpers/format-local-date.helper';
import { extractTime } from '../date_time_helpers/extract-time.helper';
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

  /* ---------------- STEP 0: EXTRACT DATE & TIME ---------------- */
  const extractedDate = extractDate(userMessage);

  if (extractedDate) {
    session.aiArgs.date = extractedDate;
    session.aiArgs.step = 'time';
  }
  const extractedTime = extractTime(
    userMessage,
    extractedDate ? new Date(extractedDate) : undefined,
  );

  if (extractedTime) {
    // Convert to string "HH:MM"
    session.aiArgs.time = `${extractedTime.hour.toString().padStart(2, '0')}:${extractedTime.minute.toString().padStart(2, '0')}`;
    // Optionally store the date from extractTime if user said "kal" or "parso"
    if (extractedTime.date) {
      session.aiArgs.date = formatLocalDate(extractedTime.date);
    }
    session.aiArgs.step = 'name';
  }

  /* ---------------- STEP 1: ASK DATE ---------------- */
  if (!session.aiArgs.date) {
    session.aiArgs.step = 'date';
    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for appointment date.

RULES:
- Detect user language automatically
- Roman Urdu if user uses Roman Urdu, otherwise English
- Short, polite, WhatsApp-style
- Do NOT ask doctor name
- Give examples like: aaj, kal, friday, next monday, 15 january

EXAMPLE (Roman Urdu):
"Mehrbani karke appointment ka din bata dein (aaj, kal ya koi date)."

EXAMPLE (English):
"Please tell me your preferred appointment date."
      `,
      user: userMessage,
    });
  }

  /* ---------------- CHECK DOCTOR AVAILABILITY ---------------- */
  const dateObj = new Date(session.aiArgs.date);
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

    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Inform patient politely that the doctor is not available on their selected day and provide all working days and hours.

RULES:
- Detect user language automatically
- Roman Urdu preferred if user uses it
- Short, WhatsApp-friendly, polite
      `,
      user: `Doctor is not available on this day. Available days & hours:\n${formattedHours}\nMehrbani karke kisi aur din ka intekhab karein.`,
    });
  }

  /* ---------------- STEP 2: ASK TIME ---------------- */
  if (!session.aiArgs.time) {
    session.aiArgs.step = 'time';
    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for appointment time.

RULES:
- Detect user language automatically
- Roman Urdu preferred if user uses it
- Short, polite, WhatsApp tone
- Accept formats like: 5 pm, 10:30 am, shaam 6 baje

EXAMPLE (Roman Urdu):
"Appointment ka time bhi bata dein, jaise 5 baje ya 10:30 am."

EXAMPLE (English):
"Please tell me your preferred appointment time."
      `,
      user: userMessage,
    });
  }

  /* ---------------- STEP 3: ASK PATIENT NAME ---------------- */
  if (!session.aiArgs.patientName) {
    session.aiArgs.step = 'name';

    // 🚫 Prevent date/time as name
    if (extractDate(userMessage) || extractTime(userMessage)) {
      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Ask ONLY for patient's name.

RULES:
-Do not greeting because already greets
- Detect user language eg. english or Roman urdu
- Detect user language
- Very polite and friendly
- Short WhatsApp message
        `,
        user: userMessage,
      });
    }

    session.aiArgs.patientName = userMessage.trim();
    session.aiArgs.step = 'awaiting_confirmation';

    return await openAiService.chatSingle({
      system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Confirm appointment details and ask for confirmation.

RULES:
- Detect user language automatically
- Roman Urdu preferred
- Friendly and professional
- Show name, date, and time clearly
- Ask user to reply Yes or No
      `,
      user: `
Name: ${session.aiArgs.patientName}
Date: ${session.aiArgs.date}
Time: ${session.aiArgs.time}
      `,
    });
  }

  /* ---------------- STEP 4: CONFIRM ---------------- */
  if (session.aiArgs.step === 'awaiting_confirmation') {
    const text = userMessage.toLowerCase().trim();
    const confirmations = [
      'yes',
      'haan',
      'han',
      'confirm',
      'bilkul',
      'g',
      'g haan',
      'book kardein',
    ];

    if (!confirmations.includes(text)) {
      session.aiArgs = {};
      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Politely inform the user that the appointment has been cancelled.

RULES:
- Detect user language
- Short and polite
- Offer to start again
        `,
        user: userMessage,
      });
    }

    // Parse time to 24-hour
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
Tell user that the selected time has already passed and ask for a future time.

RULES:
- Detect user language
- Polite WhatsApp tone
      `,
        user: userMessage,
      });
    }

    try {
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
- Do not Ask for Doctor ID 
- Detect user language
- Friendly, warm, professional
- WhatsApp tone
- Show final date and time
- Show final confirmation message like "Thank you" etc
      `,
        user: `
Date: ${dateStr}
Time: ${timeStr}
      `,
      });
    } catch (err) {
      console.error(err);
      return await openAiService.chatSingle({
        system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Politely apologize and inform that appointment could not be booked.

RULES:
- Detect user language
- Short and respectful
      `,
        user: userMessage,
      });
    }
  }

  /* ---------------- FALLBACK ---------------- */
  return await openAiService.chatSingle({
    system: `
You are a WhatsApp medical receptionist in Pakistan.

TASK:
Politely inform user that something went wrong and ask them to try again.

RULES:
- Detect user language
- Short WhatsApp tone
    `,
    user: userMessage,
  });
}
