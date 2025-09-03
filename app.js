require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const passport = require("passport");
const configurePassport = require("./config/passport");
const session = require("express-session");
const { connectDB, disconnectDB } = require("./config/db");
const cookieParser = require("cookie-parser");

// routes + passport
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");
const productMediaRoutes = require("./routes/productMediaRoutes");
const templateRoutes = require("./routes/templateRoutes");
const memberShipRoutes = require("./routes/membershipRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const geoRoutes = require("./routes/geoRoutes");
// 2) Build the app (NO app.listen here yet)
const app = express();
app.use(cookieParser());
// CORS
app.use(
  cors({
    origin: process.env.API_URL_FRONT,
    credentials: true,
  })
);

const webhookStripeHandler = require("./routes/webhookStripe");

// MUST be raw. MUST be before express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  webhookStripeHandler
);

app.use("/api/razorpay/webhook", require("./routes/webhookRazorpay"));
// parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// sessions
const sessionSecret = (process.env.SESSION_SECRET || "").trim();
if (!sessionSecret)
  console.warn("⚠️  SESSION_SECRET missing; using a dev fallback.");
app.use(
  session({
    secret: sessionSecret || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// passport
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// static
app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));
app.use("/catalogues", express.static(path.join(__dirname, "catalogues")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));

app.set("trust proxy", true);
const { geoCountryGeoip } = require("./middleware/geoCountryGeoip");

// routes

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

// admin routes
app.use("/api/admin-users", adminAuthRoutes);

// errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: "Something went wrong!" });
});

// 3) Start server ONCE after DB connects
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

async function start(port = DEFAULT_PORT) {
  // helpful trace: if you EVER see this twice, you know what's wrong
  // console.trace("🔈 app.listen is being called");

  await connectDB();

  const server = app.listen(port, () => {
    console.log(`🚀 Server listening on ${port} (pid ${process.pid})`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️  Port ${port} in use, trying ${port + 1}...`);
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

// 4) Only start if this file is run directly (prevents double-run if imported)
if (require.main === module) start();
