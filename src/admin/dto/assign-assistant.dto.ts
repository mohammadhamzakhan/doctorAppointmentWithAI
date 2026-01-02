// dto/assign-assistant.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignAssistantDto {
  @ApiProperty({
    example: 2,
    description: 'Doctor ID to assign the assistant to',
  })
  @IsInt()
  doctorId: number;
}
