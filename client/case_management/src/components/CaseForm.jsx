import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";

// ดึง URL backend API จาก .env (Vite ต้องตั้ง VITE_API_BASE_URL)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// ฟังก์ชันช่วยแปลง string ที่คั่นด้วย comma เป็น array (ลบช่องว่างและค่าว่างออก)
function parseCSV(input) {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function CaseForm() {
  // === State สำหรับ login และจัดเก็บ user_email หลัง login สำเร็จ ===
  const [loginEmail, setLoginEmail] = useState("");
  const [userEmail, setUserEmail] = useState(
    localStorage.getItem("user_email") || ""
  );
  const [isLoggedIn, setIsLoggedIn] = useState(!!userEmail);

  // === State สำหรับจัดการข้อมูล Incident/User/Update Form ===
  const [incidentInput, setIncidentInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [alertStatus, setAlertStatus] = useState("ไม่เปลี่ยนแปลง");
  const [caseResult, setCaseResult] = useState("ไม่เปลี่ยนแปลง");
  const [reason, setReason] = useState("");

  // ข้อมูล Incident และ User ที่ดึงมาจาก server
  const [mappedIncidents, setMappedIncidents] = useState([]);
  const [mappedUsers, setMappedUsers] = useState([]);

  // ==================== ฟังก์ชันจัดการ Login ====================
  async function handleLogin(e) {
    e.preventDefault();

    if (!loginEmail.trim()) {
      toast.error("Please enter your email to login");
      return;
    }

    try {
      // เรียก API POST /login ที่ backend เพื่อเช็ค user_email
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: loginEmail.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Login failed");
      }

      // ถ้าสำเร็จบันทึก user_email ไว้ localStorage และอัปเดตสถานะ
      setUserEmail(loginEmail.trim());
      localStorage.setItem("user_email", loginEmail.trim());
      setIsLoggedIn(true);
      toast.success("Login successful");
    } catch (err) {
      toast.error(`Login error: ${err.message}`);
    }
  }

  // ==================== ดึงข้อมูล Incident ====================
  useEffect(() => {
    if (!isLoggedIn) return; // ถ้ายังไม่ login ไม่ต้องเรียก API

    const ids = parseCSV(incidentInput);
    if (ids.length === 0) return setMappedIncidents([]);

    fetch(`${API_BASE_URL}/lookup/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incident_ids: ids }),
    })
      .then((res) => res.json())
      .then((data) => setMappedIncidents(data.results || []))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to lookup incident data");
      });
  }, [incidentInput, isLoggedIn, userEmail]);

  // ==================== ดึงข้อมูล User ====================
  useEffect(() => {
    if (!isLoggedIn) return;

    const emails = parseCSV(userEmailInput);
    if (emails.length === 0) return setMappedUsers([]);

    fetch(`${API_BASE_URL}/lookup/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ user_emails: emails }),
    })
      .then((res) => res.json())
      .then((data) => setMappedUsers(data.results || []))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to lookup user data");
      });
  }, [userEmailInput, isLoggedIn, userEmail]);

  // ==================== อัปเดต Alert Status ====================
  async function updateAlertStatusBatch(incidents) {
    if (incidents.length === 0) return { results: [] };

    const payload = incidents.map(({ id }) => ({ id, alert_status: alertStatus }));

    const res = await fetch(`${API_BASE_URL}/closedAlertStatus`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incidents: payload }),
    });

    return res.json();
  }

  // ==================== อัปเดต Case Result ====================
  async function updateCaseResultBatch(incidents) {
    if (incidents.length === 0) return { results: [] };

    const payload = incidents.map(({ id }) => ({
      id,
      case_result: caseResult,
      reason,
    }));

    const res = await fetch(`${API_BASE_URL}/updateCaseResult`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incidents: payload }),
    });

    return res.json();
  }

  // ==================== ฟังก์ชันจัดการกดปุ่มอัปเดต ====================
  async function handleUpdate() {
    const validIncidents = mappedIncidents.filter((inc) => !inc.error);
    if (validIncidents.length === 0) {
      toast.error("No valid incidents to update");
      return;
    }

    if (alertStatus === "ไม่เปลี่ยนแปลง" && caseResult === "ไม่เปลี่ยนแปลง") {
      toast.info("Select at least one field to update");
      return;
    }

    if (caseResult !== "ไม่เปลี่ยนแปลง" && reason.trim() === "") {
      toast.error("Reason is required when changing case result");
      return;
    }

    try {
      let alertResult = { results: [] };
      let caseResultResult = { results: [] };

      if (alertStatus !== "ไม่เปลี่ยนแปลง") {
        alertResult = await updateAlertStatusBatch(validIncidents);
      }
      if (caseResult !== "ไม่เปลี่ยนแปลง") {
        caseResultResult = await updateCaseResultBatch(validIncidents);
      }

      [...alertResult.results, ...caseResultResult.results].forEach((r) => {
        if (r.error) toast.error(`ID: ${r.id} - ${r.error}`);
        else toast.success(`ID: ${r.id} updated successfully`);
      });
    } catch (e) {
      toast.error("Update failed: " + e.message);
    }
  }

  // ==================== ปลดล็อกผู้ใช้ ====================
  async function handleUnlockUsers() {
    const validUsers = mappedUsers.filter((u) => !u.error);
    if (validUsers.length === 0) {
      toast.error("No valid users to unlock");
      return;
    }

    try {
      const payload = validUsers.map(({ user_email }) => ({ user_email }));

      const res = await fetch(`${API_BASE_URL}/accounts/unlock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          user_email: userEmail,
        },
        body: JSON.stringify({ users: payload }),
      });

      const data = await res.json();

      data.results.forEach((r) => {
        if (r.error) toast.error(`Unlock user ${r.user_email} failed: ${r.error}`);
        else toast.success(`User unlocked: ${r.user_email}`);
      });
    } catch (e) {
      toast.error("Unlock failed: " + e.message);
    }
  }

  // ==================== UI Rendering ====================

  // ถ้ายังไม่ login ให้แสดงฟอร์ม login ก่อน
  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: 400, margin: "auto", padding: 16 }}>
        <h2>🔐 Login</h2>
        <form onSubmit={handleLogin}>
          <label>Your Email:</label>
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="your.email@example.com"
            style={{ width: "100%", padding: 8, fontSize: 16, marginTop: 4 }}
            required
          />
          <button
            type="submit"
            style={{ marginTop: 16, padding: "12px 20px", fontSize: 18 }}
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  // ถ้า login แล้วแสดงฟอร์มจัดการ Incident และ User
  return (
    <div style={{ maxWidth: 700, margin: "auto", padding: 16 }}>
      <h2>🛠️ Manage Incidents</h2>

      <label>Incident IDs (comma separated):</label>
      <input
        type="text"
        value={incidentInput}
        onChange={(e) => setIncidentInput(e.target.value)}
        placeholder="incident-001, incident-002"
        style={{ width: "100%", padding: 8, fontSize: 16 }}
      />
      <div>
        {mappedIncidents.map((inc) =>
          inc.error ? (
            <div key={inc.id} style={{ color: "red" }}>
              ❌ {inc.id}: {inc.error}
            </div>
          ) : (
            <div key={inc.id} style={{ color: "green" }}>
              ✔️ {inc.id} - {inc.alert_name} ({inc.alert_status}, {inc.case_result})
            </div>
          )
        )}
      </div>

      <label style={{ marginTop: 12 }}>Alert Status:</label>
      <select
        value={alertStatus}
        onChange={(e) => setAlertStatus(e.target.value)}
        style={{ width: "100%", padding: 8, fontSize: 16 }}
      >
        <option>ไม่เปลี่ยนแปลง</option>
        <option>Closed</option>
      </select>

      <label style={{ marginTop: 12 }}>Case Result:</label>
      <select
        value={caseResult}
        onChange={(e) => setCaseResult(e.target.value)}
        style={{ width: "100%", padding: 8, fontSize: 16 }}
      >
        <option>ไม่เปลี่ยนแปลง</option>
        <option>WaitingAnalysis</option>
        <option>TruePositives</option>
        <option>FalsePositives</option>
      </select>

      {caseResult !== "ไม่เปลี่ยนแปลง" && (
        <>
          <label style={{ marginTop: 12 }}>
            Reason (required if changing case result):
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason"
            style={{ width: "100%", padding: 8, fontSize: 16 }}
          />
        </>
      )}

      <button
        onClick={handleUpdate}
        style={{ marginTop: 16, padding: "12px 20px", fontSize: 18 }}
      >
        Update Alert Status & Case Result
      </button>

      <hr style={{ margin: "40px 0" }} />

      <h2>🔓 Unlock User Account</h2>

      <label>User Emails to Unlock (comma separated):</label>
      <input
        type="text"
        value={userEmailInput}
        onChange={(e) => setUserEmailInput(e.target.value)}
        placeholder="user1@example.com, user2@example.com"
        style={{ width: "100%", padding: 8, fontSize: 16 }}
      />
      <div>
        {mappedUsers.map((user) =>
          user.error ? (
            <div key={user.user_email} style={{ color: "red" }}>
              ❌ {user.user_email}: {user.error}
            </div>
          ) : (
            <div key={user.user_email} style={{ color: "green" }}>
              ✔️ {user.user_email} - {user.name} ({user.account_status})
            </div>
          )
        )}
      </div>

      <button
        onClick={handleUnlockUsers}
        style={{ marginTop: 12, padding: "12px 20px", fontSize: 18 }}
      >
        Unlock Users
      </button>
    </div>
  );
}
