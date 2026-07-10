export function isWeeklyRecurrence(rule: unknown): boolean {
  const normalized = String(rule ?? "weekly")
    .trim()
    .toLowerCase();
  return (
    normalized.startsWith("weekly") ||
    normalized.startsWith("freq=weekly") ||
    normalized.startsWith("rrule:freq=weekly")
  );
}

export function getRecurrenceUntil(rule: unknown): Date | null {
  const match = String(rule ?? "").match(/(?:^|;)until=([^;]+)/i);
  if (!match) return null;

  const rawUntil = match[1].trim();
  let normalized = rawUntil;

  if (/^\d{8}T\d{6}Z$/i.test(rawUntil)) {
    normalized = rawUntil.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i,
      "$1-$2-$3T$4:$5:$6Z",
    );
  } else if (/^\d{8}$/.test(rawUntil)) {
    normalized = rawUntil.replace(
      /^(\d{4})(\d{2})(\d{2})$/,
      "$1-$2-$3T23:59:59.999Z",
    );
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawUntil)) {
    normalized = `${rawUntil}T23:59:59.999Z`;
  }

  const until = new Date(normalized);
  return Number.isNaN(until.getTime()) ? null : until;
}
