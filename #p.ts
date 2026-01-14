import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
// import { OpenAiService } from './service/openai.service';
// import { SessionService } from './service/session.service';
// import { AppointmentsService } from 'src/appointments/appointments.service';
// import { mapAiArgsToAppointment } from './mappers/appointment.mapper';
import * as chrono from 'chrono-node';
import { DoctorService } from 'src/doctor/doctor.service';
import { fromZonedTime } from 'date-fns-tz';
import { PrismaService } from 'src/prisma/prisma.service';
import { DoctorAvailabilityService } from 'src/doctor-availability/doctor-availability.service';
import { mapAiArgsToAppointment } from 'src/ai/mappers/appointment.mapper';
import { OpenAiService } from 'src/ai/service/openai.service';
import { SessionService } from 'src/ai/service/session.service';
import { AppointmentsService } from 'src/appointments/appointments.service';

//max messages to keep in session

const MAX_MESSAGES = 20;

// Appointment status enum
enum AppointmentStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  cancelled = 'cancelled',
  completed = 'completed',
  rescheduled = 'rescheduled',
}

//ai arguments interface
export interface AiArgs {
  doctorId?: number;
  date?: string;
  time?: string;
  reason?: string;
  patientName?: string;
  appointmentId?: number;
  suggestedSlots?: string[];
  [key: string]: any;
}

@Injectable()
export class AIProcessor {
  constructor(
    private readonly openAIService: OpenAiService,
    private readonly sessionService: SessionService,
    private readonly appointmentService: AppointmentsService,
    private readonly doctorService: DoctorService,
    private readonly prismaService: PrismaService,
    private readonly doctorAvailabilityService: DoctorAvailabilityService,
  ) {}

  /* -------------------- AI HELPERS -------------------- */

  // Normalize date/time phrases
  private async normalizeDateTimeText(message: string): Promise<string> {
    const prompt = `
Convert the following message into clear English date/time phrases.

Rules:
- kal = tomorrow
- aaj = today
- parson = day after tomorrow
- subha = morning (9 AM)
- dopahar = afternoon (1 PM)
- sham = evening (6 PM)
- raat = night (9 PM)

Return ONLY the rewritten sentence.
Text: "${message}"
`;
    const response = await this.openAIService.chat([
      { role: 'system', content: 'You normalize date and time text.' },
      { role: 'user', content: prompt },
    ]);
    return response.choices?.[0]?.message?.content?.trim() ?? message;
  }

  //getting pateint name
  private async extractPatientName(message: string): Promise<string | null> {
    const prompt = `
Extract ONLY the patient's name from the text.
If no name is found, respond with "NONE".

Text: "${message}"
`;
    const response = await this.openAIService.chat([
      { role: 'system', content: 'You extract names only.' },
      { role: 'user', content: prompt },
    ]);

    let name = response.choices?.[0]?.message?.content?.trim() ?? '';
    const match = name.match(/"(.*?)"/);
    if (match) name = match[1];
    name = name.replace(/^The name of the patient is /i, '').trim();
    if (!name || name.toUpperCase() === 'NONE') return null;
    return name;
  }

  // Ask for missing information that is required for booking
  private async askForMissingInfo(
    userMessage: string,
    missingFields: string[],
  ): Promise<string> {
    const prompt = `
The user wants to book a medical appointment.

LANGUAGE RULES:
- Reply ONLY in English or Roman Urdu
- If message looks Roman Urdu → reply Roman Urdu
- Otherwise reply English
- NO native Urdu / Hindi script

TASK:
Ask ONLY for: ${missingFields.join(', ')}
Ask ONE short polite question.

User message:
"${userMessage}"
`;
    const response = await this.openAIService.chat([
      {
        role: 'system',
        content:
          'You are a medical appointment assistant. Follow language rules strictly.',
      },
      { role: 'user', content: prompt },
    ]);
    return response.choices?.[0]?.message?.content?.trim() ?? '';
  }

  // Ask for alternative time slots when requested slot is unavailable
  private async askForAlternativeTime(
    userMessage: string,
    requestedTime: string,
    slots: string[],
  ): Promise<string> {
    const slotText = slots.join(', ');
    const prompt = `
The user tried to book an appointment at ${requestedTime}, but that time is not available.

LANGUAGE RULES:
- Respond ONLY in English OR Roman Urdu
- If the user's message is Roman Urdu, reply in Roman Urdu
- Otherwise reply in English
- Do NOT use native Urdu script

TASK:
Politely inform that ${requestedTime} is unavailable.
Ask the user to choose ONE of these available times:
${slotText}

Ask ONE clear question.
Be short and friendly.

User message:
"${userMessage}"

`;
    const response = await this.openAIService.chat([
      { role: 'system', content: 'You are a medical appointment assistant.' },
      { role: 'user', content: prompt },
    ]);

    return response.choices?.[0]?.message?.content?.trim() ?? '';
  }

  // Handle appointment cancellation flow
  private async handleCancellation(
    phoneNumber: string,
    userMessage: string,
    doctorPhoneNumber: string,
  ): Promise<string> {
    const session = await this.sessionService.getSession(phoneNumber);

    // Handle confirmation response
    if (
      session.aiArgs?.action === 'cancel' &&
      session.aiArgs.awaitingConfirmation
    ) {
      return this.confirmCancellation(phoneNumber, userMessage);
    }

    // Start cancellation flow
    const doctor = await this.doctorService.getDoctorByPhone(doctorPhoneNumber);
    if (!doctor) throw new BadRequestException('Doctor not found');

    const patient = await this.prismaService.patient.findUnique({
      where: { phone: phoneNumber },
    });
    if (!patient) return `No appointment found to cancel.`;

    const appointment = await this.prismaService.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        patientId: patient.id,
        appointmentStatus: AppointmentStatus.pending, // important safety check
      },
    });

    if (!appointment) return `No active appointment found to cancel.`;

    // Save cancellation intent
    session.aiArgs = {
      action: 'cancel',
      appointmentId: appointment.id,
      doctorId: doctor.id,
      awaitingConfirmation: true,
    };

    await this.sessionService.saveSession(phoneNumber, session);

    return `Are you sure you want to cancel your appointment? Reply YES to confirm or NO to keep it.`;
  }

  // Confirm cancellation based on user response
  private async confirmCancellation(
    phoneNumber: string,
    userMessage: string,
  ): Promise<string> {
    const session = await this.sessionService.getSession(phoneNumber);
    const aiArgs = session.aiArgs;

    if (!aiArgs?.appointmentId || !aiArgs?.doctorId) {
      session.aiArgs = {};
      await this.sessionService.saveSession(phoneNumber, session);
      return `Cancellation session expired. Please try again.`;
    }

    // YES → cancel
    if (this.isPositiveConfirmation(userMessage)) {
      await this.appointmentService.cancelAppointment(
        aiArgs.appointmentId,
        aiArgs.doctorId,
      );

      session.aiArgs = {};
      await this.sessionService.saveSession(phoneNumber, session);

      return ` Your appointment has been cancelled successfully.`;
    }

    //NO → abort the cancellation
    if (this.isNegativeConfirmation(userMessage)) {
      session.aiArgs = {};
      await this.sessionService.saveSession(phoneNumber, session);

      return `Your appointment was not cancelled.`;
    }

    //unclear response → ask again
    return `Please reply YES to confirm cancellation or NO to keep your appointment.`;
  }

  // Detect positive confirmation
  private isPositiveConfirmation(text: string): boolean {
    return ['yes', 'y', 'confirm', 'sure', 'ok', 'yeah'].includes(
      text.trim().toLowerCase(),
    );
  }

  // Detect negative confirmation
  private isNegativeConfirmation(text: string): boolean {
    return ['no', 'n', 'cancel', 'stop', 'dont'].includes(
      text.trim().toLowerCase(),
    );
  }

  // Simple intent detection to route messages
  private detectIntent(
    message: string,
  ): 'greeting' | 'appointment' | 'cancel' | 'unknown' {
    const text = message.toLowerCase();
    if (/^(hi|hello|salam|assalam|hey|aoa|sahab)/i.test(text)) {
      return 'greeting';
    }

    if (/appointment|book|schedule|time|doctor/i.test(text)) {
      return 'appointment';
    }

    if (/cancel|remove|delete/i.test(text)) {
      return 'cancel';
    }

    return 'unknown';
  }

  // Respond to greetings with a friendly message
  private async respondToGreeting(
    userMessage: string,
    doctorName: string, // pass the doctor's name here
  ): Promise<string> {
    const prompt = `
You are a warm and friendly medical receptionist.
TASK:
- Respond to the user's greeting naturally and politely.
- Detect language automatically.
- If the user message is in Roman Urdu → reply in Roman Urdu.
- Otherwise reply in English.
- DO NOT use native Urdu script.
- DO NOT use how can i assist you phrases.
- Keep it short and friendly.
- Mention that you can help with booking, rescheduling, or cancelling appointments.
- Mention the doctor by name naturally, like "with Dr. ${doctorName}" or "Dr. ${doctorName} ke sath".
- Make the response human-like, like a real person would reply over chat, not robotic.

User message:
"${userMessage}"
`;

    const response = await this.openAIService.chat([
      {
        role: 'system',
        content:
          'You are a friendly medical receptionist with excellent communication skills, cheerful tone, and human-like responses.',
      },
      { role: 'user', content: prompt },
    ]);

    return (
      response.choices?.[0]?.message?.content?.trim() ||
      // fallback, human-like
      `Hey! I’m here to help you schedule an appointment with Dr. ${doctorName}. How’s your day going?`
    );
  }

  // Respond when the doctor is unavailable
  private async respondDoctorUnavailable(userMessage: string): Promise<string> {
    const prompt = `
You are a polite medical appointment assistant.

TASK:
- Respond to the user when the requested doctor is unavailable.
- Detect the language automatically.
- If the user's message looks like Roman Urdu → reply in Roman Urdu.
- Otherwise reply in English.
- Keep it short, friendly, and professional.
- Politely inform that the doctor is unavailable.
- Ask the user to choose another date or time.
- Do NOT use native Urdu script.

User message:
"${userMessage}"
`;

    const response = await this.openAIService.chat([
      {
        role: 'system',
        content:
          'You are a friendly medical receptionist with excellent communication skills.',
      },
      { role: 'user', content: prompt },
    ]);

    return (
      response.choices?.[0]?.message?.content?.trim() ||
      'Sorry, the doctor is not available on that day Would you like to choose another date or time?'
    );
  }

  /* -------------------- MAIN ENTRY -------------------- */

  async processMessage(
    phoneNumber: string,
    userMessage: string,
    doctorPhoneNumber: string,
  ): Promise<string> {
    // Initialize session
    const session = await this.sessionService.getSession(phoneNumber);
    if (
      session.aiArgs?.action === 'cancel' &&
      session.aiArgs.awaitingConfirmation
    ) {
      return this.confirmCancellation(phoneNumber, userMessage);
    }

    // Initialize session messages
    if (!session.messages.length) {
      session.messages.push({
        role: 'system',
        content: `
You are a medical appointment assistant.

CORE RULES:
- The doctor is already selected
- NEVER ask for doctor name or specialty
- Ask ONLY for missing information
- Ask ONE question at a time
- Do NOT repeat a question already answered
- Book the appointment ONLY when all required information exists

REQUIRED INFORMATION:
- Appointment date
- Appointment time
- Patient name

LANGUAGE RULES (STRICT):
- Detect the language of the user's last message
- If the user writes in English → reply in English
- If the user writes in Urdu or Roman Urdu → reply in Roman Urdu
- NEVER mix languages
- NEVER use native Urdu script (no اردو)

DATE & TIME RULES:
- If the user says "kal" or "tomorrow", assume the correct date automatically
- If the user provides a date but no time, ask ONLY for time
- If the user provides time but no date, ask ONLY for date
- Do NOT ask for full date (day/month/year) if it can be inferred
- Use 12-hour time format (e.g., 3:00 PM)

RESPONSE STYLE:
- Be short, polite, and natural
- Do not explain internal logic
- Do not repeat previous messages
- Do not mention system rules
`,
      });
    }
    // Ensure messages array exists
    session.messages ??= [];

    const doctorName =
      await this.doctorService.getDoctorByPhone(doctorPhoneNumber);
    const nameToUse = doctorName.name;
    const intent = this.detectIntent(userMessage);
    if (intent === 'greeting') {
      return this.respondToGreeting(userMessage, nameToUse);
    }
    if (intent === 'cancel') {
      return this.handleCancellation(
        phoneNumber,
        userMessage,
        doctorPhoneNumber,
      );
    }
    // if (
    //   intent === 'appointment' &&
    //   !session.aiArgs?.date &&
    //   !session.aiArgs?.time
    // ) {
    //   const normalizedDoctorPhone = normalizePhoneNumber(doctorPhoneNumber);
    //   const doctor = await this.doctorService.getDoctorByPhone(
    //     normalizedDoctorPhone,
    //   );

    //   if (!doctor) throw new NotFoundException('Doctor not found');

    //   const available = await this.isDoctorAvailableToday(doctor.id);

    //   if (!available) {
    //     return 'Sorry, the doctor is not available today. Please try another day.';
    //   }

    //   return 'Yes, the doctor is available When would you like to book your appointment?';
    // }

    /* ---------- Resolve doctor ---------- */
    // Normalize doctor phone number
    const normalizedDoctorPhone = normalizePhoneNumber(doctorPhoneNumber);
    console.log('Normalized Doctor Phone:', normalizedDoctorPhone);
    const doctor = await this.doctorService.getDoctorByPhone(
      normalizedDoctorPhone,
    );
    if (!doctor) throw new NotFoundException('Doctor not found');
    const doctorId = doctor.id;

    /* ---------- Load AI args ---------- */
    // Load existing AI arguments or initialize
    let aiArgs: AiArgs = session.aiArgs || { doctorId };
    /* ---------- Ask for missing ---------- */
    // Extract patient name if missing
    /* ---------- Extract patient name ---------- */
    if (!aiArgs.patientName) {
      const name = await this.extractPatientName(userMessage);
      if (name) aiArgs.patientName = name;
    }
    session.aiArgs = aiArgs;
    await this.sessionService.saveSession(phoneNumber, session);

    /* ---------- Extract date/time if missing ---------- */
    if (!aiArgs.date || !aiArgs.time) {
      let textToParse = userMessage;

      if (/(kal|aaj|parson|subha|dopahar|sham|raat)/i.test(userMessage)) {
        textToParse = await this.normalizeDateTimeText(userMessage);
      }

      const parsedDate = chrono.parseDate(textToParse, new Date(), {
        forwardDate: true,
      });

      if (parsedDate) {
        const zoned = fromZonedTime(parsedDate, doctor.timezone);

        // ✅ Always set date if missing
        if (!aiArgs.date) {
          aiArgs.date = zoned.toISOString().split('T')[0];
        }

        // ✅ Set time ONLY if user explicitly said time
        if (!aiArgs.time && hasExplicitTime(textToParse)) {
          aiArgs.time = zoned.toTimeString().slice(0, 5);
        }

        // ✅ If date exists but time missing → assign default
        if (aiArgs.date && !aiArgs.time) {
          aiArgs.time = '09:00'; // clinic opening time
        }
      }
    }
    session.aiArgs = aiArgs;
    await this.sessionService.saveSession(phoneNumber, session);

    // Check for missing required info
    const missing: string[] = [];
    if (!aiArgs.date) missing.push('date');
    else if (!aiArgs.time) missing.push('time');
    else if (!aiArgs.patientName) missing.push('patient name');
    if (missing.length) {
      return this.askForMissingInfo(userMessage, missing);
    }

    session.aiArgs = aiArgs;
    await this.sessionService.saveSession(phoneNumber, session);
    /* ---------- Handle alternative slot selection ---------- */
    // If there are suggested slots, check if user selected one
    if (aiArgs.suggestedSlots?.length) {
      const selected = extractTimeFromText(userMessage);
      if (selected && aiArgs.suggestedSlots.includes(selected)) {
        aiArgs.time = selected;
        delete aiArgs.suggestedSlots;

        session.aiArgs = aiArgs;
        await this.sessionService.saveSession(phoneNumber, session);
      } else {
        return this.askForAlternativeTime(
          userMessage,
          aiArgs.time ?? '',
          aiArgs.suggestedSlots,
        );
      }
    }
    const start = new Date(`${aiArgs.date}T${aiArgs.time}:00`);
    const dayAvailable =
      await this.doctorAvailabilityService.getMyAvailability(doctorId);

    const weekday = start.getDay(); // 0–6

    if (!dayAvailable.some((d) => d.day === weekday)) {
      return this.respondDoctorUnavailable(userMessage);
    }

    /* ---------- Save session ---------- */
    // Save updated AI arguments and messages
    session.aiArgs = aiArgs;
    session.messages.push({ role: 'user', content: userMessage });
    session.messages = session.messages.slice(-MAX_MESSAGES);
    await this.sessionService.saveSession(phoneNumber, session);

    /* ---------- Check slot availability ---------- */

    // Check if the requested slot is available

    const end = new Date(start.getTime() + 15 * 60000);
    const isAvailable = await this.appointmentService.isSlotAvailable(
      doctorId,
      start,
      end,
    );

    if (!isAvailable) {
      const alternatives = await this.appointmentService.getNextAvailableSlots(
        doctorId,
        start,
        15,
        3,
      );

      // Save suggested slots in session
      session.aiArgs.suggestedSlots = alternatives;
      await this.sessionService.saveSession(phoneNumber, session);
      return this.askForAlternativeTime(
        userMessage,
        aiArgs.time ?? '',
        alternatives,
      );
    }

    // All info present → proceed to booking
    aiArgs.readyToBook = true;
    if (!aiArgs.readyToBook) {
      return 'Please confirm the details to book your appointment.';
    }
    /* ---------- Patient handling ---------- */
    // Create patient record if not exists and book appointment

    await this.prismaService.$transaction(async (tx) => {
      let patient = await tx.patient.findUnique({
        where: { phone: phoneNumber },
      });

      if (!patient) {
        patient = await tx.patient.create({
          data: {
            name: aiArgs.patientName!,
            phone: phoneNumber,
          },
        });
      }

      // Map AI arguments to appointment DTO
      const mapped = mapAiArgsToAppointment(
        aiArgs,
        phoneNumber,
        doctor.timezone,
        patient.id,
      );

      // ---------- Book appointment ---------- */
      try {
        await this.prismaService.$transaction(async (tx) => {
          await this.appointmentService.createAppointment(
            mapped.doctorId,
            mapped.dto,
            mapped.bookedBy,
            mapped.assistantId,
            tx,
          );
        });
      } catch (error) {
        //Reset AI state safely
        session.aiArgs = { doctorId };
        await this.sessionService.saveSession(phoneNumber, session);

        //Handle known business errors
        if (
          error instanceof BadRequestException &&
          error.message.includes('Doctor unavailable')
        ) {
          return this.respondDoctorUnavailable(userMessage);
        }

        //Unknown error → safe fallback
        console.error('Appointment creation failed:', error);
        return 'Sorry, something went wrong while booking your appointment. Please try again.';
      }
    });

    /* ---------- Reset session ---------- */
    // Reset AI arguments after booking
    session.aiArgs = { doctorId };
    await this.sessionService.saveSession(phoneNumber, session);

    return `Appointment booked for ${aiArgs.date} at ${aiArgs.time}`;
  }
}

/* -------------------- Utilities -------------------- */
function extractTimeFromText(text: string): string | null {
  // Regex to match time formats like "3pm", "3:30 am", "15:00", etc.
  const match = text.match(/\b(\d{1,2})(?:[:\s](\d{2}))?\s*(am|pm)?\b/i);

  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3]?.toLowerCase();

  // Handle AM/PM
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}`;
}
function normalizePhoneNumber(number: string): string {
  return number
    .replace(/[^\d+]/g, '') // Remove everything except digits and +
    .replace(/[\u200E\u200F\u202A-\u202E]/g, ''); // Remove invisible chars
}

function hasExplicitTime(text: string): boolean {
  return /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(text);
}
