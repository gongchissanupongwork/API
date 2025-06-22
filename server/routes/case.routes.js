const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { request } = require("graphql-request");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");
const { GET_INCIDENTS, GET_INCIDENT_BY_ID } = require("../graphql/queries");
const {
  INCIDENT_EDIT_MUTATION,
  NOTE_ADD_MUTATION,
} = require("../graphql/mutation.js");
const { appendHistory } = require("../utils/history");
const { requireUserEmail } = require("../middleware/authMiddleware");

const VALID_RESULTS = ["WaitingAnalysis", "TruePositives", "FalsePositives"];
const HISTORY_FILE_PATH = path.join(__dirname, "../data/history.json");
const headers = { Authorization: `Bearer ${TOKEN}` };

// ===================
// GET: รายชื่อเคสทั้งหมด
// ===================
// router.get("/incidents", requireUserEmail, async (req, res) => {
//   const headers = { Authorization: `Bearer ${TOKEN}` };
//   try {
//     const data = await request({
//       url: GRAPHQL_ENDPOINT,
//       document: GET_INCIDENTS,
//       variables: {},
//       requestHeaders: headers,
//     });
//     res.json(data);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch INCIDENTS" });
//   }
// });

// ===================
// PUT: ดึง incident ตาม ID
// ===================
// router.put("/incident", requireUserEmail, async (req, res) => {
//   const { id } = req.body;
//   if (!id || typeof id !== "string" || id.trim() === "") {
//     return res
//       .status(400)
//       .json({ error: "Invalid or missing 'id' in request body" });
//   }

//   const headers = { Authorization: `Bearer ${TOKEN}` };
//   try {
//     const data = await request({
//       url: GRAPHQL_ENDPOINT,
//       document: GET_INCIDENT_BY_ID,
//       variables: { id },
//       requestHeaders: headers,
//     });
//     res.json(data);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch incident by ID" });
//   }
// });

// ==========================
// PUT /closedAlertStatus
// ==========================
router.put("/closedAlertStatus", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  // รองรับ single object
  if (!Array.isArray(incidents)) {
    const { id, alert_status } = req.body;
    if (id && alert_status) {
      incidents = [{ id, alert_status }];
    } else {
      return res.status(400).json({ error: "Missing 'id' or 'alert_status'" });
    }
  }

  if (incidents.length === 0) {
    return res.status(400).json({ error: "No incident data provided" });
  }

  const results = [];

  for (const { id, alert_status } of incidents) {
    if (!id || typeof id !== "string" || alert_status !== "Closed") {
      results.push({ id, error: "Invalid id or alert_status" });
      continue;
    }

    try {
      const existingIncidentData = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });

      const oldStatus = existingIncidentData.incident?.alert_status || "unknown";
      const name = existingIncidentData.incident?.alert_name || "unknown";

      const updateVars = {
        id,
        input: [{ key: "alert_status", value: ["Closed"], operation: "replace" }],
      };

      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: updateVars,
        requestHeaders: headers,
      });

      appendHistory(
        "updateAlertStatus",
        [
          {
            id,
            name,
            status_before: oldStatus,
            status_after: updateResponse.incidentEdit.fieldPatch.alert_status,
          },
        ],
        req.user
      );

      const noteVars = {
        input: {
          action: "Closed",
          content: "Incident was Closed",
          objects: id,
        },
      };

      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: noteVars,
        requestHeaders: headers,
      });

      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      results.push({
        id,
        updated: true,
        alert_status: updateResponse.incidentEdit.fieldPatch.alert_status,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ Failed for incident ID: ${id}`, err);
      results.push({ id, error: "Failed to update" });
    }
  }

  res.json({ results });
});

// ==========================
// PUT /updateCaseResult
// ==========================
router.put("/updateCaseResult", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  // รองรับ single object
  if (!Array.isArray(incidents)) {
    const { id, case_result, reason } = req.body;
    if (id && case_result && reason) {
      incidents = [{ id, case_result, reason }];
    } else {
      return res.status(400).json({ error: "Missing 'id', 'case_result' or 'reason'" });
    }
  }

  if (incidents.length === 0) {
    return res.status(400).json({ error: "No incident data provided" });
  }

  const results = [];

  for (const { id, case_result, reason } of incidents) {
    if (!id || typeof id !== "string") {
      results.push({ id, error: "Invalid or missing 'id'" });
      continue;
    }

    if (!VALID_RESULTS.includes(case_result)) {
      results.push({ id, error: "Invalid 'case_result'" });
      continue;
    }

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      results.push({ id, error: "Missing or invalid 'reason'" });
      continue;
    }

    try {
      const existingIncidentData = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });

      const oldResult = existingIncidentData.incident?.case_result || "unknown";
      const name = existingIncidentData.incident?.alert_name || "unknown";

      const updateVars = {
        id,
        input: [{ key: "case_result", value: [case_result], operation: "replace" }],
      };

      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: updateVars,
        requestHeaders: headers,
      });

      appendHistory(
        "updateCaseResult",
        [
          {
            id,
            name,
            result_before: oldResult,
            result_after: updateResponse.incidentEdit.fieldPatch.case_result,
            reason,
          },
        ],
        req.user
      );

      const noteVars = {
        input: {
          action: "Re-Investigated",
          content: reason,
          objects: id,
        },
      };

      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: noteVars,
        requestHeaders: headers,
      });

      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      results.push({
        id,
        updated: true,
        case_result: updateResponse.incidentEdit.fieldPatch.case_result,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ Failed for incident ID: ${id}`, err);
      results.push({ id, error: "Failed to update" });
    }
  }

  res.json({ results });
});

// ===================
// GET: ประวัติทั้งหมด (อ่านจาก history.json)
// ===================
const fsPromises = require("fs").promises;

router.get("/history", requireUserEmail, async (req, res) => {
  try {
    await fsPromises.access(HISTORY_FILE_PATH); // เช็คไฟล์ว่ามีไหม
    const fileContent = await fsPromises.readFile(HISTORY_FILE_PATH, "utf-8");
    res.setHeader("Content-Type", "application/json");
    if (fileContent) {
      try {
        const parsed = JSON.parse(fileContent);
        res.json(parsed);
      } catch (parseErr) {
        console.error("Error parsing history JSON:", parseErr);
        res.status(500).json({ error: "Invalid history file format" });
      }
    } else {
      res.json([]);
    }
  } catch {
    // ไฟล์ไม่มีหรืออ่านไม่ได้
    res.setHeader("Content-Type", "application/json");
    res.json([]);
  }
});


module.exports = router;
