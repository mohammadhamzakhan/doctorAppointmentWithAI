import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DoctorAssistantService {
  constructor(private PrismaService: PrismaService) {}

  async getAllAssistant(doctorId: number) {}
  async updateAssistant(doctorId: number, assistantId: number, dto: any) {}
  async chageMyAssistantPassword(
    doctorId: number,
    assistantId: number,
    newPassword: string,
  ) {}

  async deactivateMyAssistant(doctorId: number, assistantId: number) {}
  async deleteMyAssistant(doctorId: number, assistantId: number) {}
}
