// utils/config.js
import Config from "../models/Config.js";

/**
 * Central place for config defaults.
 * Add any new critical configs here.
 */
const DEFAULTS = {
  DELIVERY_BASE_FEE: 1000,
  DELIVERY_FREE_THRESHOLD: 10000,
  // Add more defaults here if needed
};

/**
 * Get a config value from DB. Falls back to default if missing.
 */
export async function getConfigValue(key) {
  const cfg = await Config.findOne({ key });
  if (cfg && cfg.value !== undefined && cfg.value !== null) return cfg.value;

  // If not in DB, return default
  if (key in DEFAULTS) return DEFAULTS[key];

  return null; // no DB entry & no default
}

/**
 * Set a config value in DB.
 */
export async function setConfigValue(key, value) {
  const cfg = await Config.findOneAndUpdate(
    { key },
    { value, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return cfg.value;
}
