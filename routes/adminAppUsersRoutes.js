// apis/routes/adminAppUsersRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const adminAuth = require("../middleware/adminAuthMiddleware");

/**
 * GET /admin/users
 * Query params:
 *  - page: number (default 1)
 *  - limit: number (default 50)
 *  - q: optional search (matches username, email, profileName)
 *
 * Response shape:
 * {
 *   items: [
 *     {
 *       username,
 *       email,
 *       profileName,
 *       type,
 *       profileImg,    // mapped from profileImage
 *       coverImg,      // mapped from coverImage
 *       country,       // from address.country
 *       phoneNumber
 *       verified
 *     }, ...
 *   ],
 *   page,
 *   limit,
 *   total
 * }
 */
router.get("/users", adminAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      200
    );
    const q = (req.query.q || "").trim();

    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ username: rx }, { email: rx }, { profileName: rx }];
    }

    // Only fetch the fields we need
    const projection = {
      _id: 1,
      username: 1,
      email: 1,
      profileName: 1,
      type: 1,
      profileImage: 1,
      coverImage: 1,
      phoneNumber: 1,
      verified: 1,
      status: 1,
      "address.country": 1,
      createdAt: 1,
    };

    const [docs, total] = await Promise.all([
      User.find(filter, projection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Map DB field names to the exact response keys requested
    const items = docs.map((u) => ({
      _id: u._id,
      username: u.username ?? "",
      email: u.email ?? "",
      profileName: u.profileName ?? "",
      type: u.type ?? "",
      status: u.status ?? "",
      verified: u.verified ?? "",
      profileImg: u.profileImage ?? "", // rename
      coverImg: u.coverImage ?? "", // rename
      country: u.address?.country ?? "",
      phoneNumber: u.phoneNumber ?? "",
      createdAt: u.createdAt ?? "",
    }));

    res.json({ items, page, limit, total });
  } catch (err) {
    console.error("[GET /admin/users] error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;
