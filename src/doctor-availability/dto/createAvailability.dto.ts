// src/availability/dto/create-availability.dto.ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAvailabilityDto {
  @ApiProperty({
    description: 'Day(s) of the week for availability, e.g., "1-6"',
    example: '1-6',
  })
  @IsNotEmpty()
  @IsString()
  day: string;

  @ApiProperty({
    description: 'Start time in format "h:mm am/pm"',
    example: '9:00 am',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([1-9]|1[0-2]):[0-5][0-9]\s?(am|pm)$/i, {
    message: 'startTime must be in format "h:mm am/pm"',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time in format "h:mm am/pm"',
    example: '8:00 pm',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([1-9]|1[0-2]):[0-5][0-9]\s?(am|pm)$/i, {
    message: 'endTime must be in format "h:mm am/pm"',
  })
  endTime: string;
}
