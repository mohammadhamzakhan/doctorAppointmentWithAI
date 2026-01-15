import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Get doctor-specific WhatsApp config
  private async getDoctorWhatsAppConfig(doctorId: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { waAccessToken: true, phoneNumberId: true },
    });

    if (!doctor || !doctor.waAccessToken || !doctor.phoneNumberId) {
      throw new Error('Doctor WhatsApp configuration missing');
    }

    return {
      accessToken: doctor.waAccessToken,
      phoneNumberId: doctor.phoneNumberId,
      url: `https://graph.facebook.com/v17.0/${doctor.phoneNumberId}/messages`,
    };
  }

  // Send plain text message
  async sendMessage(doctorId: number, to: string, message: string) {
    const { accessToken, url } = await this.getDoctorWhatsAppConfig(doctorId);

    try {
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to,
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Sent message to ${to}: ${message}`);
      return res.data;
    } catch (err: any) {
      this.logger.error(
        `Failed to send message to ${to}: ${JSON.stringify(err.response?.data || err.message)}`,
      );
      throw err;
    }
  }

  // Send template messages
  async sendTemplateMessage(
    doctorId: number,
    to: string,
    templateName: string,
    languageCode = 'en_US',
    components?: any[],
  ) {
    const { accessToken, url } = await this.getDoctorWhatsAppConfig(doctorId);

    try {
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components || [],
          },
          // Note: WhatsApp Cloud API does NOT support real typing indicators yet
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Sent template message to ${to}: ${templateName}`);
      return res.data;
    } catch (err: any) {
      this.logger.error(
        `Failed to send template message to ${to}: ${JSON.stringify(err.response?.data || err.message)}`,
      );
      throw err;
    }
  }
}
