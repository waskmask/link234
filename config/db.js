// config/db.js
const mongoose = require("mongoose");

let isConnected = false;

async function connectDB({
  uri = process.env.MONGO_URI,
  retries = 5,
  delayMs = 2000,
} = {}) {
  if (!uri) throw new Error("Missing MONGO_URI. Add it to .env");

  // Mongoose settings
  mongoose.set("strictQuery", false);
  if (process.env.NODE_ENV !== "production") {
    mongoose.set("debug", false); // set true if you want query logs
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `📡 Connecting to MongoDB (attempt ${attempt}/${retries})...`
      );
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        // autoIndex: process.env.NODE_ENV !== "production",
      });
      isConnected = true;

      console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

      mongoose.connection.on("disconnected", () => {
        isConnected = false;
        console.warn("⚠️ MongoDB disconnected");
      });

      mongoose.connection.on("reconnected", () => {
        isConnected = true;
        console.log("🔁 MongoDB reconnected");
      });

      return mongoose.connection;
    } catch (err) {
      console.error(`❌ MongoDB error: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt)); // simple backoff
    }
  }
}

async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.connection.close(false);
  isConnected = false;
  console.log("🛑 MongoDB connection closed");
}

module.exports = { connectDB, disconnectDB };
