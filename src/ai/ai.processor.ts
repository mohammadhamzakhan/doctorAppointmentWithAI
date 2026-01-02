import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OpenAiService } from './service/openai.service';
import { SessionService } from './service/session.service';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { mapAiArgsToAppointment } from './mappers/appointment.mapper';
import * as chrono from 'chrono-node';
import { DoctorService } from 'src/doctor/doctor.service';
import { fromZonedTime } from 'date-fns-tz';
import { PrismaService } from 'src/prisma/prisma.service';

const MAX_MESSAGES = 20;
enum AppointmentStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  cancelled = 'cancelled',
  completed = 'completed',
  rescheduled = 'rescheduled',
}
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
  ) {}

  /* -------------------- AI HELPERS -------------------- */

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
  private async handleCancellation(
    phoneNumber: string,
    userMessage: string,
    doctorPhoneNumber: string,
  ): Promise<string> {
    const session = await this.sessionService.getSession(phoneNumber);

    // 🔁 STEP 2: Handle confirmation response
    if (
      session.aiArgs?.action === 'cancel' &&
      session.aiArgs.awaitingConfirmation
    ) {
      return this.confirmCancellation(phoneNumber, userMessage);
    }

    // 🔁 STEP 1: Start cancellation flow
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

    // 🧠 Save cancellation intent
    session.aiArgs = {
      action: 'cancel',
      appointmentId: appointment.id,
      doctorId: doctor.id,
      awaitingConfirmation: true,
    };

    await this.sessionService.saveSession(phoneNumber, session);

    return `⚠️ Are you sure you want to cancel your appointment? Reply YES to confirm or NO to keep it.`;
  }
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

    // ✅ YES → cancel
    if (this.isPositiveConfirmation(userMessage)) {
      await this.appointmentService.cancelAppointment(
        aiArgs.appointmentId,
        aiArgs.doctorId,
      );

      session.aiArgs = {};
      await this.sessionService.saveSession(phoneNumber, session);

      return `✅ Your appointment has been cancelled successfully.`;
    }

    // ❌ NO → abort
    if (this.isNegativeConfirmation(userMessage)) {
      session.aiArgs = {};
      await this.sessionService.saveSession(phoneNumber, session);

      return `👍 Your appointment was not cancelled.`;
    }

    // ❓ unclear response
    return `Please reply YES to confirm cancellation or NO to keep your appointment.`;
  }
  private isPositiveConfirmation(text: string): boolean {
    return ['yes', 'y', 'confirm', 'sure', 'ok', 'yeah'].includes(
      text.trim().toLowerCase(),
    );
  }

  private isNegativeConfirmation(text: string): boolean {
    return ['no', 'n', 'cancel', 'stop', 'dont'].includes(
      text.trim().toLowerCase(),
    );
  }

  /* -------------------- MAIN ENTRY -------------------- */

  async processMessage(
    phoneNumber: string,
    userMessage: string,
    doctorPhoneNumber: string,
  ): Promise<string> {
    const session = await this.sessionService.getSession(phoneNumber);
    if (
      session.aiArgs?.action === 'cancel' &&
      session.aiArgs.awaitingConfirmation
    ) {
      return this.confirmCancellation(phoneNumber, userMessage);
    }
    if (!session.messages.length) {
      session.messages.push({
        role: 'system',
        content: `
You are a medical appointment assistant.

Rules:
- Doctor already selected
- Never ask for doctor
- Ask only for missing info
- Ask one question at a time
- Book only when all info exists
`,
      });
    }

    /* ---------- Resolve doctor ---------- */
    const normalizedDoctorPhone = normalizePhoneNumber(doctorPhoneNumber);
    console.log('Normalized Doctor Phone:', normalizedDoctorPhone);
    const doctor = await this.doctorService.getDoctorByPhone(
      normalizedDoctorPhone,
    );
    if (!doctor) throw new NotFoundException('Doctor not found');
    const doctorId = doctor.id;

    /* ---------- Load AI args ---------- */
    let aiArgs: AiArgs = session.aiArgs || { doctorId };

    /* ---------- Handle alternative slot selection ---------- */
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

    /* ---------- Normalize + Parse date/time ---------- */
    if (!aiArgs.date || !aiArgs.time) {
      let textToParse = userMessage;
      if (/(kal|parson|subha|dopahar|sham|raat)/i.test(userMessage)) {
        textToParse = await this.normalizeDateTimeText(userMessage);
      }
      // detect if the user wants to cancel
      // if (/cancel|remove|delete/i.test(userMessage)) {
      //   return this.handleCancellation(
      //     phoneNumber,
      //     userMessage,
      //     doctorPhoneNumber,
      //   );
      // }

      const parsedDate = chrono.parseDate(textToParse, new Date(), {
        forwardDate: true,
      });

      if (parsedDate) {
        const zoned = fromZonedTime(parsedDate, doctor.timezone);
        aiArgs.date = zoned.toISOString().split('T')[0];
        aiArgs.time = zoned.toTimeString().slice(0, 5);
      }
    }

    /* ---------- Extract patient name ---------- */
    if (!aiArgs.patientName) {
      const name = await this.extractPatientName(userMessage);
      if (name) aiArgs.patientName = name;
    }

    /* ---------- Save session ---------- */
    session.aiArgs = aiArgs;
    session.messages.push({ role: 'user', content: userMessage });
    session.messages = session.messages.slice(-MAX_MESSAGES);
    await this.sessionService.saveSession(phoneNumber, session);

    /* ---------- Ask for missing ---------- */
    const missing: string[] = [];
    if (!aiArgs.date || !aiArgs.time) missing.push('date and time');
    if (!aiArgs.patientName) missing.push('patient name');
    if (missing.length) {
      return this.askForMissingInfo(userMessage, missing);
    }

    /* ---------- Check slot availability ---------- */
    const start = new Date(`${aiArgs.date}T${aiArgs.time}:00`);
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

      session.aiArgs.suggestedSlots = alternatives;
      await this.sessionService.saveSession(phoneNumber, session);
      return this.askForAlternativeTime(
        userMessage,
        aiArgs.time ?? '',
        alternatives,
      );
    } /* ---------- Patient handling ---------- */
    let patient = await this.prismaService.patient.findUnique({
      where: { phone: phoneNumber },
    });
    if (!patient) {
      patient = await this.prismaService.patient.create({
        data: { name: aiArgs.patientName!, phone: phoneNumber },
      });
    }

    /* ---------- Create appointment ---------- */
    const mapped = mapAiArgsToAppointment(
      aiArgs,
      phoneNumber,
      doctor.timezone,
      patient.id,
    );
    await this.appointmentService.createAppointment(
      mapped.doctorId,
      mapped.dto,
      mapped.bookedBy,
      mapped.assistantId,
    );

    /* ---------- Reset session ---------- */
    session.aiArgs = { doctorId };
    await this.sessionService.saveSession(phoneNumber, session);

    return `Appointment booked for ${aiArgs.date} at ${aiArgs.time}`;
  }
}

/* -------------------- Utilities -------------------- */
function extractTimeFromText(text: string): string | null {
  // Match: 10, 10:15, 10 15, 10am, 10 am
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
