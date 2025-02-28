const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  // First try to extract token from cookies
  let token = req.cookies && req.cookies.token;

  // If not found in cookies, try the Authorization header as a fallback
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded User:", decoded); // Debug: check if decoding works
    req.user = decoded; // Attach decoded payload to request object
    console.log("Received token:", token);

    console.log("Decoded User:", decoded);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};
