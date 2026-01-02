import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email for Admin/Doctor or name for Assistant' })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'Password for the account' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
