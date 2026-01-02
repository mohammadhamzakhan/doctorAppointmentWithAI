import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { AdminUpdateDoctorDto } from './dto/adminDoctorUpdate.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminDoctorService {
  constructor(private prisma: PrismaService) {}

  async getAllDoctors() {
    try {
      const doctors = await this.prisma.doctor.findMany();

      return doctors;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // List all doctors
  async getDoctorById(doctorId: number) {
    try {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (!doctor)
        throw new NotFoundException(`Doctor with id ' ${doctorId} ' Not Found`);

      return doctor;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Get a single doctor by ID
  async updateDoctor(doctorId: number, dto: AdminUpdateDoctorDto) {
    try {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (!doctor) throw new NotFoundException('Doctor not found');

      const udpatedDoctor = await this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          name: dto.name,
          specialization: dto.specialization,
        },
      });
      return udpatedDoctor;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Update doctor info
  async deactivateDoctor(doctorId: number) {
    try {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });

      if (!doctor) throw new NotFoundException('Doctor not found');

      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          isActive: false,
        },
      });
      return { message: `Doctor with id ${doctorId} is Deactivated` };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Soft-delete / deactivate doctor
  async resetDoctorPassword(doctorId: number, newPassword: string) {
    try {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });

      if (!doctor) throw new NotFoundException('Doctor not found');

      const hashedPass = await bcrypt.hash(newPassword, 10);
      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          password: hashedPass,
        },
      });
      return { message: `Password has been reset for Account ${doctor.name}` };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Reset doctor password
}
