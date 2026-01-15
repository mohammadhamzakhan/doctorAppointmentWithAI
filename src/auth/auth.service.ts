import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AdminRegisterDto,
  AssistantRegisterDto,
  DoctorRegisterDto,
  LoginDto,
} from './dto';
import { Role } from './enum/role.enum';
import * as bcrypt from 'bcrypt';
import * as argon from 'argon2';
import { ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { MailService } from 'src/mail/mail.service';
import { addMinutes, isAfter } from 'date-fns';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mailService: MailService,
  ) {}

  private resovleModel(role: Role) {
    switch (role) {
      case Role.Admin:
        return this.prisma.admin;
      case Role.Doctor:
        return this.prisma.doctor;
      case Role.Assistant:
        return this.prisma.assistant;
      default:
        throw new Error(`Invalid role: ${role}`);
    }
  }
  async signUp(
    dto: AdminRegisterDto | DoctorRegisterDto | AssistantRegisterDto,
    role: Role,
  ) {
    try {
      const prismaModel = this.resovleModel(role);

      // Assistant sign-up
      if (role === Role.Assistant) {
        const assistantDto = dto as AssistantRegisterDto;

        if (!assistantDto.doctorId)
          throw new Error('Assistant must have a valid doctorId');

        assistantDto.name = assistantDto.name.toLowerCase();

        const existingAssistant = await this.prisma.assistant.findUnique({
          where: { name: assistantDto.name },
        });

        if (existingAssistant)
          throw new ForbiddenException('Assistant name already exists');

        const hashedPassword = await bcrypt.hash(assistantDto.password, 10);

        const createdAssistant = await this.prisma.assistant.create({
          data: {
            name: assistantDto.name,
            password: hashedPassword,
            doctorId: assistantDto.doctorId,
          },
        });

        const token = await this.generateToken(
          createdAssistant.id,
          createdAssistant.name,
          role,
        );
        await this.storeRefreshToken(
          createdAssistant.id,
          role,
          token.refreshToken,
        );

        return {
          id: createdAssistant.id,
          name: createdAssistant.name,
          ...token,
        };
      }

      // Admin & Doctor sign-up
      const email = (dto as any).email;

      if (!email || typeof email !== 'string')
        throw new Error('DTO must contain an email');

      const existingUser = await (prismaModel as any).findUnique({
        where: { email },
      });

      if (existingUser)
        throw new ForbiddenException('User with this email already exists');

      if (!dto.password || dto.password.length < 6)
        throw new ForbiddenException('Password must be at least 6 characters');

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const createdUser = await (prismaModel as any).create({
        data: {
          ...dto,
          password: hashedPassword,
        },
      });

      const token = await this.generateToken(createdUser.id, email, role);

      await this.storeRefreshToken(createdUser.id, role, token.refreshToken);

      return {
        id: createdUser.id,
        email: createdUser.email,
        ...token,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async signIn(dto: LoginDto) {
    let role: Role | undefined;
    let user: any;

    // Check Assistant first by name
    user = await this.prisma.assistant.findUnique({
      where: { name: dto.identifier },
    });
    if (user) role = Role.Assistant;

    // If not found, check Doctor by email
    if (!user) {
      user = await this.prisma.doctor.findUnique({
        where: { email: dto.identifier },
      });
      if (user) role = Role.Doctor;
    }

    // If not found, check Admin by email
    if (!user) {
      user = await this.prisma.admin.findUnique({
        where: { email: dto.identifier },
      });
      if (user) role = Role.Admin;
    }

    if (!user || !role) {
      throw new ForbiddenException('Invalid credentials');
    }

    const prismaModel = this.resovleModel(role);

    if (!user) throw new ForbiddenException('Invalid credentials');

    if (!user.isActive) throw new ForbiddenException('User is inactive');

    const MAX_LOGIN_ATTEMPTS = 5;
    if (user.loginAtempts >= MAX_LOGIN_ATTEMPTS) {
      throw new ForbiddenException(
        'Account locked due to too many failed login attempts',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await (prismaModel as any).update({
        where: { id: user.id },
        data: { loginAtempts: { increment: 1 } },
      });
      throw new ForbiddenException('Invalid credentials');
    }

    const updatedUser = await (prismaModel as any).update({
      where: { id: user.id },
      data: { loginAtempts: 0, lastLogin: new Date() },
    });

    const identifierForToken =
      role === Role.Assistant ? updatedUser.name : updatedUser.email;

    const token = await this.generateToken(
      updatedUser.id,
      identifierForToken,
      role,
    );

    await this.storeRefreshToken(updatedUser.id, role, token.refreshToken);
    return {
      id: updatedUser.id,
      identifier: identifierForToken,
      role,
      ...token,
    };
  }

  async generateToken(userId: number, identifier: string, role: Role) {
    const payload = {
      sub: userId,
      identifier,
      role, // must be Role.Doctor / Role.Admin / Role.Assistant
    };

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '1h',
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId: number, role: Role, refreshToken: string) {
    try {
      if (!role) {
        throw new ForbiddenException('Role must be provided');
      }

      const hashedToken = await argon.hash(refreshToken);

      const prismaModel = this.resovleModel(role);

      await (prismaModel as any).update({
        where: { id: userId },
        data: { hashToken: hashedToken },
      });
    } catch (err) {
      console.log(err);
      throw ApiInternalServerErrorResponse;
    }
  }

  async refreshToken(userId: number, refreshToken: string, role: Role) {
    const prismaModel = this.resovleModel(role);
    const user = await (prismaModel as any).findUnique({
      where: { id: userId },
    });

    if (!user || !user.hashToken) {
      throw new ForbiddenException('Access Denied');
    }

    const isValid = await argon.verify(user.hashToken, refreshToken);
    if (!isValid) throw new ForbiddenException('invalid refresh token');
    const tokens = await this.generateToken(user.id, user.email, role);
    await this.storeRefreshToken(user.id, role, tokens.refreshToken);

    return tokens;
  }

  async requestEmailChange(userId: number, role: Role.Admin | Role.Doctor) {
    const prismaModel = this.resovleModel(role);
    const user = await (prismaModel as any).findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const code = this.generateOtp();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    //send otp the the old email
    await this.mailService.emailChangeOtp(user.email, code);
    console.log(user.email);
    await (prismaModel as any).update({
      where: { id: userId },
      data: {
        emailChangeCode: code,
        emailChangeExpiry: expiry,
      },
    });

    return {
      message: `Verification codes sent to your ${user.email} email addresses`,
    };
  }
  // Verify Email Change
  // -----------------------
  async changeEmailVerification(
    userId: number,
    role: Role.Admin | Role.Doctor,
    code: string,
    newEmail: String,
  ) {
    const prismaModel = this.resovleModel(role);
    const user = await (prismaModel as any).findUnique({
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException('User not found');

    if (code !== user.emailChangeCode)
      throw new ForbiddenException('Invalid verification code');

    if (isAfter(new Date(), user.emailChangeExpiry))
      throw new ForbiddenException('OTP expired');

    // update email safely
    await (prismaModel as any).update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailChangeCode: null,

        emailChangeExpiry: null,
      },
    });

    return { message: 'Email Changed successfully' };
  }

  // -----------------------
  // Request Password Reset
  // -----------------------
  async requestPasswordReset(
    email: string,
    role: Role.Admin | Role.Doctor | Role.Assistant,
  ) {
    const prismaModel = this.resovleModel(role);
    const user = await (prismaModel as any).findUnique({ where: { email } });
    if (!user) throw new ForbiddenException('User not found');

    const otp = this.generateOtp();
    const expiry = addMinutes(new Date(), 10);

    await (prismaModel as any).update({
      where: { id: user.id },
      data: {
        emailChangeCodeNew: otp, // reuse field for password reset OTP
        emailChangeExpiry: expiry,
      },
    });

    await this.mailService.sendPasswordResetEmail(email, otp);

    return { message: 'OTP sent to email' };
  }

  // -----------------------
  // Verify Password Reset
  // -----------------------
  async verifyPasswordReset(
    email: string,
    otp: string,
    newPassword: string,
    role: Role.Admin | Role.Doctor | Role.Assistant,
  ) {
    const prismaModel = this.resovleModel(role);
    const user = await (prismaModel as any).findUnique({ where: { email } });
    if (!user) throw new ForbiddenException('User not found');

    if (
      user.emailChangeCodeNew !== otp ||
      isAfter(new Date(), user.emailChangeExpiry)
    )
      throw new ForbiddenException('Invalid or expired OTP');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (prismaModel as any).update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        emailChangeCodeNew: null,
        emailChangeExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }
  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  }
}
