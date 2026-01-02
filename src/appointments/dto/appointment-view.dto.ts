import { IsDateString, IsEnum } from 'class-validator';

export class AppointmentViewDto {
  @IsEnum(['daily', 'weekly', 'monthly'])
  view: 'daily' | 'weekly' | 'monthly';

  @IsDateString()
  date: string;
}
