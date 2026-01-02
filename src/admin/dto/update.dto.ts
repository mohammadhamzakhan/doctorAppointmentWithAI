import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class UpdateAdminDto {
  @ApiProperty({ required: false, description: 'Name of the admin' })
  @IsString()
  name?: string;
}
