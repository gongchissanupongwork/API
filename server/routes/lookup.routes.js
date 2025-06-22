// server/routes/lookup.routes.js
const express = require("express");
const router = express.Router();
const { request } = require("graphql-request");
const { GET_INCIDENT_BY_ID, USERS_QUERY } = require("../graphql/queries");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");
const { requireUserEmail } = require("../middleware/authMiddleware");

const headers = { Authorization: `Bearer ${TOKEN}` };

// POST /lookup/incidents
router.post("/lookup/incidents", requireUserEmail, async (req, res) => {
  const { incident_ids } = req.body;
  if (!Array.isArray(incident_ids) || incident_ids.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'incident_ids'" });
  }

  const results = [];
  for (const id of incident_ids) {
    try {
      const data = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });
      if (data?.incident) {
        const { id, alert_name, alert_status, case_result } = data.incident;
        results.push({ id, alert_name, alert_status, case_result });
      } else {
        results.push({ id, error: "Incident not found" });
      }
    } catch (err) {
      results.push({ id, error: "Error fetching incident" });
    }
  }

  res.json({ incidents: results });
});

// POST /lookup/users
router.post("/lookup/users", requireUserEmail, async (req, res) => {
  const { user_emails } = req.body;
  if (!Array.isArray(user_emails) || user_emails.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'user_emails'" });
  }

  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });

    const users = data?.users?.edges?.map((e) => e.node) || [];
    const result = user_emails.map((email) => {
      const found = users.find(
        (u) => u.user_email.toLowerCase() === email.toLowerCase()
      );
      return found
        ? { user_email: found.user_email, account_status: found.account_status }
        : { user_email: email, error: "User not found" };
    });

    res.json({ users: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

module.exports = router;
