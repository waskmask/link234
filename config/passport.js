// config/passport.js
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/User");
const bcrypt = require("bcryptjs");

module.exports = (passport) => {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email });
          if (!user) return done(null, false, { message: "User not found" });

          // Compare entered password with stored hashed password
          const isMatch = await bcrypt.compare(password, user.password);
          return isMatch
            ? done(null, user)
            : done(null, false, { message: "Incorrect password" });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => User.findById(id, done));
};
