// apis/routes/adminDashboardRoutes.js
const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuthMiddleware");

// ---- Models ----
const User = require("../models/User");
const Coupon = require("../models/Coupon"); // optional
const FormSubmission = require("../models/FormSubmission"); // optional
const MembershipPlan = require("../models/MembershipPlan"); // optional
const MembershipPurchase = require("../models/MembershipPurchase"); // optional

// Small helper
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// Only paid + live (exclude Stripe test providerRef starting with cs_test)
function buildLivePaidMatch() {
  return {
    paid: true,
    $or: [
      { provider: { $ne: "stripe" } }, // non-Stripe are treated as live
      { providerRef: { $not: /^cs_test/i } }, // exclude Stripe test checkout sessions
    ],
  };
}

// Use finalAmountMinor primarily, fall back to amountMinor if needed
const SUM_AMOUNT_EXPR = { $ifNull: ["$finalAmountMinor", "$amountMinor"] };

/**
 * GET /api/admin/dashboard
 * Query:
 *  - months: number of months to chart (default 12, max 36)
 *  - tz: IANA timezone for month bucketing (default "UTC")
 */
router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    const months = clamp(parseInt(req.query.months ?? "12", 10) || 12, 1, 36);
    const tz = (req.query.tz || "UTC").toString();

    // ---- date bounds ----
    const now = new Date();
    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (months - 1),
        1,
        0,
        0,
        0
      )
    );

    const LIVE_PAID_MATCH = buildLivePaidMatch();

    // ---- parallel summary queries ----
    const [
      usersTotal,
      usersActive,
      usersVerified,
      usersNewToday,
      usersNew7d,
      usersNew30d,
      couponsTotal,
      formsTotal,
      plansTotal,
      purchasesTotalLivePaid, // only paid+live
      revenueMinorTotal, // only paid+live
      revenueBreakdown, // region+currency breakdown
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ verified: true }),
      User.countDocuments({ createdAt: { $gte: startOfDayUTC(now) } }),
      User.countDocuments({ createdAt: { $gte: daysAgoUTC(7) } }),
      User.countDocuments({ createdAt: { $gte: daysAgoUTC(30) } }),

      // Optional collections—remove if you don't have them
      safeCount(Coupon),
      safeCount(FormSubmission),
      safeCount(MembershipPlan),

      // Purchases: only paid + live
      safeCountWhere(MembershipPurchase, LIVE_PAID_MATCH),

      // Sum paid+live revenue (finalAmountMinor fallback amountMinor)
      (async () => {
        if (!MembershipPurchase) return 0;
        const r = await MembershipPurchase.aggregate([
          {
            $match: { ...LIVE_PAID_MATCH, finalAmountMinor: { $exists: true } },
          },
          { $group: { _id: null, total: { $sum: SUM_AMOUNT_EXPR } } },
        ]);
        return r[0]?.total || 0;
      })(),

      // Breakdown by region + currency for paid+live
      (async () => {
        if (!MembershipPurchase) return [];
        const r = await MembershipPurchase.aggregate([
          { $match: LIVE_PAID_MATCH },
          {
            $group: {
              _id: {
                region: { $ifNull: ["$region", "UNKNOWN"] },
                currency: { $ifNull: ["$currency", "UNKNOWN"] },
              },
              totalAmountMinor: { $sum: SUM_AMOUNT_EXPR },
              totalTransactions: { $sum: 1 },
            },
          },
          { $sort: { "_id.region": 1, "_id.currency": 1 } },
        ]);
        return r;
      })(),
    ]);

    const usersInactive = usersTotal - usersActive;
    const usersUnverified = usersTotal - usersVerified;

    // ---- users-per-month aggregation (timezone aware) ----
    const usersMonthly = await User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateTrunc: { date: "$createdAt", unit: "month", timezone: tz },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const { labels, data } = fillMonthsSeries(usersMonthly, months, tz);

    // Derive currency totals (sum across regions for each currency)
    const revenueByCurrency = revenueBreakdown.reduce((acc, row) => {
      const cur = row._id.currency || "UNKNOWN";
      acc[cur] = (acc[cur] || 0) + (row.totalAmountMinor || 0);
      return acc;
    }, {});

    return res.json({
      summary: {
        usersTotal,
        usersActive,
        usersInactive,
        usersVerified,
        usersUnverified,
        usersNewToday,
        usersNew7d,
        usersNew30d,
        couponsTotal,
        formsTotal,
        plansTotal,

        purchasesTotal: purchasesTotalLivePaid, // only live+paid
        revenueMinorTotal, // only live+paid
        revenueBreakdown: revenueBreakdown.map((r) => ({
          region: r._id.region,
          currency: r._id.currency,
          totalAmountMinor: r.totalAmountMinor,
          totalTransactions: r.totalTransactions,
        })),
        revenueByCurrency, // e.g. { USD: 12345, EUR: 6789 }
      },
      charts: {
        usersPerMonth: { labels, data },
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/dashboard] error:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

module.exports = router;

/* ------------------------ helpers ------------------------ */

function startOfDayUTC(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)
  );
}
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Safe counter if model may not exist */
async function safeCount(Model) {
  try {
    if (!Model) return 0;
    return await Model.countDocuments({});
  } catch {
    return 0;
  }
}

async function safeCountWhere(Model, match) {
  try {
    return Model ? await Model.countDocuments(match || {}) : 0;
  } catch {
    return 0;
  }
}

/** Safe sum for a numeric field if model/field may not exist */
async function safeSumWhere(Model, field, match) {
  try {
    if (!Model) return 0;
    const r = await Model.aggregate([
      { $match: { ...(match || {}), [field]: { $type: "number" } } },
      { $group: { _id: null, total: { $sum: `$${field}` } } },
    ]);
    return r[0]?.total || 0;
  } catch {
    return 0;
  }
}

/**
 * Build a complete month series for the last N months ending this month.
 * Returns ISO "YYYY-MM" labels and matching data (zero-filled).
 */
function fillMonthsSeries(rows, months, tz) {
  const map = new Map();
  for (const r of rows) {
    const d = new Date(r._id);
    const k = isoYYYYMM(d, tz);
    map.set(k, (map.get(k) || 0) + r.count);
  }

  const labels = [];
  const data = [];
  const end = new Date();
  let year = end.getUTCFullYear();
  let month = end.getUTCMonth();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    const k = isoYYYYMM(d, tz);
    labels.push(k);
    data.push(map.get(k) || 0);
  }
  return { labels, data };
}

function isoYYYYMM(d, _tz) {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}
