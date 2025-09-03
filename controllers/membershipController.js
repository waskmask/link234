// apis/controllers/membershipController.js
const MembershipPlan = require("../models/MembershipPlan");

const ALLOWED_DURATIONS = MembershipPlan.allowedDurations();
const ALLOWED_REGIONS = MembershipPlan.allowedRegions();

const isPositiveInt = (n) => Number.isInteger(n) && n >= 0;
const sanitizeString = (v) => (v == null ? v : String(v).trim());

// ---- Payload normalizer
function normalizePlanPayload(body = {}) {
  const payload = {};
  if (body.slug !== undefined)
    payload.slug = sanitizeString(body.slug)?.toLowerCase();
  if (body.displayName !== undefined)
    payload.displayName = sanitizeString(body.displayName);
  if (body.durationDays !== undefined)
    payload.durationDays = Number(body.durationDays);
  if (body.features !== undefined)
    payload.features = Array.isArray(body.features) ? body.features : [];
  if (body.isActive !== undefined) payload.isActive = !!body.isActive;
  if (body.sort !== undefined) payload.sort = Number(body.sort);
  if (body.notes !== undefined) payload.notes = sanitizeString(body.notes);

  // priceBook comes as array of {region,currency,amountMinor,isActive}
  if (body.priceBook !== undefined) {
    const pb = Array.isArray(body.priceBook) ? body.priceBook : [];
    payload.priceBook = pb.map((p) => ({
      region: sanitizeString(p.region),
      currency: sanitizeString(p.currency)?.toUpperCase(),
      amountMinor: Number(p.amountMinor),
      isActive: p.isActive === undefined ? true : !!p.isActive,
    }));
  }

  return payload;
}

function validatePlanPayload(payload, { isCreate = false } = {}) {
  const errors = [];

  if (isCreate) {
    if (!payload.slug) errors.push("slug is required.");
    if (!payload.displayName) errors.push("displayName is required.");
  }

  if (
    payload.durationDays !== undefined &&
    !ALLOWED_DURATIONS.includes(payload.durationDays)
  ) {
    errors.push(`durationDays must be one of ${ALLOWED_DURATIONS.join(", ")}.`);
  }

  if (payload.priceBook) {
    payload.priceBook.forEach((p, i) => {
      if (!ALLOWED_REGIONS.includes(p.region)) {
        errors.push(
          `priceBook[${i}].region must be one of ${ALLOWED_REGIONS.join(", ")}.`
        );
      }
      if (!p.currency) errors.push(`priceBook[${i}].currency is required.`);
      if (!isPositiveInt(p.amountMinor))
        errors.push(`priceBook[${i}].amountMinor must be an integer >= 0.`);
      // simple guard that matches your target regions
      if (p.region === "IN" && p.currency !== "INR")
        errors.push(`priceBook[${i}]: IN must use INR.`);
      if (p.region === "EU" && p.currency !== "EUR")
        errors.push(`priceBook[${i}]: EU must use EUR.`);
      if (p.region === "INTL" && p.currency !== "USD")
        errors.push(`priceBook[${i}]: INTL must use USD.`);
    });
  }

  return errors;
}

// ---- CRUD

// Create plan
exports.createMembership = async (req, res) => {
  try {
    const payload = normalizePlanPayload(req.body);
    const errors = validatePlanPayload(payload, { isCreate: true });
    if (errors.length)
      return res.status(400).json({ message: errors.join(" ") });

    // unique slug
    const exists = await MembershipPlan.findOne({ slug: payload.slug });
    if (exists)
      return res.status(409).json({ message: "Slug already exists." });

    const created = await MembershipPlan.create(payload);
    res.status(201).json({ message: "Membership created.", plan: created });
  } catch (err) {
    console.error("createMembership:", err);
    res.status(500).json({ message: "Failed to create membership." });
  }
};

// Update plan (partial)
exports.updateMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = normalizePlanPayload(req.body);

    // Prevent slug collision if changing slug
    if (payload.slug) {
      const conflict = await MembershipPlan.findOne({
        slug: payload.slug,
        _id: { $ne: id },
      });
      if (conflict)
        return res
          .status(409)
          .json({ message: "Slug already used by another plan." });
    }

    const errors = validatePlanPayload(payload);
    if (errors.length)
      return res.status(400).json({ message: errors.join(" ") });

    const updated = await MembershipPlan.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: "Membership not found." });

    res.json({ message: "Membership updated.", plan: updated });
  } catch (err) {
    console.error("updateMembership:", err);
    res.status(500).json({ message: "Failed to update membership." });
  }
};

// List plans (optional filters: q, active, sort)
exports.getMemberships = async (req, res) => {
  try {
    const { q, active, sort = "sort" } = req.query;
    const filter = {};
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;
    if (q) {
      const rx = new RegExp(q, "i");
      filter.$or = [{ slug: rx }, { displayName: rx }, { notes: rx }];
    }
    const plans = await MembershipPlan.find(filter).sort(sort);
    res.json({ plans });
  } catch (err) {
    console.error("getMemberships:", err);
    res.status(500).json({ message: "Failed to fetch memberships." });
  }
};

// Read single plan
exports.getMembershipById = async (req, res) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id);
    if (!plan)
      return res.status(404).json({ message: "Membership not found." });
    res.json({ plan });
  } catch (err) {
    console.error("getMembershipById:", err);
    res.status(500).json({ message: "Failed to fetch membership." });
  }
};

// Toggle active
exports.toggleMembershipActive = async (req, res) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id);
    if (!plan)
      return res.status(404).json({ message: "Membership not found." });
    plan.isActive = !plan.isActive;
    await plan.save();
    res.json({
      message: `Membership ${plan.isActive ? "activated" : "deactivated"}.`,
      plan,
    });
  } catch (err) {
    console.error("toggleMembershipActive:", err);
    res.status(500).json({ message: "Failed to toggle membership." });
  }
};

// Delete plan (safe delete; block if used in orders in your app)
exports.deleteMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MembershipPlan.findByIdAndDelete(id);
    if (!plan)
      return res.status(404).json({ message: "Membership not found." });
    res.json({ message: "Membership deleted." });
  } catch (err) {
    console.error("deleteMembership:", err);
    res.status(500).json({ message: "Failed to delete membership." });
  }
};

// ---- PriceBook ops (fine-grained admin)

// Upsert (add or update) one priceBook entry by region
exports.upsertRegionPrice = async (req, res) => {
  try {
    const { id } = req.params; // plan id
    const { region, currency, amountMinor, isActive = true } = req.body;

    if (!ALLOWED_REGIONS.includes(region)) {
      return res.status(400).json({
        message: `region must be one of ${ALLOWED_REGIONS.join(", ")}.`,
      });
    }
    if (!currency)
      return res.status(400).json({ message: "currency is required." });
    const amt = Number(amountMinor);
    if (!Number.isFinite(amt) || amt < 0)
      return res.status(400).json({ message: "amountMinor must be >= 0." });

    // simple mapping guard
    if (region === "IN" && currency.toUpperCase() !== "INR")
      return res.status(400).json({ message: "IN must use INR." });
    if (region === "EU" && currency.toUpperCase() !== "EUR")
      return res.status(400).json({ message: "EU must use EUR." });
    if (region === "INTL" && currency.toUpperCase() !== "USD")
      return res.status(400).json({ message: "INTL must use USD." });

    const plan = await MembershipPlan.findById(id);
    if (!plan)
      return res.status(404).json({ message: "Membership not found." });

    const idx = plan.priceBook.findIndex((p) => p.region === region);
    const entry = {
      region,
      currency: currency.toUpperCase(),
      amountMinor: amt,
      isActive: !!isActive,
    };

    if (idx >= 0) plan.priceBook[idx] = entry;
    else plan.priceBook.push(entry);

    await plan.save();
    res.json({ message: "Price updated.", plan });
  } catch (err) {
    console.error("upsertRegionPrice:", err);
    res.status(500).json({ message: "Failed to update region price." });
  }
};

// Remove one region from priceBook
exports.removeRegionPrice = async (req, res) => {
  try {
    const { id, region } = req.params; // plan id + region code
    const plan = await MembershipPlan.findById(id);
    if (!plan)
      return res.status(404).json({ message: "Membership not found." });

    const before = plan.priceBook.length;
    plan.priceBook = plan.priceBook.filter((p) => p.region !== region);
    if (plan.priceBook.length === before) {
      return res.status(404).json({ message: "Region price not found." });
    }

    await plan.save();
    res.json({ message: "Region price removed.", plan });
  } catch (err) {
    console.error("removeRegionPrice:", err);
    res.status(500).json({ message: "Failed to remove region price." });
  }
};
