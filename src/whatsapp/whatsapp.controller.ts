import { Controller, Post, Body, Query, Logger, Get } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { AIProcessor } from 'src/ai/ai.processor';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly aiProcessor: AIProcessor,
    private readonly whatsappService: WhatsAppService,
  ) {}

  /** GET → webhook verification */
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

  /** POST → incoming messages */
  @Post('webhook')
  async receiveMessage(@Body() body: any) {
    this.logger.log(
      'Incoming WhatsApp webhook:',
      JSON.stringify(body, null, 2),
    );

    if (!body || !body.entry) {
      return { status: 'ok' };
    }

    try {
      for (const entry of body.entry) {
        if (!entry.changes) continue;

        for (const change of entry.changes) {
          const value = change.value;

          // The incoming messages array
          if (!value?.messages) continue;

          for (const message of value.messages) {
            const from = '+' + message.from.replace(/\D/g, '');
            const text = message.text?.body || '';

            this.logger.log(`Message from ${from}: ${text}`);

            // Simple echo logic (for test)
            return await this.whatsappService.sendMessage(
              from,
              `Echo: ${text}`,
            );

            // If you want AI reply, uncomment next lines:
            /*
            const aiResponse = await this.aiProcessor.processMessage(
              from,
              text,
              value.metadata?.phone_number_id, // pass Cloud phone_number_id if needed
            );
            await this.whatsappService.sendMessage(from, aiResponse);
            */
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error processing webhook: ${err.message}`, err.stack);
    }

    return { status: 'ok' };
  }
}
