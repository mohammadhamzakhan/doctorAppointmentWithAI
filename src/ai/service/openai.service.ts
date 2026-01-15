import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /* ---------------- TOOLS ---------------- */

  getTools(): OpenAI.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_doctors',
          description: 'Get doctor information, specialties, and availability.',
          parameters: {
            type: 'object',
            properties: {
              specialty: { type: 'string' },
              date: {
                type: 'string',
                description: 'YYYY-MM-DD',
              },
              doctorId: { type: 'integer' },
            },
          },
        },
      },

      {
        type: 'function',
        function: {
          name: 'book_appointment',
          description: 'Book a doctor appointment after user confirmation.',
          parameters: {
            type: 'object',
            properties: {
              doctorId: { type: 'integer' },
              date: {
                type: 'string',
                description: 'YYYY-MM-DD',
              },
              time: {
                type: 'string',
                description: 'HH:MM 24-hour format',
              },
              reason: { type: 'string' },
            },
            required: ['doctorId', 'date', 'time'],
          },
        },
      },

      {
        type: 'function',
        function: {
          name: 'cancel_appointment',
          description: 'Cancel an existing appointment.',
          parameters: {
            type: 'object',
            properties: {
              appointmentId: { type: 'integer' },
              reason: { type: 'string' },
            },
            required: ['appointmentId'],
          },
        },
      },
    ];
  }

  /* ---------------- DATE CONTEXT ---------------- */

  private getDateContext() {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];

    return {
      role: 'system',
      content: `
📅 Date Rules:
- Today is ${todayISO}
- Tomorrow is ${tomorrowISO}
- "aj" or "today" → ${todayISO}
- "kal" or "tomorrow" → ${tomorrowISO}
- Always convert natural language dates to YYYY-MM-DD
- Never guess dates
`,
    };
  }

  /* ---------------- CHAT (MULTI-TURN) ---------------- */

  async chat(messages: any[]) {
    return this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional doctor appointment booking assistant.',
        },
        this.getDateContext(),
        ...messages,
      ],
      tools: this.getTools(),
      tool_choice: 'auto',
    });
  }

  /* ---------------- CHAT SINGLE (ONE-SHOT) ---------------- */

  async chatSingle(params: { system?: string; user: string }): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            params.system || 'You are a helpful doctor appointment assistant.',
        },
        this.getDateContext() as OpenAI.ChatCompletionMessageParam,
        {
          role: 'user',
          content: params.user,
        },
      ],
      tools: this.getTools(),
      tool_choice: 'auto',
    });

    const message = response.choices?.[0]?.message;

    // If AI wants to call a tool, return a human confirmation text
    if (message?.tool_calls?.length) {
      return 'Please confirm the details so I can proceed.';
    }

    return message?.content?.trim() || '';
  }
}
