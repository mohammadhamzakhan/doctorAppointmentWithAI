import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DoctorAvailabilityService } from './doctor-availability.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RoleGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { JwtAccessGuard } from 'src/auth/guard/auth.guard';
import { Role } from 'src/auth/enum/role.enum';
import { createAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('doctor-availability')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAccessGuard, RoleGuard)
@Roles(Role.Doctor)
export class DoctorAvailabilityController {
  constructor(private doctorAvail: DoctorAvailabilityService) {}

  @Get('get-availability')
  getAvailability(@Request() req: any) {
    const id = req.user.sub;
    return this.doctorAvail.getMyAvailability(id);
  }

  @Post('create-availability')
  createAvailability(@Request() req: any, @Body() dto: createAvailabilityDto) {
    const id = req.user.sub;
    return this.doctorAvail.createAvailability(id, dto);
  }
  @Patch(':id')
  updateAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.doctorAvail.updateAvailability(id, dto);
  }

  @Delete(':id')
  deleteAvailability(@Param('id', ParseIntPipe) id: number) {
    return this.doctorAvail.deleteAvailability(id);
  }
}
