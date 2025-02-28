require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");

const configurePassport = require("./config/passport");
const path = require("path");
// Initialize the app
const app = express();
// Configure CORS
app.use(
  cors({
    origin: "http://localhost:5000", // or your frontend domain
    credentials: true,
  })
);
// Database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport configuration
configurePassport(passport);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));
// Serve the 'catalogue' folder as a static directory
app.use("/catalogues", express.static(path.join(__dirname, "catalogues")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

// Form routes
app.use("/api/form", formRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: "Something went wrong!" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
