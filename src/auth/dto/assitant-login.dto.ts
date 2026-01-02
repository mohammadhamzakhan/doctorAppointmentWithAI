import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssistantLoginDto {
  @ApiProperty({
    example: 'assistantName',
    description: 'name of the assistant',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
  @ApiProperty({
    example: 'assistantPassword123',
    description: 'password of the assistant',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
