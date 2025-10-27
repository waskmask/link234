// server.js (Link234 API) — cleaned + CORS-fixed

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");

// --- Routes (as in your current project) ---
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");
const productMediaRoutes = require("./routes/productMediaRoutes");
const templateRoutes = require("./routes/templateRoutes");
const memberShipRoutes = require("./routes/membershipRoutes");

const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminMembershipRoutes = require("./routes/adminMembershipRoutes");
const adminAppUserRoutes = require("./routes/adminAppUsersRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");

const geoRoutes = require("./routes/geoRoutes");
const webhookStripeHandler = require("./routes/webhookStripe");
const configurePassport = require("./config/passport");
const { geoCountryGeoip } = require("./middleware/geoCountryGeoip");

// --- Setup ---
const app = express();
app.set("trust proxy", 1); // behind nginx/Passenger/Plesk

// ---------- HEALTH ----------
app.get("/api/health", (req, res) =>
  res.status(200).json({ ok: true, pid: process.pid })
);
app.get("/health", (req, res) =>
  res.status(200).json({ ok: true, pid: process.pid })
);

// ---------- STRIPE WEBHOOK (RAW) BEFORE ANY JSON PARSER ----------
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhookStripeHandler
);

// ---------- COOKIES, GEO ----------
app.use(cookieParser());
app.use(geoCountryGeoip);

// ---------- BODY PARSERS (ONCE) ----------
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- CORS (env-driven allowlist) ----------
const allowList = (process.env.API_URL_WHITELIST || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // e.g., curl/Postman
    return cb(null, allowList.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // Let cors reflect Access-Control-Request-Headers automatically
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// (Optional) request log for debugging
app.use((req, res, next) => {
  console.log(
    `Origin=${req.headers.origin || "-"} | ${req.method} ${req.path}`
  );
  next();
});

// ---------- SESSIONS ----------
const isProd = process.env.NODE_ENV === "production";
const sessionSecret = (process.env.SESSION_SECRET || "").trim();
if (!sessionSecret) {
  console.warn("⚠️  SESSION_SECRET missing; using a dev fallback.");
}
const cookieDomain =
  (process.env.FRONT_COOKIE_DOMAIN || "").trim() || undefined; // e.g. .link234.com
const crossSite = String(process.env.CROSS_SITE || "").toLowerCase() === "true";

app.use(
  session({
    secret: sessionSecret || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: crossSite ? "none" : "lax",
      secure: isProd,
      domain: cookieDomain,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ---------- PASSPORT ----------
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// ---------- STATIC ----------
app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));
app.use("/catalogues", express.static(path.join(__dirname, "catalogues")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));

// ---------- ROUTES ----------
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes); // alias so /auth/login works if frontend calls that

app.use("/api/user", userRoutes);
app.use("/api/form", formRoutes);
app.use("/api/product-media", productMediaRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/memberships", memberShipRoutes);
app.use("/api/membership", require("./routes/membershipCheckoutRoutes"));
app.use("/api/coupons", require("./routes/couponAdminRoutes"));

app.use("/api/geo", geoRoutes);
app.use("/api/membership", require("./routes/membershipPayRoutes"));

// webhooks (others) — these typically use JSON, so AFTER parsers is fine
app.use("/api/razorpay/webhook", require("./routes/webhookRazorpay"));

// admin routes
app.use("/api/admin-users", adminAuthRoutes);
app.use("/api", adminMembershipRoutes);
app.use("/api/admin", adminAppUserRoutes);
app.use("/api/admin", adminDashboardRoutes);

// ---------- ERRORS ----------
app.use((err, req, res, next) => {
  console.error("[UNHANDLED ERROR]", err);
  // Ensure CORS headers are present on errors too:
  // (cors middleware already ran; just reply JSON)
  res.status(500).json({ message: "Something went wrong!" });
});

// ---------- DB + START ----------
const mongoUri = process.env.MONGO_URI;
mongoose
  .connect(mongoUri, { autoIndex: false })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on :${PORT}`);
});
