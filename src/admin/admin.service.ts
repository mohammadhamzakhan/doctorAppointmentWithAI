import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateAdminDto } from './dto/update.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAdminById(adminId: number) {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
      });
      if (!admin) {
        throw new Error('Admin not found');
      }

      return admin;
    } catch (err) {
      throw err;
    }
  }
  async updateAdmin(adminId: number, updateData: UpdateAdminDto) {
    try {
      const getAdmin = await this.prisma.admin.findUnique({
        where: { id: adminId },
      });
      if (!getAdmin) {
        throw new Error('Admin not found');
      }

      const updatedAdmin = await this.prisma.admin.update({
        where: { id: adminId },
        data: updateData,
      });

      return updatedAdmin;
    } catch (err) {
      throw err;
    }
  }
  async deleteMyAccount(adminId: number) {
    try {
      return this.prisma.admin.update({
        where: { id: adminId },
        data: {
          isActive: false,
          hashToken: null,
        },
      });
    } catch (err) {
      throw new InternalServerErrorException(`Internel Server Error ${err}`);
    }
  }
}
