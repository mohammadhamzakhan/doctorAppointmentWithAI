import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AdminRegisterDto,
  AssistantRegisterDto,
  DoctorRegisterDto,
  LoginDto,
} from './dto';
import { Role } from './enum/role.enum';
import { RoleGuard } from './guard/role.guard';
import { Roles } from './decorator/role.decorator';
import { JwtAccessGuard } from './guard/auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

class RequestEmailChangeDto {
  email: string;
  code: string;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/signup')
  async adminSignUp(@Body() dto: AdminRegisterDto) {
    return this.authService.signUp(dto, Role.Admin);
  }

  @Post('doctor/signup')
  async doctorSignUp(@Body() dto: DoctorRegisterDto) {
    return this.authService.signUp(dto, Role.Doctor);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAccessGuard, RoleGuard)
  @Roles(Role.Doctor)
  @Post('assistant/signup')
  async assistantSignUp(
    @Body() dto: AssistantRegisterDto,
    @Request() req: any,
  ) {
    dto.doctorId = req.user.sub; // assign the logged-in doctor’s ID
    console.log('Logged-in Doctor ID:', req.user.sub);

    return this.authService.signUp(dto, Role.Assistant);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.signIn(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAccessGuard)
  @Patch('email/change')
  async requestEmailChangCode(@Request() req: any) {
    const userId = req.user.sub;
    const role = req.user.role as Role;
    if (role === Role.Assistant) {
      throw new ForbiddenException('Assistants cannot change email');
    }
    return this.authService.requestEmailChange(userId, role);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAccessGuard)
  @Patch('email/changeVerify')
  async changeEmail(
    @Request() req: any,
    @Body() newEmail: RequestEmailChangeDto,
  ) {
    const userId = req.user.sub;
    const role = req.user.role as Role;
    if (role === Role.Assistant) {
      throw new ForbiddenException('Assistants cannot change email');
    }
    return this.authService.changeEmailVerification(
      userId,
      role,
      newEmail.code,
      newEmail.email,
    );
  }
}
