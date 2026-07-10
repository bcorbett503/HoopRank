import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { CalendarService, CalendarScope } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  async getEvents(
    @Headers("x-user-id") userId: string,
    @Query("scope") scope = "for_you",
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException("User ID required");
    }
    if (scope !== "for_you" && scope !== "mine") {
      throw new BadRequestException("scope must be for_you or mine");
    }

    const startDate = this.parseDate(start, "start");
    const endDate = this.parseDate(end, "end");
    if (endDate < startDate) {
      throw new BadRequestException("end must be after start");
    }
    if (endDate.getTime() - startDate.getTime() > 93 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException("calendar window cannot exceed 93 days");
    }

    return this.calendarService.getEvents({
      userId,
      scope: scope as CalendarScope,
      start: startDate,
      end: endDate,
      lat: this.parseCoordinate(lat, -90, 90),
      lng: this.parseCoordinate(lng, -180, 180),
    });
  }

  private parseDate(value: string | undefined, field: string): Date {
    if (!value) {
      throw new BadRequestException(`${field} is required`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }
    return parsed;
  }

  private parseCoordinate(
    value: string | undefined,
    minimum: number,
    maximum: number,
  ): number | undefined {
    if (value == null || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
      ? parsed
      : undefined;
  }
}
