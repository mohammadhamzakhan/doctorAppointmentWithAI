import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Length } from 'class-validator';

export class DoctorChangePassword {
  @ApiProperty({ description: 'current password' })
  @IsNotEmpty()
  @Length(6)
  oldPassword: string;

  @ApiProperty({ description: 'password must be atleast 6 character long' })
  @IsNotEmpty()
  @Length(6)
  newPassword: string;
}
