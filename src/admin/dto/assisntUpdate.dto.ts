import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssistantUpdateDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  name: string;
}
