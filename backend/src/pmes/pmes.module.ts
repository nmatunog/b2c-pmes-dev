import { Module } from "@nestjs/common";
import { AdminCodeGuard } from "./admin-code.guard";
import { PmesController } from "./pmes.controller";
import { PmesService } from "./pmes.service";

@Module({
  controllers: [PmesController],
  providers: [PmesService, AdminCodeGuard],
})
export class PmesModule {}
