import { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';

export function isFunctionToolCall(
  toolCall: ChatCompletionMessageToolCall,
): toolCall is ChatCompletionMessageToolCall & {
  function: {
    name: string;
    arguments: string;
  };
} {
  return 'function' in toolCall;
}
