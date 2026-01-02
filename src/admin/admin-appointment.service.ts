import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminAppointmentService {
  constructor() {}
  async getAllAppointments(filter?: any) {} // List all appointments with optional filters (doctor, date, status)
  async getAppointmentById(appointmentId: number) {} // Single appointment details
  async updateAppointmentStatus(appointmentId: number, status: string) {} // Approve, cancel, or reschedule
  async cancelAppointment(appointmentId: number) {} // Cancel an appointment
}
