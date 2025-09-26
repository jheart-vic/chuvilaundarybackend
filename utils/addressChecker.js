// utils/addressChecker.js
import { zoneLookup } from "../config/zones.js";
import Config from "../models/Config.js";

const DEFAULT_ZONE_FEES = {
  zone1: 1000,
  zone2: 1500,
  zone3: 2000,
  zone4: 2500,
};

const DEFAULT_INSIDE_ZONES = ["zone1", "zone2", "zone3"];
const DEFAULT_FREE_THRESHOLD = 15000;

/**
 * Normalize text (city/state).
 */
function normalize(str = "") {
  return str.toLowerCase().replace(/\s+/g, "");
}

/**
 * Resolve delivery zone from address (city + state).
 */
export function resolveZone(address = {}) {
  const city = normalize(address.city);
  const state = normalize(address.state);

  if (zoneLookup[city]) return zoneLookup[city];

  if (state === "anambra") {
    return zoneLookup[city] || "zone3";
  }

  // fallback for unknown locations
  return "zone3";
}

/**
 * Compute delivery fee for a given zone + subtotal.
 * Uses Config overrides if present.
 */
export async function getDeliveryFeeForZone(zone, subtotal = 0) {
  const cfgDoc = await Config.findOne({ key: "defaults" });
  const cfg = (cfgDoc && cfgDoc.value) || {};

  const zoneFees = cfg.zone_fees || DEFAULT_ZONE_FEES;
  const freeThreshold =
    cfg.free_delivery_min_items_premium_amount ||
    cfg.free_delivery_min_items_premium ||
    DEFAULT_FREE_THRESHOLD;

  const fee = zoneFees[zone] ?? 0;
  return subtotal >= freeThreshold ? 0 : fee;
}

/**
 * Check if an address is within the "inside service zone".
 * Uses Config overrides if present.
 */
export async function isInsideServiceZone(address) {
  const zone = resolveZone(address);

  const cfgDoc = await Config.findOne({ key: "defaults" });
  const cfg = (cfgDoc && cfgDoc.value) || {};

  const insideZones = cfg.inside_zones || DEFAULT_INSIDE_ZONES;
  return insideZones.includes(zone);
}
