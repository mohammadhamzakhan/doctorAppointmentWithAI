import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accessToken = process.env.WABA_ACCESS_TOKEN;
  private readonly phoneNumberId = process.env.WABA_PHONE_NUMBER_ID;

  // Send plain text
  async sendMessage(to: string, message: string) {
    const url = `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`;
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
            Authorization: `Bearer ${this.accessToken}`,
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
    to: string,
    templateName: string,
    languageCode = 'en_US',
    components?: any[],
  ) {
    const url = `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`;
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
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
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
