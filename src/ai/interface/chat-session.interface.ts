import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AiArgs } from '../ai.processor';

export interface ChatSession {
  messages: ChatCompletionMessageParam[];
  lastUpdated: number;
  aiArgs?: AiArgs;
}
