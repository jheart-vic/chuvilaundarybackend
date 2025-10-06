// utils/slaHours.js
import { DateTime } from "luxon";

/**
 * Compute expected ready date based on tier SLA.
 * - startDate: Date instance or ISO string
 * - tier: string ("STANDARD", "PREMIUM", "VIP", etc.)
 * - options: { express: boolean, sameDay: boolean }
 *
 * Returns a plain JS Date (suitable for Mongo).
 */
export function computeExpectedReadyAt(
  startDate,
  tier,
  { express = false, sameDay = false } = {}
) {
  let hours = 48; // default SLA

  // Base SLA by tier
  if (tier === "VIP") hours = 24;
  if (tier === "PREMIUM") hours = 36; // optional if you want intermediate tier

  // Same-day overrides everything else
  if (sameDay) {
    hours = 8;
  } else if (express) {
    // Only apply express reduction if not same-day
    hours = Math.floor(hours / 2);
  }

  // Build a Luxon DateTime from either a JS Date or an ISO string
  const dtStart =
    startDate instanceof Date
      ? DateTime.fromJSDate(startDate, { zone: "Africa/Lagos" })
      : DateTime.fromISO(String(startDate), { zone: "Africa/Lagos" });

  const readyAtDt = dtStart.plus({ hours });

  return readyAtDt.toJSDate();
}
