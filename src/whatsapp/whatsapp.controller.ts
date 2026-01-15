import { Controller, Post, Body, Query, Logger, Get } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { AIProcessor } from 'src/ai/ai.processor';
import { DoctorService } from 'src/doctor/doctor.service';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly aiProcessor: AIProcessor,
    private readonly whatsappService: WhatsAppService,
    private readonly doctorService: DoctorService,
  ) {}

  //GET  webhook verification
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ) {
    const VERIFY_TOKEN =
      process.env.WHATSAPP_VERIFY_TOKEN || 'my_secret_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      this.logger.log('Webhook verified! Returning challenge:', challenge);
      // MUST return challenge string exactly
      return challenge;
    }

    this.logger.warn('Webhook verification failed. Mode or token mismatch.');
    return 'Verification failed';
  }

  //POST  incoming messages
  @Post('webhook')
  async receiveMessage(@Body() body: any) {
    this.logger.log('Webhook hit');

    setImmediate(async () => {
      try {
        if (!body?.entry) return;

        for (const entry of body.entry) {
          for (const change of entry.changes ?? []) {
            const value = change.value;
            if (!value?.messages) continue;

            // Using phone_number_id to find doctor
            const phoneNumberId = value.metadata?.phone_number_id;
            const doctor =
              await this.doctorService.getDoctorByPhoneId(phoneNumberId);

            if (!doctor) {
              this.logger.warn(
                'Doctor not found for phone_number_id:',
                phoneNumberId,
              );
              continue;
            }

            for (const message of value.messages) {
              if (!message.from) {
                this.logger.warn(
                  'Skipping message without "from":',
                  JSON.stringify(message),
                );
                continue;
              }

              const from = message.from;
              const text = message.text?.body || '';

              this.logger.log(
                `Message from ${from} to doctor ${doctor.name}: ${text}`,
              );

              // Pass the doctor's phone number to AI processor
              const aiResponse = await this.aiProcessor.processMessage(
                from,
                text,
                doctor.phoneNumber!,
              );

              await this.whatsappService.sendMessage(
                doctor.id,
                from,
                aiResponse,
              );
              this.logger.log(`Sent AI response to ${from}: ${aiResponse}`);
            }
          }
        }
      } catch (err) {
        this.logger.error('Webhook async error', err);
      }
    });

    return { status: 'ok' };
  }
}
