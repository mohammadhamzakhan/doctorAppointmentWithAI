import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ResetDoctorPasswordDto {
  @ApiProperty({ description: 'new password must atlease 6 character long' })
  @IsString()
  @Length(6)
  password: string;
}
