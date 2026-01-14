import { Injectable } from '@nestjs/common';
import { OpenAiService } from './service/openai.service';
import { SessionService } from './service/session.service';
import { DoctorService } from 'src/doctor/doctor.service';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { detectIntend } from './helper/AI_helpers/detect.intend.helper';
import { buildDoctorSystemPrompt } from './helper/AI_helpers/build-doctor-system-prompt.helper';
import { respondToUnavailablity } from './helper/AI_helpers/respond-to-unavailability.helper';
import { respondToUnknownIntend } from './helper/AI_helpers/respond-to-unknown-intend.helper';
import { bookingAppointment } from './helper/AI_helpers/booking-appointment.helper';
import { respondToDoctorInfo } from './helper/AI_helpers/respond-to-doctor-info.helper';
import { respondToGreetings } from './helper/AI_helpers/respond-to-greetings.helper';

//max message per person to keep in the session
const MAX_MESSAGES = 30;

enum AppointmentStatus {
  pending = 'pending',
  confirm = 'confirm',
  cancelled = 'cancelled',
  completed = 'completed',
}

@Injectable()
export class AIProcessor {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly sessionService: SessionService,
    private readonly doctorService: DoctorService,
    private readonly appointmentService: AppointmentsService,
    private readonly prisma: PrismaService,
  ) {}

  async processMessage(
    phoneNumber: string,
    userMessage: string,
    doctorPhoneNumber: string,
  ): Promise<string> {
    // Session initialization
    const session = await this.sessionService.getSession(phoneNumber);
    session.messages ??= [];

    // Store user message
    session.messages.push({ role: 'user', content: userMessage });

    // Get doctor
    const doctor = await this.doctorService.getDoctorByPhone(doctorPhoneNumber);
    if (!session.messages || session.messages.length === 0) {
      session.messages = [
        {
          role: 'assistant',
          content: buildDoctorSystemPrompt(doctor),
        },
      ];
    }
    const doctorName = doctor.name;
    console.log('This is the doctor id *******>>>> ' + doctor.id);

    // Handle menu selection first
    if (session.menuState === 'AWAITING_MENU_SELECTION') {
      const trimmed = userMessage.trim();

      switch (trimmed) {
        case '1':
          session.menuState = 'BOOKING_FLOW';
          break; // don't call bookingAppointment here yet
        case '2':
          session.menuState = 'DOCTOR_INFO_FLOW';
          await this.sessionService.saveSession(phoneNumber, session);
          return await respondToDoctorInfo(
            doctor.id,
            userMessage,
            this.doctorService,
            this.openAiService,
          );
        case '3':
          session.menuState = 'RESCHEDULE_FLOW';
          await this.sessionService.saveSession(phoneNumber, session);
          return '*Sure!* Please share your *appointment ID* or registered name.';
        case '4':
          session.menuState = 'CANCEL_FLOW';
          await this.sessionService.saveSession(phoneNumber, session);
          return '*No problem.* Please share your *appointment ID* to cancel.';
        default:
      }
    }

    // --- NEW: Always call bookingAppointment if in booking flow ---
    if (session.menuState === 'BOOKING_FLOW') {
      const reply = await bookingAppointment(
        doctor.id,
        userMessage,
        session,
        phoneNumber,
        this.appointmentService,
        this.openAiService,
        this.prisma,
      );
      session.messages.push({ role: 'assistant', content: reply });
      await this.sessionService.saveSession(phoneNumber, session);
      return reply;
    }

    // Detect intent
    const intent = detectIntend(userMessage);

    // Handle greetings
    if (intent === 'greeting') {
      const reply = await respondToGreetings(
        doctorName,
        userMessage,
        this.openAiService,
      );
      session.messages.push({ role: 'assistant', content: reply });
      session.menuState = 'AWAITING_MENU_SELECTION';
      await this.sessionService.saveSession(phoneNumber, session);
      return reply;
    }

    // Handle doctor info
    if (intent === 'info') {
      let reply = '';
      const isTodayQuery = /today|aj|aaj|/i.test(userMessage);

      if (
        !doctor.doctorAvailabilities ||
        doctor.doctorAvailabilities.length === 0
      ) {
        reply = await respondToUnavailablity(
          doctor.id,
          userMessage,
          this.doctorService,
          this.openAiService,
        );
      } else if (isTodayQuery) {
        reply = await respondToUnavailablity(
          doctor.id,
          userMessage,
          this.doctorService,
          this.openAiService,
        );
      }
      reply = await respondToDoctorInfo(
        doctor.id,
        userMessage,
        this.doctorService,
        this.openAiService,
      );
      session.messages.push({ role: 'assistant', content: reply });
      await this.sessionService.saveSession(phoneNumber, session);
      return reply;
    }

    if (intent === 'unknown') {
      const reply = await respondToUnknownIntend(
        doctor.id,
        userMessage,
        this.doctorService,
        this.openAiService,
      );
      return reply;
    }

    // Sanitize messages before sending to AI
    const validMessages = session.messages.map((msg) => {
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .map((part) =>
            typeof part === 'string' ? part : ((part as any).text ?? ''),
          )
          .join('');
      } else {
        content = '';
      }
      return {
        ...msg,
        content: content.trim(),
      };
    });

    // AI reply
    const aireply = await this.openAiService.chat(validMessages);
    let aiMessage = aireply.choices[0]?.message?.content?.trim() ?? '';
    if (!aiMessage)
      aiMessage = "Sorry, I didn't understand that. Can you rephrase?";

    // Store AI reply
    session.messages.push({
      role: 'assistant',
      content: aiMessage,
    });

    // Limit session size

    session.messages = session.messages.slice(-MAX_MESSAGES);

    // Save session
    await this.sessionService.saveSession(phoneNumber, session);

    return aiMessage;
  }
}
