const { request, gql } = require("graphql-request");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");

// GraphQL query สำหรับดึงรายชื่อผู้ใช้ทั้งหมด
const USERS_QUERY = gql`
  query {
    users {
      edges {
        node {
          id
          name
          user_email
          account_status
        }
      }
    }
  }
`;

// ✅ Optional: normalize IP like ::1 => 127.0.0.1
const normalizeIP = (ip) => {
  if (!ip) return "unknown";
  return ip === "::1" ? "127.0.0.1" : ip;
};

/**
 * Middleware ตรวจสอบ user_email จาก header ว่ามีในระบบหรือไม่
 */
const requireUserEmail = async (req, res, next) => {
  const user_email = req.headers.user_email;

  if (!user_email || typeof user_email !== "string") {
    return res
      .status(401)
      .json({ error: "Missing or invalid user_email in header" });
  }

  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      requestHeaders: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!data?.users?.edges) {
      console.warn("⚠️ GraphQL returned no user edges");
    }

    const users = data?.users?.edges?.map((edge) => edge.node) || [];

    const matchedUser = users.find(
      (user) =>
        typeof user.user_email === "string" &&
        user.user_email.toLowerCase() === user_email.toLowerCase()
    );

    if (!matchedUser) {
      return res.status(403).json({ error: "Unauthorized user_email" });
    }

    const ipAddress =
      (req.headers["x-forwarded-for"] || "")
        .split(",")
        .map((ip) => ip.trim())
        .find((ip) => ip.length > 0) ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      "unknown";

    req.user = {
      user_email: matchedUser.user_email,
      name: matchedUser.name,
      id: matchedUser.id,
      user_agent: req.headers["user-agent"] || "unknown",
      ip_address: normalizeIP(ipAddress),
    };

    console.log(`✅ Authenticated: ${matchedUser.user_email}`);
    next();
  } catch (err) {
    console.error("❌ Authentication error:", err.message);
    res.status(500).json({ error: "Failed to authenticate user_email" });
  }
};

module.exports = { requireUserEmail };
