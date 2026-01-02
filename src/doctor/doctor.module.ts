import { Module } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DoctorAssistantService } from './doctor-assistant.service';

@Module({
  imports: [PrismaModule],
  controllers: [DoctorController],
  providers: [DoctorService, DoctorAssistantService],
  exports: [DoctorService],
})
export class DoctorModule {}
