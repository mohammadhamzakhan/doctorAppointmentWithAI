import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { DoctorModule } from './doctor/doctor.module';
import { DoctorAvailabilityService } from './doctor-availability/doctor-availability.service';
import { DoctorAvailabilityModule } from './doctor-availability/doctor-availability.module';
import { AppointmentsController } from './appointments/appointments.controller';
import { AppointmentsService } from './appointments/appointments.service';
import { AppointmentsModule } from './appointments/appointments.module';
import { AiModule } from './ai/ai.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: `.env`,
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    MailModule,
    DoctorModule,
    DoctorAvailabilityModule,
    AppointmentsModule,
    AiModule,
    WhatsAppModule,
  ],
  providers: [DoctorAvailabilityService, AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppModule {}
