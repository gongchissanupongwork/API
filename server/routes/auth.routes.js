// routes/login.routes.js
const express = require("express");
const router = express.Router();
const { requireUserEmail } = require("../middleware/authMiddleware.js");
const bodyParser = require("body-parser");

router.use(bodyParser.json());

router.post("/login", async (req, res) => {
  const user_email = req.body.user_email;
  if (!user_email || typeof user_email !== "string") {
    return res.status(400).json({ error: "Missing or invalid user_email" });
  }

  req.headers.user_email = user_email;

  const authMiddleware = () =>
    new Promise((resolve, reject) => {
      requireUserEmail(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  try {
    await authMiddleware();
    res.json({ message: "User email is valid" });
  } catch (err) {
    // middleware น่าจะตอบ response แล้ว แต่ถ้ายังไม่ได้ ให้ส่ง error เผื่อไว้
    if (!res.headersSent) {
      res.status(500).json({ error: "Authentication failed" });
    }
  }
});

module.exports = router;
