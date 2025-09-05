// utils/mailer.js
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// Optional: verify once at startup (call this from app.js)
async function verifySmtp() {
  try {
    await transporter.verify();
    console.log("[mailer] SMTP ready");
  } catch (e) {
    console.error("[mailer] SMTP verify failed:", e);
  }
}

function renderTemplate(tplPath, map) {
  let html = fs.readFileSync(tplPath, "utf8");
  Object.entries(map).forEach(([k, v]) => {
    const val = v == null ? "" : String(v);
    html = html.replace(new RegExp(`{{${k}}}`, "g"), val);
  });
  return html;
}

async function sendMembershipSuccessEmail({
  user,
  purchase,
  plan,
  receiptUrl = "",
}) {
  const tpl = path.join(
    __dirname,
    "..",
    "emails",
    "membershipSuccessEmail.html"
  );

  // currency formatters
  const fmt = (minor, cur) =>
    minor == null
      ? ""
      : new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: cur,
        }).format((Number(minor) || 0) / 100);

  const html = renderTemplate(tpl, {
    BRAND_NAME: process.env.BRAND_NAME || "Link234",
    BRAND_LOGO_URL:
      process.env.BRAND_LOGO_URL || "https://link234.com/l234-logo.png",
    USER_NAME: user?.profileName || user?.username || user?.email,
    PLAN_NAME: plan?.displayName || plan?.slug || "Membership",
    TRANSACTION_ID: purchase?.providerRef || "",
    PROVIDER: purchase?.provider || "",
    REGION: purchase?.region || "",
    TOTAL_FORMATTED: fmt(purchase?.finalAmountMinor, purchase?.currency),
    BASE_FORMATTED: fmt(purchase?.baseAmountMinor, purchase?.currency),
    DISCOUNT_FORMATTED: fmt(purchase?.discountMinor, purchase?.currency),
    DURATION_DAYS: purchase?.durationDays || "",
    PERIOD_END: user?.membership?.currentPeriodEnd
      ? new Date(user.membership.currentPeriodEnd).toLocaleDateString()
      : "",
    DASHBOARD_URL:
      process.env.FRONT_DASHBOARD_URL || "https://app.link234.com/dashboard",
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@link234.com",
  });

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.BRAND_NAME || "Link234"}" <${
        process.env.SMTP_USER
      }>`,
      to: user.email,
      subject: `Your ${plan?.displayName || "membership"} is active`,
      html,
    });
    return info;
  } catch (e) {
    console.error("[mailer] sendMail failed:", e);
    throw e;
  }
}

module.exports = { sendMembershipSuccessEmail, verifySmtp };
