
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// USER REGISTRATION
const registerUser = async (req, res, next) => {
  try {
    const { username, name, phone, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof name !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !name.trim() ||
      !phone.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username, name, phone number and password are required"
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 72 characters"
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number"
      });
    }

    const existingUser = await pool.query(
      `SELECT id
       FROM users
       WHERE deleted_at IS NULL
         AND (
           LOWER(username) = $1
           OR phone = $2
         )
       LIMIT 1`,
      [normalizedUsername, normalizedPhone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username or phone number already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (
        username,
        name,
        phone,
        password_hash,
        push_enabled
      )
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, username, name, phone,
                avatar_url, push_enabled, created_at`,
      [
        normalizedUsername,
        normalizedName,
        normalizedPhone,
        passwordHash
      ]
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: result.rows[0]
    });

  } catch (error) {
    console.error("Registration Error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username or phone number already registered"
      });
    }

    next(error);
  }
};


// USER LOGIN
const loginUser = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (
      typeof identifier !== "string" ||
      !identifier.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username/phone number and password are required"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT configuration is missing"
      });
    }

    const loginIdentifier = identifier.trim();

    const result = await pool.query(
      `SELECT id, username, name, phone,
              password_hash, avatar_url, push_enabled
       FROM users
       WHERE deleted_at IS NULL
         AND (
           LOWER(username) = $1
           OR phone = $2
         )
       LIMIT 1`,
      [loginIdentifier.toLowerCase(), loginIdentifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials"
      });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials"
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      }
    );

    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      push_enabled: user.push_enabled
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser
    });

  } catch (error) {
    console.error("Login Error:", error);
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser
};
