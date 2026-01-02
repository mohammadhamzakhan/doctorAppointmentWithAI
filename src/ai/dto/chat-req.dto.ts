import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    example: '+123456789',
    description: 'Simulated WhatsApp Phone Number of the patient',
  })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    example: 'I want to book an appointment for tomorrow at 10 AM',
    description: 'Message from the user',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({
    example: '+987654321',
    description: 'Doctor’s phone number (required for booking)',
  })
  @IsNotEmpty()
  @IsString()
  doctorPhoneNumber: string; // ✅ required
}
