// controllers/userAppearanceController.js
const User = require("../models/User");

const TEMPLATE_PRESETS = {
  one_theme: {
    // your defaults
    background: "#ffffff",
    background_img: "",
    accent_color: "#0b051d",
    accent_forground_color: "#ffffff",
    text_color: "#0b051d",
    link_color: "#0231ebff",
  },
  sunset_glow: {
    background: "linear-gradient(135deg,#f97316 0%,#ef4444 100%)",
    background_img: "",
    accent_color: "#f97316",
    accent_forground_color: "#0b051d",
    text_color: "#0b051d",
    link_color: "#ffffff",
  },
  ocean_breeze: {
    background: "linear-gradient(135deg,#0ea5e9 0%,#22d3ee 100%)",
    background_img: "",
    accent_color: "#0ea5e9",
    accent_forground_color: "#0b051d",
    text_color: "#0b051d",
    link_color: "#ffffff",
  },
  mint_fresh: {
    background: "linear-gradient(135deg,#10b981 0%,#34d399 100%)",
    background_img: "",
    accent_color: "#10b981",
    accent_forground_color: "#0b051d",
    text_color: "#0b051d",
    link_color: "#ffffff",
  },
  lilac_dream: {
    background: "linear-gradient(135deg,#a78bfa 0%,#f472b6 100%)",
    background_img: "",
    accent_color: "#a78bfa",
    accent_forground_color: "#111827",
    text_color: "#111827",
    link_color: "#ffffff",
  },
  lagoon_mist: {
    background: "linear-gradient(135deg,#a78bfa 0%,#f472b6 100%)",
    background_img: "",
    accent_color: "#037269ff",
    accent_forground_color: "#cebc33ff",
    text_color: "#111827",
    link_color: "#ffffff",
  },
  lavender_sky: {
    background: "linear-gradient(135deg,#93c5fd 0%,#a78bfa 50%,#f9a8d4 100%)",
    background_img: "",
    accent_color: "#7c3aed", // deep violet for buttons/highlights
    accent_forground_color: "#ffffff", // white text on accent
    text_color: "#1f2937", // slate gray for good readability
    link_color: "#f472b6", // pink links to match gradient
  },
  dark_theme: {
    background: "linear-gradient(135deg,#93c5fd 0%,#a78bfa 50%,#f9a8d4 100%)",
    background_img: "",
    accent_color: "#282626ff", // deep violet for buttons/highlights
    accent_forground_color: "#ffffff", // white text on accent
    text_color: "#1f2937", // slate gray for good readability
    link_color: "#bebebeff", // pink links to match gradient
  },
  cappuccino: {
    background: "linear-gradient(135deg,#93c5fd 0%,#a78bfa 50%,#f9a8d4 100%)",
    background_img: "",
    accent_color: "#522902ff", // deep violet for buttons/highlights
    accent_forground_color: "#ffffff", // white text on accent
    text_color: "#1f2937", // slate gray for good readability
    link_color: "#bebebeff", // pink links to match gradient
  },
  image_banner: {
    background: "#0b0f14", // neutral behind the image
    background_img: "", // expect user to set this
    accent_color: "#22d3ee",
    accent_forground_color: "#0b051d",
    text_color: "#ffffff",
    link_color: "#22d3ee",
  },
};

// optional quick hex/rgb check
const COLOR_OK = (v) =>
  typeof v === "string" &&
  (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
    /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(
      v
    ));

exports.updateTemplate = async (req, res) => {
  try {
    const {
      name,
      background_img,
      accent_color,
      accent_forground_color,
      text_color,
      link_color,
      background,
    } = req.body || {};

    const updates = {};

    // If a preset name is supplied, seed defaults for any fields not explicitly provided
    if (name) {
      const preset = TEMPLATE_PRESETS[name];
      if (!preset)
        return res.status(400).json({ message: "invalid_template_name" });
      updates["template.name"] = name;

      if (background === undefined)
        updates["template.background"] = preset.background;
      if (background_img === undefined)
        updates["template.background_img"] = preset.background_img;
      if (accent_color === undefined)
        updates["template.accent_color"] = preset.accent_color;
      if (accent_forground_color === undefined)
        updates["template.accent_forground_color"] =
          preset.accent_forground_color;
      if (text_color === undefined)
        updates["template.text_color"] = preset.text_color;
      if (link_color === undefined)
        updates["template.link_color"] = preset.link_color;
    }

    // Explicit overrides always win
    if (background !== undefined)
      updates["template.background"] = String(background);
    if (background_img !== undefined)
      updates["template.background_img"] = String(background_img);

    if (accent_color !== undefined) {
      if (!COLOR_OK(accent_color))
        return res.status(400).json({ message: "invalid_accent_color" });
      updates["template.accent_color"] = String(accent_color);
    }
    if (accent_forground_color !== undefined) {
      if (!COLOR_OK(accent_forground_color))
        return res
          .status(400)
          .json({ message: "invalid_accent_forground_color" });
      updates["template.accent_forground_color"] = String(
        accent_forground_color
      );
    }
    if (text_color !== undefined) {
      if (!COLOR_OK(text_color))
        return res.status(400).json({ message: "invalid_text_color" });
      updates["template.text_color"] = String(text_color);
    }
    if (link_color !== undefined) {
      if (!COLOR_OK(link_color))
        return res.status(400).json({ message: "invalid_link_color" });
      updates["template.link_color"] = String(link_color);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "no_template_updates_provided" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, select: "template" }
    );
    if (!user) return res.status(404).json({ message: "user_not_found" });

    return res.json({ template: user.template, message: "template_updated" });
  } catch (err) {
    console.error("[updateTemplate] error:", err);
    return res.status(500).json({ message: "failed_to_update_template" });
  }
};

// POST /api/user/template/backfill-defaults
exports.backfillTemplateDefaults = async (req, res) => {
  // optional guard so random people can’t trigger it
  if (process.env.ADMIN_TASKS_SECRET) {
    const secret = req.get("x-admin-secret");
    if (secret !== process.env.ADMIN_TASKS_SECRET) {
      return res.status(403).json({ message: "forbidden" });
    }
  }

  const preset = TEMPLATE_PRESETS.one_theme;

  try {
    // Prefer a single aggregation-pipeline update (MongoDB ≥ 4.2)
    let result;
    try {
      result = await User.updateMany({}, [
        {
          $set: {
            template: { $ifNull: ["$template", preset] },

            "template.name": { $ifNull: ["$template.name", "one_theme"] },
            "template.background": {
              $ifNull: ["$template.background", preset.background],
            },
            "template.background_img": {
              $ifNull: ["$template.background_img", preset.background_img],
            },
            "template.accent_color": {
              $ifNull: ["$template.accent_color", preset.accent_color],
            },
            "template.accent_forground_color": {
              $ifNull: [
                "$template.accent_forground_color",
                preset.accent_forground_color,
              ],
            },
            "template.text_color": {
              $ifNull: ["$template.text_color", preset.text_color],
            },
            "template.link_color": {
              $ifNull: ["$template.link_color", preset.link_color],
            },
          },
        },
      ]);
    } catch (e) {
      // Fallback for older MongoDBs: do a few simple updates
      // 1) Set full preset where template is missing/null
      result = await User.updateMany(
        { $or: [{ template: { $exists: false } }, { template: null }] },
        { $set: { template: { name: "one_theme", ...preset } } }
      );
      // 2) Patch any missing fields
      await User.updateMany(
        { "template.name": { $exists: false } },
        { $set: { "template.name": "one_theme" } }
      );
      await User.updateMany(
        { "template.background": { $exists: false } },
        { $set: { "template.background": preset.background } }
      );
      await User.updateMany(
        { "template.background_img": { $exists: false } },
        { $set: { "template.background_img": preset.background_img } }
      );
      await User.updateMany(
        { "template.accent_color": { $exists: false } },
        { $set: { "template.accent_color": preset.accent_color } }
      );
      await User.updateMany(
        { "template.accent_forground_color": { $exists: false } },
        {
          $set: {
            "template.accent_forground_color": preset.accent_forground_color,
          },
        }
      );
      await User.updateMany(
        { "template.text_color": { $exists: false } },
        { $set: { "template.text_color": preset.text_color } }
      );
      await User.updateMany(
        { "template.link_color": { $exists: false } },
        { $set: { "template.link_color": preset.link_color } }
      );
    }

    return res.json({
      ok: true,
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
      message: "template_defaults_backfilled",
    });
  } catch (err) {
    console.error("[backfillTemplateDefaults] error:", err);
    return res.status(500).json({ message: "failed_to_backfill_template" });
  }
};
