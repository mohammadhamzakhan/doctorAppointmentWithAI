import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class DoctorRegisterDto {
    @ApiProperty({ example: 'Dr. John Doe', description: 'Full name of the doctor' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({example: 'john@example.com', description: 'Email address'})
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'Cardiology', description: 'Specialization of the doctor' })
    @IsString()
    @IsNotEmpty()
    specialization: string;

    @ApiProperty({ example: 'securePassword123', description: 'Password for the account' })
    @IsString()
    @IsNotEmpty()
    password: string;
}