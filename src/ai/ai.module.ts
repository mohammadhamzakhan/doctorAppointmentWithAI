import { Module } from '@nestjs/common';
import { AppointmentsModule } from 'src/appointments/appointments.module';
import { DoctorModule } from 'src/doctor/doctor.module';
import { AIProcessor } from './ai.processor';
import { OpenAiService } from './service/openai.service';
import { SessionService } from './service/session.service';
import { AIController } from './ai.controller';
import { DoctorAvailabilityModule } from 'src/doctor-availability/doctor-availability.module';

@Module({
  imports: [AppointmentsModule, DoctorModule, DoctorAvailabilityModule],
  controllers: [AIController],
  providers: [AIProcessor, OpenAiService, SessionService],
  exports: [AIProcessor],
})
export class AiModule {}
