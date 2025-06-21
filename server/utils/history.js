const fs = require("fs");
const path = require("path");

const HISTORY_FILE_PATH = path.join(__dirname, "../data/history.json");

const normalizeIP = (ip) => {
  if (!ip) return "unknown";
  return ip === "::1" ? "127.0.0.1" : ip;
};

/**
 * ฟังก์ชันเพิ่ม log ประวัติลงในไฟล์ history.json
 * @param {string} action - ชื่อ action เช่น "updateAlertStatus", "addNote" เป็นต้น
 * @param {Array} entries - ข้อมูลเคส หรือโน้ตที่ต้องการบันทึก
 * @param {Object} context - ข้อมูลผู้ใช้ เช่น { user_email, name, id, user_agent, ip_address }
 */

const appendHistory = (action, entries, context = {}) => {
  let history = [];

  try {
    if (fs.existsSync(HISTORY_FILE_PATH)) {
      const raw = fs.readFileSync(HISTORY_FILE_PATH, "utf-8");
      try {
        history = raw ? JSON.parse(raw) : [];
      } catch (parseErr) {
        console.error("❌ Error parsing history.json:", parseErr.message);
        history = [];
      }
    }
  } catch (err) {
    console.error("❌ Error reading history file:", err.message);
  }

  const {
    user_email = "unknown",
    name = "unknown",
    id = "unknown",
    user_agent = "unknown",
    ip_address = "unknown",
  } = context;

  const newEntries = entries.map((entry) => ({
    authentication: {
      user_email,
      name,
      id,
    },
    user_agent,
    ip_address: normalizeIP(ip_address),
    action,
    case: entry,
    timestamp: new Date().toISOString(), // 🕒 เพิ่มเวลา
  }));

  history.push(...newEntries);

  try {
    fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(history, null, 2));
    console.log("✅ History updated");
  } catch (err) {
    console.error("❌ Error writing history file:", err.message);
  }
};

module.exports = { appendHistory };
