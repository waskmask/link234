// utils/jwt.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};
