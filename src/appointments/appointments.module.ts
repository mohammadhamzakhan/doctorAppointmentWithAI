import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AppointmentsController } from './appointments.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
