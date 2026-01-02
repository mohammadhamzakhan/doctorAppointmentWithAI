import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, BookingSource } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';
@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  //----------------
  // create Appointment
  //----------------

  async createAppointment(
    doctorId: number,
    dto: {
      pateintName: string;
      patientPhone: string;
      scheduledStart: Date;
      reason?: string;
    },
    bookedBy: BookingSource,
    assistantId: number,
  ) {
    try {
      //first we will find the doctor
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (!doctor || !doctor.isActive)
        throw new ForbiddenException('Doctor not available!');
      if (!doctor.isAutoBooking && bookedBy === 'ai')
        throw new ForbiddenException('Auto booking is unavailable!');
      // Parse doctor's local datetime string
      const scheduledStartUTC = fromZonedTime(
        dto.scheduledStart,
        doctor.timezone,
      );
      //converting scheduled start to doctor's timezone
      const zonedStart = toZonedTime(scheduledStartUTC, doctor.timezone);

      // checking if the appointment is in the past
      if (new Date(dto.scheduledStart) < new Date())
        throw new BadRequestException('Cannot book appointment in the past');

      // 4️⃣ Appointment date (doctor local day)
      const appointmentDate = new Date(zonedStart);
      appointmentDate.setHours(0, 0, 0, 0);

      // checking  Daily limit of appointments
      const count = await this.prisma.appointment.count({
        where: {
          doctorId,
          appointmentDate,
          appointmentStatus: { not: AppointmentStatus.cancelled },
          isDeleted: false,
        },
      });
      if (count >= doctor.maxAppointmentsPerDay)
        throw new BadRequestException('Daily limit reached');

      // Checking availability for the day
      const day = zonedStart.getDay();
      const availability = await this.prisma.doctorAvailability.findFirst({
        where: { doctorId, day, isActive: true },
      });
      if (!availability)
        throw new BadRequestException('Doctor unavailable on this day');

      // Calculate minutes for working hours check
      const startMinutes =
        parseInt(formatInTimeZone(zonedStart, doctor.timezone, 'HH')) * 60 +
        parseInt(formatInTimeZone(zonedStart, doctor.timezone, 'mm'));
      const endMinutes = startMinutes + doctor.slotDuration;

      const [startH, startM] = availability.startTime.split(':').map(Number);
      const [endH, endM] = availability.endTime.split(':').map(Number);
      const availableStart = startH * 60 + startM;
      const availableEnd = endH * 60 + endM;

      if (startMinutes < availableStart || endMinutes > availableEnd) {
        throw new BadRequestException(
          `Outside working hours (${availability.startTime} - ${availability.endTime})`,
        );
      }

      // Queue number
      const last = await this.prisma.appointment.findFirst({
        where: { doctorId, appointmentDate, isDeleted: false },
        orderBy: { queueNumber: 'desc' },
      });
      const queueNumber = last ? last.queueNumber + 1 : 1;

      //  Scheduled end (UTC)

      const scheduledEndUTC = new Date(
        scheduledStartUTC.getTime() + doctor.slotDuration * 60 * 1000,
      );

      // getting Patient record if not existing patient so we create a patient
      let patient = await this.prisma.patient.findUnique({
        where: { phone: dto.patientPhone },
      });
      if (!patient) {
        patient = await this.prisma.patient.create({
          data: { name: dto.pateintName, phone: dto.patientPhone },
        });
      }

      //  Create appointment
      await this.prisma.appointment.create({
        data: {
          doctorId,
          assistantId,
          patientId: patient.id,
          appointmentDate,
          scheduledStart: scheduledStartUTC,
          scheduledEnd: scheduledEndUTC,
          expectedDuration: doctor.slotDuration,
          queueNumber,
          reason: dto.reason,
          bookedBy,
        },
      });

      return { message: 'Appointment booked' };
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ForbiddenException(
          'Cannot set 2 appointments at the same time!',
        );
      }
      throw err;
    }
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
    //first normalize date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dayofWeek = dayEnd.getDay();
    const getDoctorAvailability =
      await this.prisma.doctorAvailability.findFirst({
        where: { doctorId, day: dayofWeek, isActive: true },
      });

    if (!getDoctorAvailability) {
      throw new NotFoundException('Doctor is unavailabile for this day');
    }

    //convert availability to minutes
    const [startH, startM] = getDoctorAvailability.startTime
      .split(':')
      .map(Number);
    const [endH, endM] = getDoctorAvailability.endTime.split(':').map(Number);
    const availablityStart = startH * 60 + startM;
    const availablityEnd = endH * 60 + endM;
    //get already booked appointments
    const booked = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        appointmentStatus: { not: AppointmentStatus.cancelled },
      },
    });

    //generate all slots
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    const slotDuration = doctor.slotDuration;

    const slots: { start: Date; end: Date }[] = [];
    for (
      let min = availablityStart;
      min + slotDuration <= availablityEnd;
      min += slotDuration
    ) {
      //create slot start and end time
      const slotStart = new Date(dayStart);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(min);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      //check if the slot  is booked
      const conflict = booked.find(
        (apt) => slotStart < apt.scheduledEnd && slotEnd > apt.scheduledStart,
      );
      if (!conflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }
    return slots;
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
