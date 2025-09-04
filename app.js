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

// app.use("/public", express.static("public"));
// app.use("/uploads", express.static("uploads"));

// mongoose.connect(url, { useNewUrlParser: true });

//swagger
// const options = {
//   swaggerDefinition,
//   apis: ["./swagger/*.js"],
// };

// const swaggerSpec = swaggerJSDoc(options);
// app.get("/swagger.json", function (req, res) {
//   res.setHeader("Content-Type", "application/json");
//   res.send(swaggerSpec);
// });

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// const con = mongoose.connection;

// con.on("open", () => {
//   console.log("Connected...");
// });

//Routes
// app.use("/", routes(router));
// app.use(passport.initialize());
// app.use(passport.session());

// error handler
app.use((error, req, res, next) => {
  if (!error) {
    return next();
  }
  console.log(error);
  res.status(error.status || 500).send({
    status: error.status || 500,
    error: error.message || error,
    data: error.data || "",
  });
});

app.listen(3000, () => {
  console.log("Server started");
});
