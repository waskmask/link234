// config/passport.js
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/User");
const bcrypt = require("bcryptjs");

module.exports = (passport) => {
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const normalized = (email || "").trim().toLowerCase();

          // ⬇️ IMPORTANT: select the hash
          const user = await User.findOne({ email: normalized }).select(
            "+password"
          );
          if (!user) return done(null, false, { message: "User not found" });
          if (!user.password)
            return done(null, false, { message: "No password on file" });

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch)
            return done(null, false, { message: "Incorrect password" });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Only relevant if you’re using sessions
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const u = await User.findById(id).select("-password");
      done(null, u);
    } catch (e) {
      done(e);
    }
  });
};
