// // utils/addressChecker.js
// import { zoneLookup } from "../config/zones.js";
// import Config from "../models/Config.js";

// const DEFAULT_ZONE_FEES = {
//   zone1: 1000,
//   zone2: 1500,
//   zone3: 2000,
//   zone4: 2500,
// };

// const DEFAULT_INSIDE_ZONES = ["zone1", "zone2", "zone3"];
// const DEFAULT_FREE_THRESHOLD = 15000;

// /**
//  * Normalize text (city/state).
//  */
// function normalize(str = "") {
//   return str.toLowerCase().replace(/\s+/g, "");
// }

// /**
//  * Resolve delivery zone from address (city + state).
//  */
// export function resolveZone(address = {}) {
//   const city = normalize(address.city);
//   const state = normalize(address.state);

//   if (zoneLookup[city]) return zoneLookup[city];

//   if (state === "anambra") {
//     return zoneLookup[city] || "zone3";
//   }

//   // fallback for unknown locations
//   return "zone3";
// }

// /**
//  * Compute delivery fee for a given zone + subtotal.
//  * Uses Config overrides if present.
//  */
// export async function getDeliveryFeeForZone(zone, subtotal = 0) {
//   const cfgDoc = await Config.findOne({ key: "defaults" });
//   const cfg = (cfgDoc && cfgDoc.value) || {};

//   const zoneFees = cfg.zone_fees || DEFAULT_ZONE_FEES;
//   const freeThreshold =
//     cfg.free_delivery_min_items_premium_amount ||
//     cfg.free_delivery_min_items_premium ||
//     DEFAULT_FREE_THRESHOLD;

//   const fee = zoneFees[zone] ?? 0;
//   return subtotal >= freeThreshold ? 0 : fee;
// }

// /**
//  * Check if an address is within the "inside service zone".
//  * Uses Config overrides if present.
//  */
// export async function isInsideServiceZone(address) {
//   const zone = resolveZone(address);

//   const cfgDoc = await Config.findOne({ key: "defaults" });
//   const cfg = (cfgDoc && cfgDoc.value) || {};

//   const insideZones = cfg.inside_zones || DEFAULT_INSIDE_ZONES;
//   return insideZones.includes(zone);
// }

import { zoneLookup, proximityFromAgulu } from "../config/zones.js";
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
 * Normalize text (city/state/LGA).
 */
function normalize(str = "") {
  return str.toLowerCase().trim().replace(/\s+/g, "_");
}

/**
 * Resolve delivery zone from address (expects { city, lga, state }).
 * Handles nested zoneLookup by LGA → Town.
 */
export function resolveZone(address = {}) {
  const state = normalize(address.state);
  const lga = normalize(address.lga || "");
  const city = normalize(address.city || "");

  if (state !== "anambra") {
    return "zone3"; // fallback for out-of-state
  }

  // Check if LGA exists in lookup
  const lgaData = zoneLookup[lga];
  if (!lgaData) {
    return "zone3"; // unknown LGA
  }

  // Check if the city/town exists inside the LGA
  if (lgaData[city]) {
    return lgaData[city];
  }

  // If city not found, return the LGA’s most common zone (approximation)
  const zones = Object.values(lgaData);
  if (zones.length > 0) {
    const freq = zones.reduce((acc, z) => ((acc[z] = (acc[z] || 0) + 1), acc), {});
    return Object.keys(freq).reduce((a, b) => (freq[a] > freq[b] ? a : b));
  }

  return "zone3"; // default fallback
}

/**
 * Determine proximity (near, mid, far) relative to Agulu (Anaocha LGA)
 */
export function getProximityFromAgulu(address = {}) {
  const lga = normalize(address.lga || "");
  const city = normalize(address.city || "");

  // Direct match for Agulu itself
  if (lga === "anocha" && city === "agulu") return "near";

  if (proximityFromAgulu.near.includes(lga)) return "near";
  if (proximityFromAgulu.mid.includes(lga)) return "mid";
  if (proximityFromAgulu.far.includes(lga)) return "far";

  return "mid"; // default fallback
}

/**
 * Compute delivery fee for a given zone + subtotal.
 * Uses Config overrides if present.
 */
export async function getDeliveryFeeForZone(zone, subtotal = 0, address = {}) {
  const cfgDoc = await Config.findOne({ key: "defaults" });
  const cfg = (cfgDoc && cfgDoc.value) || {};

  const zoneFees = cfg.zone_fees || DEFAULT_ZONE_FEES;
  const freeThreshold =
    cfg.free_delivery_min_items_premium_amount ||
    cfg.free_delivery_min_items_premium ||
    DEFAULT_FREE_THRESHOLD;

  let fee = zoneFees[zone] ?? 0;

  // Optional proximity multiplier
  const proximity = getProximityFromAgulu(address);
  const multiplier = { near: 1.0, mid: 1.1, far: 1.3 };
  fee = Math.round(fee * (multiplier[proximity] || 1));

  return subtotal >= freeThreshold ? 0 : fee;
}

/**
 * Check if an address is within the "inside service zone".
 * Uses Config overrides if present.
 */
export async function isInsideServiceZone(address) {
  const zone = resolveZone(address);
  const cfgDoc = await Config.findOne({ key: "defaults" });
  const cfg = (cfgDoc && cfg.value) || {};

  const insideZones = cfg.inside_zones || DEFAULT_INSIDE_ZONES;
  return insideZones.includes(zone);
}
