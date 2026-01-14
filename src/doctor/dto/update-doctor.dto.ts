import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateDoctorDto {
  // REQUIRED — profile completion depends on these
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  specialization: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  phoneNumberId: string;

  // OPTIONAL — enrich profile
  @IsOptional()
  @IsString()
  clinicName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  // SETTINGS (safe defaults exist in DB)
  @IsOptional()
  @IsBoolean()
  isAutoBooking?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotDuration?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  waAccessToken?: string;
}
