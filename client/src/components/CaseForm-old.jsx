// CaseForm.jsx
import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// 💡 BASE URL ควรตั้งจาก .env (สำหรับแยก dev/prod)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function parseCSV(input) {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function CaseForm() {
  // =================== 🔐 LOGIN STATE ===================
  const [loginEmail, setLoginEmail] = useState("");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("user_email") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!userEmail);

  // =================== ⚙️ FORM STATE ===================
  const [incidentInput, setIncidentInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [alertStatus, setAlertStatus] = useState("ไม่เปลี่ยนแปลง");
  const [caseResult, setCaseResult] = useState("ไม่เปลี่ยนแปลง");
  const [reason, setReason] = useState("");

  const [mappedIncidents, setMappedIncidents] = useState([]);
  const [mappedUsers, setMappedUsers] = useState([]);

  const [loading, setLoading] = useState(false);

  // =================== 🔓 LOGOUT ===================
  function handleLogout() {
    localStorage.removeItem("user_email");
    setUserEmail("");
    setIsLoggedIn(false);
    toast.info("Logged out successfully");
  }

  // =================== 🔐 LOGIN ===================
  async function handleLogin(e) {
    e.preventDefault();
    if (!loginEmail.trim()) return toast.error("Enter your email");
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: loginEmail.trim() }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Login failed");

      localStorage.setItem("user_email", loginEmail.trim());
      setUserEmail(loginEmail.trim());
      setIsLoggedIn(true);
      toast.success("Login successful");
    } catch (err) {
      toast.error(err.message);
    }
  }

  // =================== 🔍 INCIDENT LOOKUP ===================
  useEffect(() => {
    if (!isLoggedIn) return;
    const ids = parseCSV(incidentInput);
    if (ids.length === 0) return setMappedIncidents([]);

    setLoading(true);
    fetch(`${API_BASE_URL}/lookup/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incident_ids: ids }),
    })
      .then((res) => res.json())
      .then((data) => setMappedIncidents(data.incidents || []))
      .catch(() => toast.error("Incident lookup failed"))
      .finally(() => setLoading(false));
  }, [incidentInput, userEmail]);

  // =================== 🔍 USER LOOKUP ===================
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
      .then((data) => setMappedUsers(data.users || []))
      .catch(() => toast.error("User lookup failed"));
  }, [userEmailInput, userEmail]);

  // =================== 🔄 UPDATE ALERT ===================
  async function updateAlertStatusBatch() {
    const payload = mappedIncidents
      .filter((inc) => !inc.error)
      .map(({ id }) => ({ id, alert_status: alertStatus }));

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

  // =================== 🔄 UPDATE CASE RESULT ===================
  async function updateCaseResultBatch() {
    const payload = mappedIncidents
      .filter((inc) => !inc.error)
      .map(({ id }) => ({ id, case_result: caseResult, reason }));

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

  // =================== 🧠 MAIN UPDATE HANDLER ===================
  async function handleUpdate() {
    const valid = mappedIncidents.filter((i) => !i.error);
    if (valid.length === 0) return toast.error("No valid incidents");
    if (alertStatus === "ไม่เปลี่ยนแปลง" && caseResult === "ไม่เปลี่ยนแปลง") {
      return toast.info("Nothing selected to update");
    }
    if (caseResult !== "ไม่เปลี่ยนแปลง" && reason.trim() === "") {
      return toast.error("Reason required for case result");
    }

    try {
      setLoading(true);
      const [aRes, cRes] = await Promise.all([
        alertStatus !== "ไม่เปลี่ยนแปลง" ? updateAlertStatusBatch() : { results: [] },
        caseResult !== "ไม่เปลี่ยนแปลง" ? updateCaseResultBatch() : { results: [] },
      ]);

      [...aRes.results, ...cRes.results].forEach((r) => {
        if (r.error) toast.error(`❌ ${r.id}: ${r.error}`);
        else toast.success(`✅ ${r.id} updated`);
      });
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // =================== 🔓 UNLOCK USERS ===================
  async function handleUnlockUsers() {
    const valid = mappedUsers.filter((u) => !u.error);
    if (valid.length === 0) return toast.error("No valid users");

    try {
      const res = await fetch(`${API_BASE_URL}/accounts/unlock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          user_email: userEmail,
        },
        body: JSON.stringify({ users: valid }),
      });
      const data = await res.json();

      data.results.forEach((r) => {
        if (r.error) toast.error(`❌ ${r.user_email}: ${r.error}`);
        else toast.success(`✅ Unlocked ${r.user_email}`);
      });
    } catch (err) {
      toast.error("Unlock failed: " + err.message);
    }
  }

  // =================== 🧩 RENDERING ===================
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto mt-10 p-4 border rounded-xl shadow">
        <h2 className="text-xl font-bold mb-2">🔐 Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full p-2 border rounded"
            required
          />
          <button type="submit" className="w-full mt-4 bg-blue-600 text-white py-2 rounded">
            Login
          </button>
        </form>
        <ToastContainer position="top-center" autoClose={3000} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">🛠️ Manage Incidents</h2>
        <button onClick={handleLogout} className="text-sm underline text-red-500">
          Logout
        </button>
      </div>

      <div>
        <label>Incident IDs (comma separated)</label>
        <input
          type="text"
          value={incidentInput}
          onChange={(e) => setIncidentInput(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <div className="mt-2 space-y-1">
          {mappedIncidents.map((i) => (
            <div key={i.id} className={i.error ? "text-red-600" : "text-green-600"}>
              {i.error ? `❌ ${i.id}: ${i.error}` : `✅ ${i.id} - ${i.alert_name} (${i.alert_status}, ${i.case_result})`}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>Alert Status</label>
          <select value={alertStatus} onChange={(e) => setAlertStatus(e.target.value)} className="w-full p-2 border rounded">
            <option>ไม่เปลี่ยนแปลง</option>
            <option>Closed</option>
          </select>
        </div>

        <div>
          <label>Case Result</label>
          <select value={caseResult} onChange={(e) => setCaseResult(e.target.value)} className="w-full p-2 border rounded">
            <option>ไม่เปลี่ยนแปลง</option>
            <option>WaitingAnalysis</option>
            <option>TruePositives</option>
            <option>FalsePositives</option>
          </select>
        </div>
      </div>

      {caseResult !== "ไม่เปลี่ยนแปลง" && (
        <div>
          <label>Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
      )}

      <button
        onClick={handleUpdate}
        disabled={loading}
        className="bg-blue-600 text-white w-full py-2 rounded disabled:opacity-50"
      >
        {loading ? "Updating..." : "Update Selected Incidents"}
      </button>

      <hr className="my-6" />

      <div>
        <h2 className="text-xl font-bold">🔓 Unlock Users</h2>
        <label>User Emails (comma separated)</label>
        <input
          type="text"
          value={userEmailInput}
          onChange={(e) => setUserEmailInput(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <div className="mt-2 space-y-1">
          {mappedUsers.map((u) => (
            <div key={u.user_email} className={u.error ? "text-red-600" : "text-green-600"}>
              {u.error ? `❌ ${u.user_email}: ${u.error}` : `✅ ${u.user_email} - ${u.account_status}`}
            </div>
          ))}
        </div>

        <button
          onClick={handleUnlockUsers}
          className="bg-green-600 text-white w-full mt-4 py-2 rounded"
        >
          Unlock Users
        </button>
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}
