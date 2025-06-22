const express = require("express");
const router = express.Router();
const { requireUserEmail } = require("./middleware/requireUserEmail"); // โค้ดที่คุณให้มา
const bodyParser = require("body-parser");

router.use(bodyParser.json());

// POST /login ตรวจสอบ user_email ใน body
router.post("/login", async (req, res) => {
  const user_email = req.body.user_email;
  if (!user_email || typeof user_email !== "string") {
    return res.status(400).json({ error: "Missing or invalid user_email" });
  }

  // สร้าง req.headers.user_email เพื่อใช้ middleware ตรวจสอบ
  req.headers.user_email = user_email;

  // เรียก middleware เพื่อเช็ค user_email
  requireUserEmail(req, res, () => {
    // ถ้าผ่าน จะมาถึงตรงนี้
    res.json({ message: "User email is valid" });
  });
});

module.exports = router;
