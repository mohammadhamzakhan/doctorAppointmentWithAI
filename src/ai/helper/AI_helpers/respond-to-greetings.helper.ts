//This wel response to a use who sent greeting to a doctor number

import { RESPONSE_TO_GREETING } from 'src/ai/prompts/response-to-greetings.prompt';
import { OpenAiService } from 'src/ai/service/openai.service';

//eg : salam | hello | AOA | Hey | Asslam 0 Alaikum
export async function respondToGreetings(
  doctorName: string,
  userMessage: string,
  openAiService: OpenAiService,
): Promise<string> {
  const prompt = RESPONSE_TO_GREETING(doctorName, userMessage);
  const response = await openAiService.chat([
    {
      role: 'system',
      content:
        'You are a friendly medical receptionist with excellent communication skills, cheerful tone, and human-like responses.',
    },
    { role: 'user', content: prompt },
  ]);
  return response.choices?.[0]?.message?.content?.trim() || '';
}
