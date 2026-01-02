import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class AssistantRegisterDto {

    @ApiProperty({ example: 'Alice Smith', description: 'Full name of the assistant' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ example: 'securePassword123', description: 'Password for the account' })
    @IsNotEmpty()
    @IsString()
    password: string;

    @ApiProperty({example: 1, description: 'ID of the supervising doctor'})
    @IsNotEmpty()
    @IsInt()
    doctorId: number;
}