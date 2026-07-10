import {
  getRecurrenceUntil,
  isRecurrenceActive,
  isWeeklyRecurrence,
} from "./weekly-recurrence";

describe("weekly recurrence helpers", () => {
  it.each([
    null,
    "weekly",
    "weekly;until=2026-08-31",
    "FREQ=WEEKLY;BYDAY=TH",
    "RRULE:FREQ=WEEKLY;BYDAY=TH",
  ])("recognizes supported weekly rule %p", (rule) => {
    expect(isWeeklyRecurrence(rule)).toBe(true);
  });

  it("parses legacy ISO and iCalendar recurrence end values", () => {
    expect(
      getRecurrenceUntil(
        "weekly;until=2026-08-31T06:59:59.999Z",
      )?.toISOString(),
    ).toBe("2026-08-31T06:59:59.999Z");
    expect(
      getRecurrenceUntil("FREQ=WEEKLY;UNTIL=20260831T235959Z")?.toISOString(),
    ).toBe("2026-08-31T23:59:59.000Z");
  });

  it("treats a date-only recurrence end as inclusive", () => {
    expect(getRecurrenceUntil("weekly;until=2026-08-31")?.toISOString()).toBe(
      "2026-08-31T23:59:59.999Z",
    );
  });

  it("reports whether a bounded recurrence is active", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(
      isRecurrenceActive("weekly;until=2026-08-01T00:00:00.000Z", now),
    ).toBe(true);
    expect(
      isRecurrenceActive("weekly;until=2026-07-01T00:00:00.000Z", now),
    ).toBe(false);
  });
});
