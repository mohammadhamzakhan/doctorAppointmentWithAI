import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  getTools(): OpenAI.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'book_appointment',
          description:
            'Books an appointment with a doctor given the required details and confrim it to book.',
          parameters: {
            type: 'object',
            properties: {
              doctorId: {
                type: 'integer',
                description:
                  'The unique ID of the doctor to book the appointment with.',
              },
              date: {
                type: 'string',
                description:
                  'The date of the appointment in YYYY-MM-DD format.',
              },
              time: {
                type: 'string',
                description: 'The time of the appointment in HH:MM format.',
              },
              reason: {
                type: 'string',
                description: 'The reason for the appointment.',
              },
            },
            required: ['doctorId', 'date', 'time'], // ✅ doctorId instead of doctor name
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'cancel_appointment',
          description: 'Cancels an appointment after confirmation..',
          parameters: {
            type: 'object',
            properties: {
              appointmentId: {
                type: 'integer',
                description:
                  'The unique identifier of the appointment to cancel.',
              },
            },
            required: ['appointmentId'],
          },
        },
      },
    ];
  }

  async chat(messages: any[]) {
    return this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a doctor appointment booking assistant.',
        },
        ...messages,
      ],
      tools: this.getTools(),
      tool_choice: 'auto',
    });
  }
}
