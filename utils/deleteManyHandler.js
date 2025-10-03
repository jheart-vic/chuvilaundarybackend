// utils/deleteManyHandler.js
export const deleteManyHandler = (Model) => async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided" });
    }

    const result = await Model.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
