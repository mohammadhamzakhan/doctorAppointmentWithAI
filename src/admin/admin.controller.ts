import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAccessGuard } from 'src/auth/guard/auth.guard';
import { RoleGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/auth/enum/role.enum';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpdateAdminDto } from './dto/update.dto';
import { AdminDoctorService } from './admin-doctor.service';
import { AdminUpdateDoctorDto } from './dto/adminDoctorUpdate.dto';
import { ResetDoctorPasswordDto } from './dto/resetPassword.dto';
import { AdminAssistantService } from './admin-assistant.service';
import { AssistantUpdateDto } from './dto/assisntUpdate.dto';
import { AssignAssistantDto } from './dto/assign-assistant.dto';

@Controller('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAccessGuard, RoleGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private adminDoctorService: AdminDoctorService,
    private adminAssistantService: AdminAssistantService,
  ) {}

  @Get('get-admin')
  async getAdminById(@Request() req: any) {
    const adminId = req.user.sub;
    return await this.adminService.getAdminById(adminId);
  }
  @Patch('admin')
  async updateAdmin(@Request() req: any, @Body() dto: UpdateAdminDto) {
    const adminId = req.user.sub;
    return await this.adminService.updateAdmin(adminId, dto);
  }

  @Patch('delete-admin')
  async deleteMyAccount(@Request() req: any) {
    const adminId = req.user.sub;
    return await this.adminService.deleteMyAccount(adminId);
  }

  //manage doctors
  @Get('admin-doctor')
  async getAllDoctors() {
    return await this.adminDoctorService.getAllDoctors();
  }

  @Get('doctor/:id')
  async getDoctorById(@Param('id', ParseIntPipe) id: number) {
    return await this.adminDoctorService.getDoctorById(id);
  }

  @Patch('update-doctor/:id')
  async updateDoctorById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateDoctorDto,
  ) {
    return this.adminDoctorService.updateDoctor(id, dto);
  }
  @Patch('deactivate-doctor/:id')
  async deactivateDoctor(@Param('id', ParseIntPipe) id: number) {
    return this.adminDoctorService.deactivateDoctor(id);
  }
  @Patch('reset-doctor-password/:id')
  async resetDoctorPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetDoctorPasswordDto,
  ) {
    return await this.adminDoctorService.resetDoctorPassword(id, dto.password);
  }

  //manage assistants
  @Get('admin-assistants')
  async getAllAssitants() {
    return await this.adminAssistantService.getAllAssistants();
  }

  @Get('admin-assistants/:id')
  async getAssistantById(@Param('id', ParseIntPipe) id: number) {
    return this.adminAssistantService.getAssistantById(id);
  }

  @Patch('update-assistant/:id')
  async updateAssistant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssistantUpdateDto,
  ) {
    return await this.adminAssistantService.updateAssistant(id, dto);
  }

  @Get('deactivate-assistant/:id')
  async deactivateAssistant(@Param('id', ParseIntPipe) id: number) {
    return await this.adminAssistantService.deactivateAssistant(id);
  }

  @Patch('assign-assistant/:id')
  async assignAssistantToDoctor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAssistantDto,
  ) {
    return await this.adminAssistantService.assignAssistantToDoctor(
      id,
      dto.doctorId,
    );
  }
}
