import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AdminUpdateDoctorDto {
  @ApiProperty({ description: 'Update your name' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Cardialogy',
    description: 'Update your Specialization',
  })
  @IsString()
  specialization: string;
}
