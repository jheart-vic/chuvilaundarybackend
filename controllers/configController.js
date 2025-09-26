// controllers/configController.js
import Config from '../models/Config.js';

/**
 * GET /api/config
 * Fetch all config keys
 */
export async function getAllConfigs(req, res) {
  try {
    const configs = await Config.find({});
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/config/:key
 * Fetch a single config by key
 */
export async function getConfig(req, res) {
  try {
    const cfg = await Config.findOne({ key: req.params.key });
    if (!cfg) return res.status(404).json({ error: 'Config not found' });
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/config
 * Create or update a config object
 * Body: { key: "defaults", value: {...} }
 */
export async function upsertConfig(req, res) {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    const updated = await Config.findOneAndUpdate(
      { key },
      { value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/config/:key
 * Remove a config entry
 */
export async function deleteConfig(req, res) {
  try {
    await Config.findOneAndDelete({ key: req.params.key });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


