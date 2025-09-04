const express = require("express");
const session = require("express-session");
const router = express.Router();
require("dotenv").config();
const cors = require("cors");
const path = require("path");
const passport = require("passport");
const configurePassport = require("./config/passport");
const { connectDB, disconnectDB } = require("./config/db");
const cookieParser = require("cookie-parser");

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
router.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);
// app.use(
//   session({
//     secret: process.env.JWT_SECRET,
//     resave: false,
//     saveUninitialized: false,
//   })
// );
app.get("/api/health", (req, res) =>
  res.status(200).json({
    ok: true,
    pid: process.pid,
    message: process.env.SESSION_SECRET,
  })
);

/* ---------- proxy & cookies ---------- */
app.set("trust proxy", 1); // HTTPS behind nginx/plesk
app.use(cookieParser());

/* ---------- Stripe webhook (raw) BEFORE body parsers ---------- */
const webhookStripeHandler = require("./routes/webhookStripe");
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhookStripeHandler
);

/* ---------- other webhooks ---------- */
app.use("/api/razorpay/webhook", require("./routes/webhookRazorpay"));

/* ---------- parsers (after Stripe raw) ---------- */

/* ---------- sessions ---------- */
const sessionSecret = (process.env.SESSION_SECRET || "").trim();
if (!sessionSecret)
  console.warn("⚠️  SESSION_SECRET missing; using a dev fallback.");

const isProd = process.env.NODE_ENV === "production";
const cookieDomain =
  (process.env.FRONT_COOKIE_DOMAIN || "").trim() || undefined;

app.use(
  session({
    secret: sessionSecret || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true, // needed when TLS terminates at proxy
    cookie: {
      httpOnly: true,
      sameSite: "lax", // subdomain → same-site; works for XHR
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
const { geoCountryGeoip } = require("./middleware/geoCountryGeoip");

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/form", formRoutes);
app.use("/api/product-media", productMediaRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/memberships", memberShipRoutes);
app.use("/api/membership", require("./routes/membershipCheckoutRoutes"));
app.use("/api/coupons", require("./routes/couponAdminRoutes"));

app.use("/api/geo", geoRoutes);
app.use(
  "/api/membership",
  geoCountryGeoip,
  require("./routes/membershipPayRoutes")
);

// admin routes //
app.use("/api/admin-users", adminAuthRoutes);

/* ---------- errors ---------- */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: "Something went wrong!" });
});

/* ---------- start ---------- */
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

async function start(port = DEFAULT_PORT) {
  // Start server immediately so Passenger sees a bound port
  const server = app.listen(port, () => {
    console.log(`🚀 Server listening on ${port} (pid ${process.pid})`);
  });

  // Try DB connection in background (won’t block startup)
  connectDB()
    .then(() => console.log("✅ DB connected"))
    .catch((err) => console.error("❌ DB connect error:", err?.message || err));

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Port ${port} in use, trying ${port + 1}...`);
      setTimeout(() => start(port + 1), 250);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });

  const stop = () =>
    server.close(async () => {
      try {
        await disconnectDB?.();
      } finally {
        process.exit(0);
      }
    });

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
if (require.main === module) start();
