import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CertificateQueryDto } from "./dto/certificate-query.dto";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";
import { AdminCodeGuard } from "./admin-code.guard";
import { PmesService } from "./pmes.service";

@Controller("pmes")
export class PmesController {
  constructor(private readonly pmes: PmesService) {}

  @Post("submit")
  submit(@Body() dto: CreatePmesDto) {
    return this.pmes.submitSession(dto);
  }

  @Post("loi")
  submitLoi(@Body() dto: CreateLoiDto) {
    return this.pmes.submitLoi(dto);
  }

  @Get("certificate")
  async certificate(@Query() query: CertificateQueryDto) {
    const record = await this.pmes.findCertificateRecord(query.email, query.dob.trim());
    if (!record) {
      throw new NotFoundException("Record not found");
    }
    return record;
  }

  @Get("admin/records")
  @UseGuards(AdminCodeGuard)
  adminRecords() {
    return this.pmes.listAllPmesForAdmin();
  }
}
