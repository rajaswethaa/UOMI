
const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser
} = require("../controllers/authcontroller");

const authenticateUser = require("../middleware/auth.middleware");

// Registration
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Protected test API
router.get("/me", authenticateUser, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authentication successful",
    user: req.user
  });
});

module.exports = router;
