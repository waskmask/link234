// apis/controllers/membershipPayController.js
const mongoose = require("mongoose");
const MembershipPlan = require("../models/MembershipPlan");
const MembershipPurchase = require("../models/MembershipPurchase");
const Coupon = require("../models/Coupon");
const User = require("../models/User");

// libs
const Razorpay = require("razorpay");
const getStripe = require("../utils/stripeClient");

// -------------------------------------
// config / helpers
// -------------------------------------
const isProd = process.env.NODE_ENV === "production";
const DEBUG_PAY = process.env.PAY_DEBUG === "1";

// Unified responder (message = i18n key, hint = human tip, stage = where it failed)
function send(res, status, message, extra = {}) {
  const body = { ok: false, message };
  if (extra.hint) body.hint = extra.hint;
  if (extra.stage) body.stage = extra.stage;
  if (extra.context) body.context = extra.context;

  // Include dev details only in dev or when PAY_DEBUG=1
  if (!isProd || DEBUG_PAY) {
    if (extra.err) {
      body.dev = {
        name: extra.err?.name,
        message: extra.err?.message,
        stack: extra.err?.stack,
      };
    }
  }
  return res.status(status).json(body);
}

// Map ISO country code -> region your schema expects: "IN" | "EU" | "INTL"
const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);
function mapCountryToRegion(iso2) {
  const cc = String(iso2 || "").toUpperCase();
  if (cc === "IN") return "IN";
  if (EU_COUNTRIES.has(cc)) return "EU";
  return "INTL";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function findPriceForRegion(plan, region) {
  const book = Array.isArray(plan.priceBook) ? plan.priceBook : [];
  const entry = book.find((p) => p.region === region && p.isActive !== false);
  return entry || null;
}

async function computeDiscount({
  couponCode,
  userId,
  region,
  baseAmountMinor,
}) {
  if (!couponCode) return { discountMinor: 0, coupon: null };

  const code = String(couponCode).trim().toUpperCase();
  const coupon = await Coupon.findOne({ code, isActive: true });
  if (!coupon) return { discountMinor: 0, coupon: null };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now)
    return { discountMinor: 0, coupon: null };
  if (coupon.endsAt && coupon.endsAt < now)
    return { discountMinor: 0, coupon: null };
  if (coupon.regions?.length && !coupon.regions.includes(region))
    return { discountMinor: 0, coupon: null };

  if (coupon.perUserLimit > 0) {
    const usedByUser = await MembershipPurchase.countDocuments({
      user: userId,
      couponCode: code,
      paid: true,
    });
    if (usedByUser >= coupon.perUserLimit)
      return { discountMinor: 0, coupon: null };
  }

  if (coupon.usageLimit > 0) {
    const totalRedemptions = Number(coupon.stats?.totalRedemptions || 0);
    if (totalRedemptions >= coupon.usageLimit)
      return { discountMinor: 0, coupon: null };
  }

  let discountMinor = 0;
  if (coupon.type === "percent") {
    discountMinor = Math.round((baseAmountMinor * coupon.value) / 100);
    if (coupon.maxDiscountMinor > 0)
      discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
  } else {
    discountMinor = Math.round(coupon.value);
  }

  discountMinor = clamp(discountMinor, 0, baseAmountMinor);
  return { discountMinor, coupon };
}

// -------------------------------------
// Controller
// -------------------------------------
// POST /api/membership/start
// body: { planSlugOrId, couponCode?, countryCode? }
exports.startPayment = async (req, res) => {
  try {
    // 1) Auth
    if (!req.user?.id) {
      return send(res, 401, "unauthorized", {
        hint: "Please log in and try again.",
        stage: "auth",
      });
    }

    // 2) Input
    const { planSlugOrId, couponCode, countryCode } = req.body || {};
    if (!planSlugOrId) {
      return send(res, 400, "plan_required", {
        hint: "Select a membership plan before continuing.",
        stage: "input",
        context: { fields: ["planSlugOrId"] },
      });
    }

    // 3) Plan (safe lookup by slug OR id)
    const raw = String(planSlugOrId).trim();
    const or = [{ slug: raw }];
    if (mongoose.isValidObjectId(raw)) or.push({ _id: raw });

    const plan = await MembershipPlan.findOne({ isActive: true, $or: or });
    if (!plan) {
      return send(res, 404, "plan_not_found", {
        hint: "This plan is unavailable. Please refresh and choose a valid plan.",
        stage: "plan_lookup",
        context: { planSlugOrId: raw },
      });
    }

    // 4) User (fresh)
    const user = await User.findById(req.user.id);
    if (!user) {
      return send(res, 404, "user_not_found", {
        hint: "Your session is invalid. Log in again.",
        stage: "user_lookup",
      });
    }

    // 5) Region/currency snapshot
    const detectedCountry = (req.geo?.countryCode || "INTL").toUpperCase();
    const region = req.geo?.region || "INTL";

    const price = findPriceForRegion(plan, region);
    if (!price) {
      return send(res, 400, "price_not_available_for_region", {
        hint: `This plan has no price for your region (${region}).`,
        stage: "price_lookup",
        context: {
          region,
          country: detectedCountry,
          availableRegions: (plan.priceBook || [])
            .filter((p) => p.isActive !== false)
            .map((p) => p.region),
        },
      });
    }

    const baseAmountMinor = Number(price.amountMinor || 0);
    if (!Number.isFinite(baseAmountMinor) || baseAmountMinor <= 0) {
      return send(res, 400, "invalid_price_amount", {
        hint: "Plan price is misconfigured. Please contact support.",
        stage: "price_validate",
        context: { amountMinor: price.amountMinor, currency: price.currency },
      });
    }

    const durationDays = Number(plan.durationDays || 0);
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      return send(res, 400, "plan_missing_duration", {
        hint: "This plan is misconfigured (durationDays is missing).",
        stage: "plan_validate",
        context: { plan: plan.slug, durationDays: plan.durationDays },
      });
    }

    // 6) Discount & final
    const { discountMinor, coupon } = await computeDiscount({
      couponCode,
      userId: user._id,
      region,
      baseAmountMinor,
    });

    const finalAmountMinor = clamp(
      baseAmountMinor - discountMinor,
      0,
      baseAmountMinor
    );

    const summary = {
      region,
      currency: price.currency,
      baseAmountMinor,
      discountMinor,
      finalAmountMinor,
      durationDays,
      coupon: coupon?.code || null,
    };

    // 7) Persist purchase (schema-aligned)
    let purchase;
    try {
      const provider =
        region === "IN" && String(price.currency).toUpperCase() === "INR"
          ? "razorpay"
          : "stripe";

      purchase = await MembershipPurchase.create({
        user: user._id,
        plan: plan._id,
        region, // "IN" | "EU" | "INTL"
        currency: price.currency, // e.g. "INR" | "EUR" | "USD"
        durationDays, // required
        baseAmountMinor, // required
        discountMinor, // default ok
        finalAmountMinor, // required
        couponCode: coupon?.code || "",
        paid: false,
        provider, // schema uses "provider", not "gateway"
        providerRef: "", // will fill after we get order/session id
      });
    } catch (err) {
      console.error("purchase_create_failed:", err);
      return send(res, 500, "purchase_create_failed", {
        hint: "Could not create a purchase record.",
        stage: "purchase_create",
        context: { region, currency: price.currency, finalAmountMinor },
        err,
      });
    }

    // 8) Gateways
    if (region === "IN" && String(price.currency).toUpperCase() === "INR") {
      // ---- Razorpay ----
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return send(res, 500, "razorpay_not_configured", {
          hint: "Payments are temporarily unavailable. Try again later.",
          stage: "gateway_init",
        });
      }

      try {
        const razor = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const order = await razor.orders.create({
          amount: finalAmountMinor, // paise
          currency: "INR",
          receipt: String(purchase._id),
          notes: { plan: plan.slug, user: String(user._id) },
        });

        // Save providerRef for traceability
        await MembershipPurchase.findByIdAndUpdate(purchase._id, {
          providerRef: order.id,
        });

        return res.json({
          ok: true,
          gateway: "razorpay", // keep for frontend; DB stores provider
          keyId: process.env.RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          orderId: order.id,
          purchaseId: String(purchase._id),
          customer: { name: user.username, email: user.email },
          summary,
        });
      } catch (err) {
        console.error("razorpay_order_create_failed:", err);
        return send(res, 502, "razorpay_order_create_failed", {
          hint: "Could not create the payment order.",
          stage: "razorpay_order_create",
          context: { finalAmountMinor },
          err,
        });
      }
    }

    // ---- Stripe ----
    const stripe = getStripe();
    if (!stripe) {
      return send(res, 500, "stripe_not_configured", {
        hint: "Payments are temporarily unavailable. Try again later.",
        stage: "gateway_init",
      });
    }
    if (!process.env.FRONT_SUCCESS_URL || !process.env.FRONT_CANCEL_URL) {
      return send(res, 500, "success_or_cancel_url_missing", {
        hint: "Payment return URLs are missing. Contact support.",
        stage: "gateway_init",
        context: {
          hasSuccess: !!process.env.FRONT_SUCCESS_URL,
          hasCancel: !!process.env.FRONT_CANCEL_URL,
        },
      });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: String(price.currency || "").toLowerCase(),
              product_data: {
                name: `${plan.displayName || plan.slug} (${durationDays} days)`,
              },
              unit_amount: finalAmountMinor, // smallest unit
            },
            quantity: 1,
          },
        ],
        customer_email: user.email,
        client_reference_id: String(purchase._id),
        success_url: `${process.env.FRONT_SUCCESS_URL}?purchaseId=${purchase._id}`,
        cancel_url: process.env.FRONT_CANCEL_URL,
        metadata: { purchaseId: String(purchase._id), plan: plan.slug },
      });

      // Save providerRef for traceability
      await MembershipPurchase.findByIdAndUpdate(purchase._id, {
        providerRef: session.id,
      });
    } catch (err) {
      console.error("stripe_session_create_failed:", err);
      return send(res, 502, "stripe_session_create_failed", {
        hint: "We couldn't start the Stripe checkout.",
        stage: "stripe_session_create",
        context: { currency: price.currency, finalAmountMinor },
        err,
      });
    }

    return res.json({
      ok: true,
      gateway: "stripe", // keep for frontend
      url: session.url,
      sessionId: session.id,
      purchaseId: String(purchase._id),
      summary,
    });
  } catch (err) {
    console.error("startPayment_unhandled:", err);
    return send(res, 500, "failed_to_start_payment", {
      hint: "Unexpected error while initiating payment.",
      stage: "unhandled",
      err,
    });
  }
};
