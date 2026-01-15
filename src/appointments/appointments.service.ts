import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, BookingSource, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';
@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  //----------------
  // create Appointment
  //----------------

  private parseAvailabilityTime(time: string): {
    hour: number;
    minute: number;
  } {
    const match = time
      .toLowerCase()
      .trim()
      .match(/(\d{1,2}):(\d{2})\s*(am|pm)/);

    if (!match) {
      throw new Error(`Invalid availability time format: ${time}`);
    }

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3];

    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;

    return { hour, minute };
  }

  async createAppointment(
    doctorId: number,
    dto: {
      pateintName: string;
      patientPhone: string;
      scheduledStart: Date; // doctor-local datetime
      reason?: string;
    },
    bookedBy: BookingSource,
    assistantId: number,
    prisma?: PrismaService | Prisma.TransactionClient,
  ) {
    try {
      const db = prisma ?? this.prisma;

      /* ───────────── DOCTOR CHECK ───────────── */

      const doctor = await db.doctor.findUnique({
        where: { id: doctorId },
      });

      if (!doctor || !doctor.isActive) {
        throw new ForbiddenException('Doctor not available');
      }

      if (!doctor.isAutoBooking && bookedBy === 'ai') {
        throw new ForbiddenException('Auto booking is unavailable');
      }

      /* ───────────── TIMEZONE NORMALIZATION ───────────── */

      // Convert doctor-local input → UTC (ONLY store UTC)
      const scheduledStartUTC = fromZonedTime(
        dto.scheduledStart,
        doctor.timezone,
      );

      // Convert back to doctor timezone for validation
      const zonedStart = toZonedTime(scheduledStartUTC, doctor.timezone);

      /* ───────────── BLOCK PAST BOOKINGS ───────────── */

      const nowInDoctorTZ = toZonedTime(new Date(), doctor.timezone);

      if (zonedStart <= nowInDoctorTZ) {
        throw new BadRequestException('Cannot book appointment in the past');
      }

      /* ───────────── APPOINTMENT DATE (DOCTOR LOCAL DAY) ───────────── */

      const appointmentDate = new Date(zonedStart);
      appointmentDate.setHours(0, 0, 0, 0);

      /* ───────────── DAILY LIMIT CHECK ───────────── */

      const dailyCount = await db.appointment.count({
        where: {
          doctorId,
          appointmentDate,
          appointmentStatus: { not: AppointmentStatus.cancelled },
          isDeleted: false,
        },
      });

      if (dailyCount >= doctor.maxAppointmentsPerDay) {
        throw new BadRequestException('Daily appointment limit reached');
      }

      /* ───────────── DOCTOR AVAILABILITY ───────────── */

      const day = zonedStart.getDay();

      const availability = await db.doctorAvailability.findFirst({
        where: {
          doctorId,
          day,
          isActive: true,
        },
      });

      if (!availability) {
        throw new BadRequestException('Doctor unavailable on this day');
      }

      /* ───────────── WORKING HOURS (STRICT, AM/PM SAFE) ───────────── */

      const start = this.parseAvailabilityTime(availability.startTime);
      const end = this.parseAvailabilityTime(availability.endTime);

      const availabilityStart = new Date(zonedStart);
      availabilityStart.setHours(start.hour, start.minute, 0, 0);

      const availabilityEnd = new Date(zonedStart);
      availabilityEnd.setHours(end.hour, end.minute, 0, 0);

      const appointmentEnd = new Date(
        zonedStart.getTime() + doctor.slotDuration * 60 * 1000,
      );

      // ❌ FINAL GUARANTEE
      if (zonedStart < availabilityStart || appointmentEnd > availabilityEnd) {
        throw new BadRequestException(
          `Doctor is available from ${availability.startTime} to ${availability.endTime}`,
        );
      }

      /* ───────────── QUEUE NUMBER ───────────── */

      const last = await db.appointment.findFirst({
        where: {
          doctorId,
          appointmentDate,
          isDeleted: false,
        },
        orderBy: { queueNumber: 'desc' },
      });

      const queueNumber = last ? last.queueNumber + 1 : 1;

      /* ───────────── SCHEDULED END (UTC) ───────────── */

      const scheduledEndUTC = new Date(
        scheduledStartUTC.getTime() + doctor.slotDuration * 60 * 1000,
      );

      /* ───────────── PATIENT UPSERT ───────────── */

      let patient = await db.patient.findUnique({
        where: { phone: dto.patientPhone },
      });

      if (!patient) {
        patient = await db.patient.create({
          data: {
            name: dto.pateintName,
            phone: dto.patientPhone,
          },
        });
      }

      /* ───────────── CREATE APPOINTMENT ───────────── */

      await db.appointment.create({
        data: {
          doctorId,
          assistantId,
          patientId: patient.id,
          appointmentDate,
          scheduledStart: scheduledStartUTC, // ✅ UTC
          scheduledEnd: scheduledEndUTC, // ✅ UTC
          expectedDuration: doctor.slotDuration,
          queueNumber,
          reason: dto.reason,
          bookedBy,
        },
      });

      return {
        message: 'Appointment booked successfully',
      };
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ForbiddenException(
          'Cannot book two appointments at the same time',
        );
      }
      throw err;
    }
  }

  // AppointmentsService
  async getAppointmentsByDate(doctorId: number, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledStart: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
  }

  async getDoctorAvailabilityForDay(doctorId: number, day: number) {
    return this.prisma.doctorAvailability.findFirst({
      where: { doctorId, day, isActive: true },
    });
  }
  async isSlotAvailable(
    doctorId: number,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    const clash = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        isDeleted: false,
      },
    });

    return !clash;
  }
  async getNextAvailableSlots(
    doctorId: number,
    date: Date,
    durationMinutes = 15,
    limit = 3,
  ): Promise<string[]> {
    const slots: string[] = [];
    let cursor = new Date(date);

    for (let i = 0; i < 20 && slots.length < limit; i++) {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + durationMinutes * 60000);

      const available = await this.isSlotAvailable(doctorId, start, end);
      if (available) {
        slots.push(start.toTimeString().slice(0, 5));
      }

      cursor.setMinutes(cursor.getMinutes() + durationMinutes);
    }

    return slots;
  }

  //----------------
  //get Appointment
  //----------------
  async getAppointment(id: number, doctorId: number) {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          Patient: true,
          Assistant: true,
        },
      });

      if (!appointment) throw new NotFoundException('Appointment not found');

      if (appointment.doctorId !== doctorId)
        throw new ForbiddenException('Access denied');
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { timezone: true },
      });

      if (!doctor) throw new NotFoundException('Doctor not found');
      const tz = doctor.timezone;

      return {
        ...appointment,
        appointmentDate: formatInTimeZone(
          appointment.appointmentDate,
          tz,
          'yyyy-MM-dd',
        ),
        scheduledStart: formatInTimeZone(
          appointment.scheduledStart,
          tz,
          'yyyy-MM-dd HH:mm',
        ),
        scheduledEnd: formatInTimeZone(
          appointment.scheduledEnd,
          tz,
          'yyyy-MM-dd HH:mm',
        ),
      };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  //----------------
  //get All Appointments
  //----------------
  async getAllAppointments(doctorId: number) {
    const appointments = await this.prisma.appointment.findMany({
      where: { doctorId },
    });

    if (!appointments || appointments.length === 0) {
      throw new NotFoundException('No appointments found');
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) throw new NotFoundException('Doctor not found');

    const tz = doctor.timezone;
    return appointments.map((appointment) => ({
      ...appointment,
      appointmentDate: formatInTimeZone(
        appointment.appointmentDate,
        tz,
        'yyyy-MM-dd',
      ),
      scheduledStart: formatInTimeZone(
        appointment.scheduledStart,
        tz,
        'yyyy-MM-dd HH:mm',
      ),
      scheduledEnd: formatInTimeZone(
        appointment.scheduledEnd,
        tz,
        'yyyy-MM-dd HH:mm',
      ),
    }));
  }

  async getAppointmentsByView(
    doctorId: number,
    view: 'daily' | 'weekly' | 'monthly',
    date: Date,
  ) {
    let start: Date;
    let end: Date;

    if (view === 'daily') {
      start = new Date(date);
      start.setHours(0, 0, 0, 0);
      end = new Date(date);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'weekly') {
      start = new Date(date);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'monthly') {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    } else {
      throw new BadRequestException('Invalid view type');
    }

    return await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: start,
          lte: end,
        },
        isDeleted: false,
      },
      orderBy: [{ appointmentDate: 'asc' }, { queueNumber: 'asc' }],
      include: {
        Patient: true,
      },
    });
  }

  //----------------
  // update Appointment
  //----------------
  async updateAppointment(
    id: number,
    doctorId: number,
    dto: UpdateAppointmentDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: dto,
    });
  }

  //----------------
  // complete Appointment
  //----------------
  async completeAppointment(id: number, doctorId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException('Access denied');
    }
    const now = new Date();
    const actualDuration = Math.ceil(
      (now.getTime() - appointment.scheduledStart.getTime()) / 60000,
    );

    await this.prisma.appointment.update({
      where: { id },
      data: {
        appointmentStatus: AppointmentStatus.completed,
        actualStart: appointment.scheduledStart,
        actualEnd: now,
        actualDuration,
      },
    });

    await this.shiftQueueForward(doctorId, appointment);
  }
  //--------------
  //queue Shift
  //--------------

  private async shiftQueueForward(doctorId: number, completedAppointment: any) {
    const nextAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: completedAppointment.appointmentDate,
        queueNumber: { gt: completedAppointment.queueNumber },
        appointmentStatus: AppointmentStatus.confirmed,
      },
      orderBy: { queueNumber: 'asc' },
    });

    let cursor = completedAppointment.actualEnd;
    for (const appt of nextAppointments) {
      const newStart = new Date(cursor);
      const newEnd = new Date(newStart);
      newEnd.setMinutes(newEnd.getMinutes() + appt.expectedDuration);
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { scheduledEnd: newEnd, scheduledStart: newStart },
      });
      cursor = newEnd;
    }
  }

  //----------------
  // cancel Appointment
  //----------------
  async cancelAppointment(id: number, doctorId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        appointmentStatus: AppointmentStatus.cancelled,
        cancelledAt: new Date(),
      },
    });
  }

  //----------------
  // get Remaining Slots
  //----------------
  async getRemainingSlots(doctorId: number, date: Date) {
    // -------------------  Normalize the date -------------------
    // Use local date to avoid timezone mismatch
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // -------------------  Map JS day to DB day -------------------
    // JS: Sunday = 0, Monday = 1 ... Saturday = 6
    // DB: Monday = 1, Sunday = 7
    const jsDay = dayStart.getDay(); // 0 (Sun) - 6 (Sat)
    const dayOfWeek = jsDay === 0 ? 7 : jsDay; // Sunday = 7 in DB

    // ------------------- Get doctor availability -------------------
    const availability = await this.prisma.doctorAvailability.findFirst({
      where: { doctorId, day: dayOfWeek, isActive: true },
    });

    if (!availability || !availability.startTime || !availability.endTime) {
      throw new NotFoundException(
        'Doctor is unavailable or working hours not set for this day',
      );
    }

    const { hours: startH, minutes: startM } = this.parseTime12to24(
      availability.startTime,
    );
    const { hours: endH, minutes: endM } = this.parseTime12to24(
      availability.endTime,
    );

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
      throw new Error('Doctor availability has invalid time format');
    }

    const availStart = startH * 60 + startM;
    const availEnd = endH * 60 + endM;

    console.log('availStart:', availStart);
    console.log('availEnd:', availEnd);

    // ------------------- Get doctor's slot duration -------------------
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const slotDuration = doctor.slotDuration || 30; // default 30 mins

    // -------------------Get booked appointments -------------------
    const booked = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledStart: { gte: dayStart, lte: dayEnd },
        appointmentStatus: { not: AppointmentStatus.cancelled },
      },
    });

    console.log(booked);

    // -------------------  Generate all available slots -------------------
    const slots: { start: Date; end: Date }[] = [];

    for (
      let min = availStart;
      min + slotDuration <= availEnd;
      min += slotDuration
    ) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(min);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotStart.getMinutes() + slotDuration);

      // Check for conflicts
      const conflict = booked.find(
        (apt) =>
          slotStart < new Date(apt.scheduledEnd) &&
          slotEnd > new Date(apt.scheduledStart),
      );

      if (!conflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }

    return slots; //Only available slots returned
  }

  //time. parser
  parseTime12to24(timeStr: string) {
    const [time, modifier] = timeStr.split(' '); // e.g., "9:00 am"
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

    return { hours, minutes };
  }

  //----------------
  // delete Appointment
  //----------------
  async deleteAppointment(id: number, doctorId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { appointmentStatus: AppointmentStatus.cancelled, isDeleted: true },
    });
  }
}
