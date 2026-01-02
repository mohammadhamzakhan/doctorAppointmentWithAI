import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { ChatSession } from '../interface/chat-session.interface';

@Injectable()
export class SessionService {
  private redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  private getKey(phoneNumber: string) {
    return `chat:${phoneNumber}`;
  }

  async getSession(phoneNumber: string): Promise<ChatSession> {
    const session = await this.redis.get<ChatSession>(this.getKey(phoneNumber));
    return session ?? { messages: [], lastUpdated: Date.now() };
  }

  async saveSession(phoneNumber: string, session: ChatSession): Promise<void> {
    await this.redis.set(this.getKey(phoneNumber), session, { ex: 3600 * 24 });
  }

  async clearSession(phoneNumber: string): Promise<void> {
    await this.redis.del(this.getKey(phoneNumber));
  }
}
