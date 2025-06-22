import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function parseCSV(input) {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function CaseForm() {
  const [loginEmail, setLoginEmail] = useState("");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("user_email") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!userEmail);

  const [incidentInput, setIncidentInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [alertStatus, setAlertStatus] = useState("ไม่เปลี่ยนแปลง");
  const [caseResult, setCaseResult] = useState("ไม่เปลี่ยนแปลง");
  const [reason, setReason] = useState("");

  const [mappedIncidents, setMappedIncidents] = useState([]);
  const [mappedUsers, setMappedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  function handleLogout() {
    localStorage.removeItem("user_email");
    setUserEmail("");
    setIsLoggedIn(false);
    toast.info("Logged out successfully");
  }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-8 font-sans">
      {!isLoggedIn ? (
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl space-y-6">
          <h2 className="text-4xl font-extrabold text-center text-gray-900">🔐 Login</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-5 py-3 border border-gray-300 rounded-xl text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-400"
              required
            />
            <button
              type="submit"
              className="w-full bg-primary hover:bg-blue-800 text-white py-3 rounded-xl text-lg font-semibold transition"
            >
              Login
            </button>
          </form>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-gray-800">🛠️ Incident Management</h2>
            <button
              onClick={handleLogout}
              className="text-red-500 hover:underline"
            >
              Logout
            </button>
          </div>

          <section>
            <label className="block mb-1 font-semibold">Incident IDs</label>
            <input
              type="text"
              value={incidentInput}
              onChange={(e) => setIncidentInput(e.target.value)}
              placeholder="comma-separated incident IDs"
              className="w-full px-4 py-2 border rounded-lg mb-2"
            />
            <ul className="space-y-1">
              {mappedIncidents.map((i) => (
                <li key={i.id} className={i.error ? "text-red-600" : "text-green-600"}>
                  {i.error ? `❌ ${i.id}: ${i.error}` : `✅ ${i.id} - ${i.alert_name} (${i.alert_status}, ${i.case_result})`}
                </li>
              ))}
            </ul>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold">Alert Status</label>
              <select
                value={alertStatus}
                onChange={(e) => setAlertStatus(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option>ไม่เปลี่ยนแปลง</option>
                <option>Closed</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold">Case Result</label>
              <select
                value={caseResult}
                onChange={(e) => setCaseResult(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option>ไม่เปลี่ยนแปลง</option>
                <option>WaitingAnalysis</option>
                <option>TruePositives</option>
                <option>FalsePositives</option>
              </select>
            </div>
          </section>

          {caseResult !== "ไม่เปลี่ยนแปลง" && (
            <section>
              <label className="block font-semibold">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for case result change"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </section>
          )}

          <button
            onClick={handleUpdate}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Selected Incidents"}
          </button>

          <hr />

          <section>
            <h3 className="text-xl font-bold mb-2">🔓 Unlock Users</h3>
            <label className="block font-semibold">User Emails</label>
            <input
              type="text"
              value={userEmailInput}
              onChange={(e) => setUserEmailInput(e.target.value)}
              placeholder="comma-separated user emails"
              className="w-full px-4 py-2 border rounded-lg"
            />
            <ul className="mt-2 space-y-1">
              {mappedUsers.map((u) => (
                <li key={u.user_email} className={u.error ? "text-red-600" : "text-green-600"}>
                  {u.error ? `❌ ${u.user_email}: ${u.error}` : `✅ ${u.user_email} - ${u.account_status}`}
                </li>
              ))}
            </ul>
            <button
              onClick={handleUnlockUsers}
              className="w-full bg-green-600 hover:bg-green-700 text-white mt-4 py-2 rounded-lg font-medium"
            >
              Unlock Users
            </button>
          </section>
        </div>
      )}

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}
