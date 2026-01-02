import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  pateintName: string;

  @IsString()
  patientPhone: string;

  // ISO string from UI / AI
  @IsDateString()
  scheduledStart: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
