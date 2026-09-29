"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Org = { id: string; name: string };
type VerificationStats = {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  expired: number;
};

type Item = {
  id: string;
  careerId: string;
  employeeName: string;
  priorOrganization: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  consentedAt?: string | null;
  respondedAt?: string | null;
  response?: {
    verified: boolean;
    designation?: string | null;
    joinedAt?: string | null;
    leftAt?: string | null;
    notes?: string | null;
  } | null;
};

function OrganizationSetup({ onCreated }: { onCreated: (o: Org) => void }) {
  const [name, setName] = useState("");
  const [cin, setCin] = useState("");
  const [gstin, setGstin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function submit() {
    setMsg("");
    if (!name.trim() || (!cin.trim() && !gstin.trim())) {
      setMsg("Company name and CIN or GSTIN are required.");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/organization", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, cin, gstin }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Unable to create organization");
      return;
    }
    setMsg("Organization created.");
    onCreated(d.organization);
  }

  return (
    <div>
      <div className="field">
        <label>Company name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>CIN</label>
        <input value={cin} onChange={(e) => setCin(e.target.value)} />
      </div>
      <div className="field">
        <label>GSTIN</label>
        <input value={gstin} onChange={(e) => setGstin(e.target.value)} />
      </div>
      {msg && <p className="notice">{msg}</p>}
      <p className="muted">Enter at least one company identifier: CIN or GSTIN.</p>
      <button
        type="button"
        className="btn"
        onClick={submit}
        disabled={busy || !name || (!cin && !gstin)}
      >
        {busy ? "Creating…" : "Create organization"}
      </button>
    </div>
  );
}

export default function Employer() {
  const [careerId, setCareerId] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [prior, setPrior] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [priorId, setPriorId] = useState("");
  const [requests, setRequests] = useState<Item[]>([]);
  const [stats, setStats] = useState<{ sent: VerificationStats; received: VerificationStats } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = () =>
    fetch("/api/verification/sent")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRequests);

  const loadStats = () => {
    setStatsLoading(true);
    return fetch("/api/verification/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .finally(() => setStatsLoading(false));
  };

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setOrgs(d.organizations || []);
        if (d.organizations?.[0]) setOrgId(d.organizations[0].id);
      });
    load();
    loadStats();
  }, []);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function find() {
    setMessage("");
    setPrior([]);
    const r = await fetch(
      "/api/verification/targets?careerId=" + encodeURIComponent(careerId),
    );
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Career ID lookup failed");
      return;
    }
    setPrior(d);
    if (d[0]) setPriorId(d[0].id);
  }

  async function request() {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/verification/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        careerId,
        requestingOrgId: orgId,
        priorOrgId: priorId,
      }),
    });
    const d = await r.json();
    setBusy(false);
    setMessage(
      r.ok
        ? "Verification request created. The employee must provide consent before the prior employer can respond."
        : d.error || "Request failed",
    );
    if (r.ok) {
      load();
      loadStats();
      setCareerId("");
      setPrior([]);
      setPriorId("");
    }
  }

  return (
    <div className="wrap">
      <nav className="nav">
        <Link className="brand" href="/employer">
          Career<span>Verify</span>
        </Link>
        <Link className="btn alt" href="/verify">
          Verify Career ID
        </Link>
        <Link className="btn alt" href="/verification/incoming">
          Incoming
        </Link>
        <button className="btn alt" type="button" onClick={logout} disabled={loggingOut}>
          {loggingOut ? "Signing out…" : "Logout"}
        </button>
      </nav>

      <div className="card">
        <div className="pill">EMPLOYER WORKSPACE</div>
        <h1>Employment verification</h1>
        <p className="muted">
          Create a consent-backed verification request using a Career ID.
        </p>

        {orgs.length ? (
          <>
            <div className="field">
              <label>Requesting organization</label>
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Career ID</label>
              <input
                value={careerId}
                onChange={(e) => setCareerId(e.target.value)}
                placeholder="CV-IND-..."
              />
            </div>

            <button
              className="btn alt"
              type="button"
              onClick={find}
              disabled={!careerId}
            >
              Find prior employers
            </button>

            {prior.length > 0 && (
              <>
                <div className="field">
                  <label>Prior employer</label>
                  <select
                    value={priorId}
                    onChange={(e) => setPriorId(e.target.value)}
                  >
                    {prior.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={request}
                  disabled={busy || !priorId}
                >
                  {busy ? "Creating…" : "Request verification"}
                </button>
              </>
            )}
          </>
        ) : (
          <div className="card">
            <h3>Set up your organization</h3>
            <p className="muted">
              Add your company name and CIN or GSTIN before sending verification requests.
            </p>
            <OrganizationSetup
              onCreated={(o) => {
                setOrgs([o]);
                setOrgId(o.id);
              }}
            />
          </div>
        )}

        {message && <p className="notice">{message}</p>}
      </div>

      <section className="section">
        <div className="card">
          <div className="pill">VERIFICATION OVERVIEW</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginBottom: 6 }}>Verification activity</h2>
              <p className="muted" style={{ margin: 0 }}>All-time statistics for all organizations linked to this employer account.</p>
            </div>
            <button className="btn alt" type="button" onClick={loadStats} disabled={statsLoading}>
              {statsLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {statsLoading && !stats ? (
            <p className="muted" style={{ marginTop: 20 }}>Loading verification statistics…</p>
          ) : stats ? (
            <div style={{ marginTop: 20 }}>
              <div className="grid">
                <div className="card">
                  <div className="pill">REQUESTS RAISED BY US</div>
                  <h2 style={{ margin: "10px 0 4px" }}>{stats.sent.total}</h2>
                  <p className="muted">Total requests sent to previous employers</p>
                  <p><strong>{stats.sent.accepted}</strong> accepted • <strong>{stats.sent.rejected}</strong> rejected</p>
                  <p className="muted">{stats.sent.pending} pending • No automatic expiry</p>
                </div>

                <div className="card">
                  <div className="pill">REQUESTS RECEIVED BY US</div>
                  <h2 style={{ margin: "10px 0 4px" }}>{stats.received.total}</h2>
                  <p className="muted">Total requests received from other employers</p>
                  <p><strong>{stats.received.accepted}</strong> accepted • <strong>{stats.received.rejected}</strong> rejected</p>
                  <p className="muted">{stats.received.pending} pending • No automatic expiry</p>
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3>Detailed breakdown</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 8px" }}>Category</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Total</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Accepted</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Rejected</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Pending</th>
                        
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: "10px 8px" }}>Requests raised by us</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.sent.total}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.sent.accepted}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.sent.rejected}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.sent.pending}</td>
                        
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 8px" }}>Requests received by us</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.received.total}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.received.accepted}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.received.rejected}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px" }}>{stats.received.pending}</td>
                        
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="notice" style={{ marginTop: 20 }}>Verification statistics could not be loaded. Please refresh.</p>
          )}
        </div>
      </section>

      <section className="section">
        <h2>Sent verification requests</h2>
        {requests.length ? (
          <div className="grid">
            {requests.map((x) => (
              <div className="card" key={x.id}>
                <div className="pill">{x.status}</div>
                <h3>{x.employeeName}</h3>
                <p>
                  Career ID: <strong>{x.careerId}</strong>
                </p>
                <p>Previous employer: {x.priorOrganization}</p>
                <p className="muted">
                  Requested {new Date(x.createdAt).toLocaleDateString()}
                </p>
                {x.status === "PENDING" ? (
                  <p className="muted">
                    {x.consentedAt
                      ? "Employee consent received; awaiting prior employer."
                      : "Awaiting employee consent."}
                  </p>
                ) : x.response ? (
                  <p>
                    <strong>
                      {x.response.verified
                        ? "Verification confirmed"
                        : "Verification rejected"}
                    </strong>
                    {x.response.designation ? " • " + x.response.designation : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <h3>No requests yet</h3>
            <p className="muted">
              Your verification requests and results will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
