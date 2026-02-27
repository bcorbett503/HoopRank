const pgScheduledAt = new Date('2026-03-01T18:45:00.000Z'); // 10:45 AM PST
console.log("Original DB UTC:", pgScheduledAt.toISOString());

const targetDayOfWeek = pgScheduledAt.getDay();
const targetHours = pgScheduledAt.getHours(); // THIS extracts local system time!
const targetMinutes = pgScheduledAt.getMinutes();

console.log("Extracted Hours (System Local):", targetHours);

const upcomingInstance = new Date();
upcomingInstance.setHours(targetHours, targetMinutes, 0, 0); // AND THIS applies local system time!
console.log("Spawned Instance Local Time:", upcomingInstance.toString());
console.log("Spawned Instance UTC:", upcomingInstance.toISOString());
