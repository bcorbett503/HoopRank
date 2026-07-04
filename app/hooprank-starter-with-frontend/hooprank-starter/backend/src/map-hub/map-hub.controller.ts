import { Controller, Get, Headers, Query } from "@nestjs/common";
import { MapHubService } from "./map-hub.service";

@Controller("map")
export class MapHubController {
  constructor(private readonly mapHubService: MapHubService) {}

  @Get("hub")
  async getHub(@Headers("x-user-id") userId: string, @Query() query: any) {
    const lat = this.parseNumber(query.lat);
    const lng = this.parseNumber(query.lng);
    const radiusMiles = this.parseNumber(query.radiusMiles);
    const minLat = this.parseNumber(query.minLat);
    const maxLat = this.parseNumber(query.maxLat);
    const minLng = this.parseNumber(query.minLng);
    const maxLng = this.parseNumber(query.maxLng);
    const includePlayers = query.includePlayers !== "false";

    return this.mapHubService.getHub({
      userId,
      lat,
      lng,
      radiusMiles,
      minLat,
      maxLat,
      minLng,
      maxLng,
      includePlayers,
    });
  }

  private parseNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
