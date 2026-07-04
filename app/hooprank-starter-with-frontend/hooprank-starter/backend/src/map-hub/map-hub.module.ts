import { Module } from "@nestjs/common";
import { MapHubController } from "./map-hub.controller";
import { MapHubService } from "./map-hub.service";

@Module({
  controllers: [MapHubController],
  providers: [MapHubService],
  exports: [MapHubService],
})
export class MapHubModule {}
