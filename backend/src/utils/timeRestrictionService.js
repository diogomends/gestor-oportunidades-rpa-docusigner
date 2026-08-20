/**
 * Service to validate system access based on business hours configuration.
 */

/**
 * Checks if system access is allowed based on config and target date.
 * @param {object} config - Configuration from SystemConfig ({ enabled, startHour, endHour, applyOnWeekends })
 * @param {Date} date - Date to check (defaults to current server date)
 * @returns {boolean} True if access is allowed, false otherwise
 */
export function isTimeAccessAllowed(config, date = new Date()) {
  if (!config || !config.enabled) {
    return true; // Restriction is disabled or config not loaded
  }

  const { startHour, endHour, applyOnWeekends } = config;
  
  // Get current time details in America/Sao_Paulo timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const currentHour = Number(partMap.hour);
  const currentMinute = Number(partMap.minute);

  // Correctly calculate day of week in Sao Paulo timezone
  const year = Number(partMap.year);
  const month = Number(partMap.month) - 1; // 0-indexed
  const day = Number(partMap.day);
  const currentDay = new Date(year, month, day).getDay(); // 0 = Sunday, 6 = Saturday

  const [startH, startM] = startHour.split(":").map(Number);
  const [endH, endM] = endHour.split(":").map(Number);

  const currentMin = currentHour * 60 + currentMinute;
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  // Check if current time falls within start/end range
  let isWithinRange = false;
  if (startMin <= endMin) {
    isWithinRange = currentMin >= startMin && currentMin <= endMin;
  } else {
    // Crosses midnight (e.g. 22:00 to 06:00)
    isWithinRange = currentMin >= startMin || currentMin <= endMin;
  }

  const isWeekend = currentDay === 0 || currentDay === 6;

  if (isWeekend) {
    return applyOnWeekends ? isWithinRange : false;
  }

  return isWithinRange;
}
