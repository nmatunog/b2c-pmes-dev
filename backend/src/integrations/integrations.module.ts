import { Module } from "@nestjs/common";
import { AccountingClientService } from "./accounting-client.service";
import { StoreIntegrationGuard } from "./store-integration.guard";
import { StoreIntegrationsController } from "./store-integrations.controller";

@Module({
  controllers: [StoreIntegrationsController],
  providers: [AccountingClientService, StoreIntegrationGuard],
  exports: [AccountingClientService],
})
export class IntegrationsModule {}
