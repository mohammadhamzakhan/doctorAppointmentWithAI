import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAccessGuard } from 'src/auth/guard/auth.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentsService } from './appointments.service';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RoleGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/auth/enum/role.enum';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
type bookingSource = 'doctor' | 'assistant' | 'ai' | 'patient';
@Controller('appointments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAccessGuard, RoleGuard)
@Roles(Role.Doctor, Role.Assistant)
export class AppointmentsController {
  constructor(private appointment: AppointmentsService) {}

  //.................................................................//
  //----------------- Create Appointment -----------------//
  //.................................................................//
  @Post('create-appointment')
  createAppointment(@Request() req: any, @Body() dto: CreateAppointmentDto) {
    const doctorId = req.user.role === 'doctor' ? req.user.sub : null;
    const assitantId = req.user.role === 'assistant' ? req.user.sub : null;

    const bookedBy: bookingSource =
      req.user.role === 'doctor'
        ? 'doctor'
        : req.user.role === 'assistant'
          ? 'assistant'
          : 'ai';

    const payload = {
      pateintName: dto.pateintName,
      patientPhone: dto.patientPhone,
      scheduledStart: new Date(dto.scheduledStart),
      reason: dto.reason,
    };
    console.log(req.user);
    console.log(assitantId);
    console.log(bookedBy);

    return this.appointment.createAppointment(
      doctorId,
      payload,
      bookedBy,
      assitantId,
    );
  }
  //.................................................................//
  //----------------- Get Appointments -----------------//
  //.................................................................//
  @Get('get-appointment/:id')
  getAppointment(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const doctorId = req.user.sub;
    return this.appointment.getAppointment(id, doctorId);
  }
  //.................................................................//
  //----------------- Get All Appointments -----------------//
  //.................................................................//
  @Get('get-all-appointments')
  getAllAppointments(@Request() req: any) {
    const doctorId = req.user.sub;
    return this.appointment.getAllAppointments(doctorId);
  }
  //.................................................................//
  //----------------- Get Appointments By View -----------------//
  //.................................................................//
  @Get('get-appointments-by-view')
  @ApiQuery({ name: 'view', enum: ['daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'date', example: '2023-10-10' })
  getAppointmentsByView(
    @Request() req: any,
    @Query('view') view: 'daily' | 'weekly' | 'monthly',
    @Query('date') date: string,
  ) {
    const doctorId = req.user.sub;

    if (!view || !date) {
      throw new BadRequestException('view and date are required');
    }
    const parseDate = new Date(date);
    if (isNaN(parseDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.appointment.getAppointmentsByView(doctorId, view, parseDate);
  }

  //.................................................................//
  //----------------- Update Appointment -----------------//
  //.................................................................//
  @Patch('update-appointment/:id')
  updateAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const doctorId = req.user.sub;
    return this.appointment.updateAppointment(id, doctorId, dto);
  }

  //.................................................................//
  //----------------- Complete Appointment -----------------//
  //.................................................................//
  @Patch('complete-appointment/:id')
  completeAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const doctorId = req.user.sub;
    return this.appointment.completeAppointment(id, doctorId);
  }

  //.................................................................//
  //----------------- Cancel Appointment -----------------//
  //.................................................................//
  @Patch('cancel-appointment/:id')
  cancelAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const doctorId = req.user.sub;
    return this.appointment.cancelAppointment(id, doctorId);
  }

  //.................................................................//
  //----------------- Get Remaining Slots -----------------//
  //.................................................................//
  @Patch('get-remaining-slots/:id')
  getRemainingSlots(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const doctorId = req.user.sub;
    return this.appointment.getRemainingSlots(id, doctorId);
  }

  //.................................................................//
  //----------------- Delete Appointment -----------------//
  //.................................................................//
  @Delete('delete-appointment/:id')
  deleteAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const doctorId = req.user.sub;
    return this.appointment.deleteAppointment(id, doctorId);
  }
}
