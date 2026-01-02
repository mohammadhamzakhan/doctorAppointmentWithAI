// src/ai/ai.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AIProcessor } from './ai.processor';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatRequestDto } from './dto/chat-req.dto';
import { bo } from 'node_modules/@upstash/redis/zmscore-0SAuWM0q';

@ApiTags('AI Booking')
@Controller('ai')
export class AIController {
  constructor(private readonly aiProcessor: AIProcessor) {}

  @Post('chat')
  @ApiOperation({ summary: 'Simulate a WhatsApp message from a patient' })
  async handleChat(@Body() body: ChatRequestDto) {
    const reply = await this.aiProcessor.processMessage(
      body.phoneNumber,
      body.message,
      body.doctorPhoneNumber,
    );
    return { reply };
  }
}
