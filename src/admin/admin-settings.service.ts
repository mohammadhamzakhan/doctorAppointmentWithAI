import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminSettingsService {
  constructor() {}
  async getSystemSettings() {} // View current system settings
  async updateSystemSettings(dto: any) {} // Update settings (booking rules, max appointments, holidays)
  async createAiTemplate(dto: any) {} // Add AI WhatsApp message template
  async getAiTemplates() {} // List AI templates
  async updateAiTemplate(templateId: number, dto: any) {} // Update AI message template
  async deleteAiTemplate(templateId: number) {} // Delete AI template
}
