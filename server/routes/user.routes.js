// routes/user.routes.js
const express = require("express");
const router = express.Router();
const { request } = require("graphql-request");
const { USERS_QUERY } = require("../graphql/queries");
const { UPDATE_USER_STATUS } = require("../graphql/mutation.js");
const { NOTE_ADD_MUTATION } = require("../graphql/mutations");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");
const { requireUserEmail } = require("../middleware/authMiddleware");
const { appendHistory } = require("../utils/history"); // ✅ เปลี่ยน path ถ้าคุณแยกออก

// ===================
// GET: รายชื่อผู้ใช้ทั้งหมด
// ===================
// router.get("/users", requireUserEmail, async (req, res) => {
//   const headers = {
//     Authorization: `Bearer ${TOKEN}`,
//   };

//   try {
//     const data = await request({
//       url: GRAPHQL_ENDPOINT,
//       document: USERS_QUERY,
//       variables: {},
//       requestHeaders: headers,
//     });
//     res.json(data);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch users" });
//   }
// });

// ===================
// PUT: ปลดล็อกบัญชีผู้ใช้ตาม user_email
// ===================
router.put("/unlock", requireUserEmail, async (req, res) => {
  const { user_email } = req.body;

  if (
    !user_email ||
    typeof user_email !== "string" ||
    user_email.trim() === ""
  ) {
    return res.status(400).json({ error: "Missing or invalid 'user_email'" });
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    // 1. ดึง users ทั้งหมด
    const usersData = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });

    // 2. หา user ที่ตรงกับ email
    const users = usersData?.users?.edges || [];
    const matchedUser = users
      .map((u) => u.node)
      .find((u) => u.user_email.toLowerCase() === user_email.toLowerCase());

    if (!matchedUser) {
      return res.status(404).json({ error: "User not found with given email" });
    }

    const { id, name, account_status } = matchedUser;

    // 3. ปลดล็อกบัญชี
    const unlockData = await request({
      url: GRAPHQL_ENDPOINT,
      document: UPDATE_USER_STATUS,
      variables: { id },
      requestHeaders: headers,
    });

    const unlockedUser = unlockData?.unlockAccount;

    if (!unlockedUser) {
      return res.status(500).json({ error: "Failed to unlock user account" });
    }

    // ✅ 4. บันทึกประวัติการเปลี่ยนแปลง
    appendHistory(
      "unlockUser",
      [
        {
          id: String(id),
          name: String(name),
          user_email: String(user_email),
          status_before: account_status,
          status_after: unlockedUser.account_status,
        },
      ],
      req.user
    );

    // ✅ 5. เพิ่มโน้ต
    const noteVars = {
      input: {
        action: "Unlocked",
        content: `Account unlocked by ${req.user.name} (${req.user.user_email})`,
        objects: id, // 👈 รับเป็น string เดี่ยว ไม่ใช่ array
      },
    };

    const noteResponse = await request({
      url: GRAPHQL_ENDPOINT,
      document: NOTE_ADD_MUTATION,
      variables: noteVars,
      requestHeaders: headers,
    });

    // ✅ 6. บันทึกประวัติการเพิ่มโน้ต (ตรวจสอบก่อนบันทึก)
    if (noteResponse?.noteAdd) {
      appendHistory("addNote", [noteResponse.noteAdd], req.user);
    }

    res.json({
      ...unlockedUser,
      note: noteResponse.noteAdd,
    });
  } catch (error) {
    console.error("❌ Failed to unlock account or add note:");
    if (error.response?.errors) {
      console.error("GraphQL Errors:", JSON.stringify(error.response.errors, null, 2));
      console.error("Full GraphQL Response:", JSON.stringify(error.response, null, 2));
    } else {
      console.error("Raw Error:", error.message || error);
    }
    res.status(500).json({ error: "Failed to unlock account or add note" });
  }
});

module.exports = router;
