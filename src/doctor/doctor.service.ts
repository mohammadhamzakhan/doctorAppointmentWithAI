import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import * as bcrypt from 'bcrypt';
import { DoctorChangePassword } from './dto/doctor-changePass.dto';

@Injectable()
export class DoctorService {
  constructor(private prisma: PrismaService) {}

  async getMyProfile(doctorId: number) {
    try {
      const getMe = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: {
          id: true,
          name: true,
          email: true,
          specialization: true,
          bio: true,
          doctorAvailabilities: true,
        },
      });

      if (!getMe) throw new NotFoundException(`${doctorId} not found!`);

      return getMe;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
  // doctor.service.ts
  async getDoctorByPhoneId(phoneNumberId: string) {
    return this.prisma.doctor.findUnique({
      where: { phoneNumberId: phoneNumberId },
    });
  }

  async getDoctorByPhone(doctorPhoneNumber: string) {
    try {
      const doctor = await this.prisma.doctor.findFirst({
        where: { phoneNumber: doctorPhoneNumber },
      });

      if (!doctor)
        throw new NotFoundException(
          `Doctor with phone number ${doctorPhoneNumber} not found!`,
        );

      return doctor;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async updateMyProfile(doctorId: number, dto: UpdateDoctorDto) {
    try {
      const getMe = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });

      if (!getMe) throw new NotFoundException(`${doctorId} not found!`);
      const normalizedDoctorPhone = normalizePhoneNumber(dto.phoneNumber);

      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          ...dto,
          phoneNumber: normalizedDoctorPhone,
          isProfileCompleted: true,
        },
      });

      return { message: 'Profile updated' };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
  async changeMyPassword(doctorId: number, dto: DoctorChangePassword) {
    try {
      const getMe = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (!getMe) throw new NotFoundException(`${doctorId} not found!`);

      const isMatch = await bcrypt.compare(dto.oldPassword, getMe.password);

      if (!isMatch) throw new ForbiddenException('Password not match');
      if (dto.oldPassword === dto.newPassword)
        throw new ForbiddenException(
          'Choose another password it was already used',
        );
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          password: hashedPassword,
          loginAtempts: 0,
        },
      });

      return { message: 'Password changed successfully' };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async deactivateMyAccount(doctorId: number) {
    try {
      const getMe = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (!getMe) throw new NotFoundException(`${doctorId} not found!`);

      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: { isActive: false },
      });
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
}
function normalizePhoneNumber(number: string): string {
  return number
    .replace(/[^\d+]/g, '') // Remove everything except digits and +
    .replace(/[\u200E\u200F\u202A-\u202E]/g, ''); // Remove invisible chars
}
