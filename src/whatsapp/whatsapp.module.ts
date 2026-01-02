import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { DoctorService } from 'src/doctor/doctor.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AIProcessor } from 'src/ai/ai.processor';
import { SessionService } from 'src/ai/service/session.service';
import { OpenAiService } from 'src/ai/service/openai.service';
import { DoctorAvailabilityService } from 'src/doctor-availability/doctor-availability.service';

@Module({
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    AIProcessor,
    SessionService,
    AppointmentsService,
    DoctorService,
    DoctorAvailabilityService,
    PrismaService,
    OpenAiService,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
