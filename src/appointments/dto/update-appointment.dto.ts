import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  appointmentStatus?: AppointmentStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
