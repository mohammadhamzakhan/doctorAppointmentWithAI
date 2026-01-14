import {
  Controller,
  UseGuards,
  Request,
  Body,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/role.decorator';
import { JwtAccessGuard } from 'src/auth/guard/auth.guard';
import { RoleGuard } from 'src/auth/guard/role.guard';
import { Role } from 'src/auth/enum/role.enum';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorChangePassword } from './dto/doctor-changePass.dto';
import { doctorUpdateAssistantDto } from './dto/doctor-update-assistant.dto';
import { DoctorAssistantService } from './doctor-assistant.service';

@Controller('doctor')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAccessGuard, RoleGuard)
@Roles(Role.Doctor)
export class DoctorController {
  constructor(
    private doctorService: DoctorService,
    private doctorAssistant: DoctorAssistantService,
  ) {}

  @Get('doctor-profile')
  getMe(@Request() req: any) {
    const me = req.user.sub;

    return this.doctorService.getMyProfile(me);
  }
  @Patch('doctor-profile/update')
  updateMyProfile(@Body() dto: UpdateDoctorDto, @Request() req: any) {
    const me = req.user.sub;
    return this.doctorService.updateMyProfile(me, dto);
  }

  @Patch('doctor-profile/change-password')
  changeMyPassword(@Request() req: any, @Body() dto: DoctorChangePassword) {
    const me = req.user.sub;
    return this.doctorService.changeMyPassword(me, dto);
  }

  @Get('deactivate-my-account')
  deactivateMyAccount(@Request() req: any) {
    const me = req.user.sub;
    return this.doctorService.deactivateMyAccount(me);
  }

  @Get('get-all-assistant')
  getAllAssistants(@Request() req: any) {
    const doc = req.user.sub;
    return this.doctorAssistant.getAllAssistant(doc);
  }
  @Patch('update-assistant-data/:id')
  updateAssistant(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: doctorUpdateAssistantDto,
  ) {
    const doc = req.user.sub;
    return this.doctorAssistant.updateAssistant(doc, id, dto);
  }
  @Patch('change-assistan-password/:id')
  changeAssistantPassword(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() newPass: string,
  ) {
    const doc = req.user.sub;
    return this.doctorAssistant.chageMyAssistantPassword(doc, id, newPass);
  }

  @Patch('deactivate-assistant/:id')
  deactivateAssistant(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const doc = req.user.sub;
    return this.doctorAssistant.deactivateMyAssistant(doc, id);
  }

  @Delete('delete-assistant/:id')
  deleteMyAssistant(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const doc = req.user.sub;
    return this.doctorAssistant.deleteMyAssistant(doc, id);
  }
}
