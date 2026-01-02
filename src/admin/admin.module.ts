import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminDoctorService } from './admin-doctor.service';
import { AdminAssistantService } from './admin-assistant.service';
import { AdminAppointmentService } from './admin-appointment.service';
import { AdminReportService } from './admin-report.service';
import { AdminSettingsService } from './admin-settings.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminDoctorService,
    AdminAssistantService,
    AdminAppointmentService,
    AdminReportService,
    AdminSettingsService,
  ],
})
export class AdminModule {}
