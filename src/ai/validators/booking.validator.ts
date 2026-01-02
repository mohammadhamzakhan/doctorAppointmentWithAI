import { BadRequestException } from '@nestjs/common';

export function validateBookingArgs(args: any) {
  if (!args.patientName) {
    throw new BadRequestException('Patient name is required');
  }

  if (!args.date || !args.time) {
    throw new BadRequestException('Date and time are required');
  }
}
