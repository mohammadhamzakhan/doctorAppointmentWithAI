import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class DoctorAvailabilityService {
  constructor(private prisma: PrismaService) {}

  async getMyAvailability(doctorId: number) {
    try {
      const get = await this.prisma.doctorAvailability.findMany({
        where: { doctorId },
      });
      if (!get) throw new NotFoundException('Not found');
      return get;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
  async createAvailability(doctorId: number, dto: createAvailabilityDto) {
    try {
      await this.prisma.doctorAvailability.create({
        data: {
          doctorId,
          day: dto.day,
          startTime: dto.startTime,
          endTime: dto.endTime,
          isActive: dto.isActive,
        },
      });
      return { message: 'Created' };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
  async updateAvailability(id: number, dto: UpdateAvailabilityDto) {
    try {
      const existing = await this.prisma.doctorAvailability.findUnique({
        where: { id: id },
      });
      if (!existing) throw new NotFoundException('Not found');

      return await this.prisma.doctorAvailability.update({
        where: { id: id },
        data: { ...dto },
      });
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
  async deleteAvailability(id: number) {
    try {
      const existing = await this.prisma.doctorAvailability.findUnique({
        where: { id: id },
      });
      if (!existing) throw new NotFoundException('Not found');

      await this.prisma.doctorAvailability.delete({ where: { id: id } });
      return { message: 'Delete successfully' };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
}
