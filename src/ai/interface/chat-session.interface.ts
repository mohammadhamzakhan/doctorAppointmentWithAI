import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AiArgs } from './ai-args.interface';
export type MenuState =
  | 'MAIN_MENU'
  | 'AWAITING_MENU_SELECTION'
  | 'BOOKING_FLOW'
  | 'RESCHEDULE_FLOW'
  | 'CANCEL_FLOW'
  | 'DOCTOR_INFO_FLOW';
export interface ChatSession {
  messages: ChatCompletionMessageParam[];
  lastUpdated: number;
  aiArgs?: AiArgs;

  menuState?: MenuState;
  selectedOption?: '1' | '2' | '3' | '4';
}
