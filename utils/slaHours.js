// utils/sla.js
/**
 * Compute expected ready date based on tier SLA.
 */
export function computeExpectedReadyAt(startDate, tier, { express = false }) {
  let hours = 48; // default SLA
  if (tier === "SIGNATURE") hours = 24;
  if (express) hours = Math.floor(hours / 2);

  const readyAt = new Date(startDate);
  readyAt.setHours(readyAt.getHours() + hours);

  return readyAt;
}
