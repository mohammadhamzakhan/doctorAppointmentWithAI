import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssistantUpdateDto } from './dto/assisntUpdate.dto';

@Injectable()
export class AdminAssistantService {
  constructor(private prisma: PrismaService) {}
  async getAllAssistants() {
    try {
      const assistants = await this.prisma.assistant.findMany();
      if (!assistants) throw new NotFoundException('Assistants not found');

      return assistants;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // List all assistants
  async getAssistantById(assistantId: number) {
    try {
      const assistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId },
      });
      if (!assistant)
        throw new NotFoundException(
          `Assistant with ID ${assistantId} not found!`,
        );

      return assistant;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Get single assistant

  async updateAssistant(assistantId: number, dto: AssistantUpdateDto) {
    try {
      const getAssistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId },
      });

      if (!getAssistant)
        throw new NotFoundException(
          `Assistant with ID ${assistantId} not found!`,
        );

      const updatedAssistant = await this.prisma.assistant.update({
        where: { id: assistantId },
        data: {
          name: dto.name,
        },
      });
      return updatedAssistant;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Update assistant info

  async deactivateAssistant(assistantId: number) {
    try {
      const getAssistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId },
      });

      if (!getAssistant)
        throw new NotFoundException(
          `Assistant with ID ${assistantId} not found!`,
        );

      await this.prisma.assistant.update({
        where: { id: assistantId },
        data: {
          isActive: false,
        },
      });
      return { message: `Assistant with ID ${assistantId} Deactivated!` };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Deactivate assistant
  async assignAssistantToDoctor(assistantId: number, doctorId: number) {
    try {
      const getAssistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId },
      });
      const getDoctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });

      if (!getAssistant)
        throw new NotFoundException(
          `Assistant with ID ${assistantId} not found!`,
        );
      if (!getDoctor)
        throw new NotFoundException(`Doctor with ID ${doctorId} not found!`);

      await this.prisma.assistant.update({
        where: { id: assistantId },
        data: {
          doctorId: doctorId,
        },
      });

      return {
        message: `${getAssistant.name} is assign as a Assistant to ${getDoctor.name}`,
      };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  } // Reassign assistant
}
