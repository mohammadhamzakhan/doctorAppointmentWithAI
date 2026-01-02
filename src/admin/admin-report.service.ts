import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminReportService {
  constructor() {}
  async getAppointmentReport(startDate: Date, endDate: Date) {} // Appointment stats
  async getUserReport() {} // Active doctors & assistants
  async getNoShowReport() {} // Patients who missed appointments
}
