// utils/stripeClient.js
const Stripe = require("stripe");

let stripe = null;
module.exports = function getStripe() {
  if (stripe) return stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("[Stripe] STRIPE_SECRET_KEY is missing");
    return null; // don't crash the process
  }
  stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return stripe;
};
