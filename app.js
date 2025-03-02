require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");
// Import User model
// const User = require("./models/User");

const configurePassport = require("./config/passport");
const path = require("path");
// Initialize the app
const app = express();
// Configure CORS
app.use(
  cors({
    origin: ["http://localhost:5000", "https://link234.com"],
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

// QR download
// Download API endpoint
app.get("/api/download", (req, res) => {
  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: "Missing filename parameter" });
  }

  // Basic validation to prevent directory traversal attacks
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  // Construct the full path to the file in the qrcodes folder
  const filePath = path.join(__dirname, "qrcodes", filename);

  // Use res.download to send the file as an attachment.
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      return res.status(500).json({ error: "Error downloading file" });
    }
  });
});

// Migration endpoint: Update membership dates for existing users that have memberships but are missing addedOn or expiresOn
// app.get("/api/migrate/membershipDates", async (req, res) => {
//   try {
//     const result = await User.updateMany(
//       {
//         $or: [
//           { "memberships.addedOn": { $exists: false } },
//           { "memberships.expiresOn": { $exists: false } },
//         ],
//       },
//       [
//         {
//           $set: {
//             "memberships.addedOn": {
//               $ifNull: ["$memberships.addedOn", "$$NOW"],
//             },
//             "memberships.expiresOn": {
//               $dateAdd: {
//                 startDate: { $ifNull: ["$memberships.addedOn", "$$NOW"] },
//                 unit: "day",
//                 amount: "$memberships.durationDays",
//               },
//             },
//           },
//         },
//       ]
//     );
//     res.json({ message: "Membership dates updated", result });
//   } catch (err) {
//     console.error("Error migrating membership dates:", err);
//     res
//       .status(500)
//       .json({
//         message: "Error migrating membership dates",
//         error: err.message,
//       });
//   }
// });

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
