
const jwt = require("jsonwebtoken");

// Verify JWT token
const authenticateUser = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check whether Authorization header exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication token is required."
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing."
      });
    }

    // Check JWT secret
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT configuration is missing."
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach authenticated user details
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role || "user"
    };

    next();

  } catch (error) {
    // Debug information in backend terminal
    console.error("JWT Verification Error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token."
    });
  }
};

// Check user role
const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
};

// Support both default and named imports
module.exports = authenticateUser;
module.exports.authenticate = authenticateUser;
module.exports.authenticateUser = authenticateUser;
module.exports.authorize = authorize;
