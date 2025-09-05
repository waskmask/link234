const express = require("express");
const session = require("express-session");
const router = express.Router();
require("dotenv").config();
const cors = require("cors");
const path = require("path");
const passport = require("passport");
const configurePassport = require("./config/passport");
// const { connectDB, disconnectDB } = require("./config/db");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const url = process.env.MONGO_URI;

// routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");
const productMediaRoutes = require("./routes/productMediaRoutes");
const templateRoutes = require("./routes/templateRoutes");
const memberShipRoutes = require("./routes/membershipRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const geoRoutes = require("./routes/geoRoutes");

var app = express();

app.get("/api/health", (req, res) =>
  res.status(200).json({
    ok: true,
    pid: process.pid,
  })
);

/* ---------- proxy & cookies ---------- */
app.set("trust proxy", true); // HTTPS behind nginx/plesk

app.use(cookieParser());

app.set("trust proxy", true);
const { geoCountryGeoip } = require("./middleware/geoCountryGeoip");
app.use(geoCountryGeoip);

/* ---------- CORS (env-driven) ---------- */
const allowList = (process.env.API_URL_FRONT || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true); // curl/postman
  return cb(null, allowList.includes(origin)); // strict allowlist
}

const corsOptions = {
  origin: corsOrigin,
  credentials: true, // let browser send cookies
};

// Preflight short-circuit so OPTIONS never 500/504
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") return next();

  const origin = req.headers.origin;
  const allowed = origin && allowList.includes(origin);

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    // reflect what the browser asked for:
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.headers["access-control-request-headers"] || ""
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      req.headers["access-control-request-method"] ||
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  return res.sendStatus(204);
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  console.log(
    `Request Origin: ${req.headers.origin} | Path: ${req.path} | Method: ${req.method}`
  );
  next();
});

/* ---------- Stripe webhook (raw) BEFORE body parsers ---------- */
const webhookStripeHandler = require("./routes/webhookStripe");
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhookStripeHandler
);

/* ---------- other webhooks ---------- */
app.use("/api/razorpay/webhook", require("./routes/webhookRazorpay"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ---------- sessions ---------- */
const sessionSecret = (process.env.SESSION_SECRET || "").trim();
if (!sessionSecret)
  console.warn("⚠️  SESSION_SECRET missing; using a dev fallback.");

const isProd = process.env.NODE_ENV === "production";
const cookieDomain =
  (process.env.FRONT_COOKIE_DOMAIN || "").trim() || undefined;
const crossSite = String(process.env.CROSS_SITE).toLowerCase() === "true";

app.use(
  session({
    secret: sessionSecret || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true, // needed when TLS terminates at proxy
    cookie: {
      httpOnly: true,
      sameSite: crossSite ? "none" : "lax",
      secure: isProd, // must be true on HTTPS
      domain: cookieDomain, // e.g. .link234.com
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

/* ---------- passport ---------- */
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

/* ---------- static ---------- */
app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));
app.use("/catalogues", express.static(path.join(__dirname, "catalogues")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));

/* ---------- routes ---------- */

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/form", formRoutes);
app.use("/api/product-media", productMediaRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/memberships", memberShipRoutes);
app.use("/api/membership", require("./routes/membershipCheckoutRoutes"));
app.use("/api/coupons", require("./routes/couponAdminRoutes"));

app.use("/api/geo", geoRoutes);
app.use("/api/membership", require("./routes/membershipPayRoutes"));

// admin routes //
app.use("/api/admin-users", adminAuthRoutes);

/* ---------- errors ---------- */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: "Something went wrong!" });
});

mongoose.connect(url);

const con = mongoose.connection;

con.on("open", () => {
  console.log("Connected...");
});

app.listen(3000, () => {
  console.log("Server started");
});
