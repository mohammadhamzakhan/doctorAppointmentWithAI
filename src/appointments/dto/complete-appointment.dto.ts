import { IsOptional, IsBoolean } from 'class-validator';

export class CompleteAppointmentDto {
  @IsOptional()
  @IsBoolean()
  isNoShow?: boolean;
}
