import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

export class AdminRegisterDto{
    @ApiProperty({ example: 'Hamza ali', description: 'Your name' })
    @IsNotEmpty()
    @IsString()
    name: string;


    @ApiProperty({ example: 'admin@example.com', description: 'Your email' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'strongPassword123', description: 'Your password' })
    @IsNotEmpty()
    @IsString()
    @Length(6)
    password: string;
}