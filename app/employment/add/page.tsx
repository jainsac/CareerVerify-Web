"use client";
import Link from "next/link";
import { useState } from "react";

type Organization = { id: string; name: string; cin?: string | null; gstin?: string | null };

export default function AddExperiencePage() {
  const [query, setQuery] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [leftAt, setLeftAt] = useState("");
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function searchOrganizations() {
    setMessage("");
    setOrganizationId("");
    if (query.trim().length < 2) {
      setMessage("Enter at least 2 characters of the employer name, CIN or GSTIN.");
      return;
    }
    const r = await fetch("/api/organization/search?q=" + encodeURIComponent(query.trim()));
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Unable to search employers.");
      return;
    }
    setOrganizations(d);
    if (!d.length) setMessage("No platform-verified employer found. The employer must be registered and verified on CareerVerify first.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!organizationId || !designation || !joinedAt || !leftAt) {
      setMessage("Employer, designation, joining date and leaving date are required.");
      return;
    }

    setBusy(true);
    const r = await fetch("/api/employment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId,
        designation,
        department,
        employeeCode,
        employmentType,
        joinedAt,
        leftAt,
        remarks,
      }),
    });
    const d = await r.json();
    setBusy(false);

    if (!r.ok) {
      setMessage(d.error || "Unable to add experience.");
      return;
    }

    window.location.href = "/candidate";
  }

  return (
    <div className="wrap">
      <nav className="nav">
        <Link className="brand" href="/candidate">Career<span>Verify</span></Link>
        <div className="links">
          <Link className="btn alt" href="/candidate">Dashboard</Link>
          <Link className="btn alt" href="/disputes">Disputes</Link>
        </div>
      </nav>

      <form className="form card" onSubmit={submit}>
        <div className="pill">PAST EXPERIENCE</div>
        <h1>Add past experience</h1>
        <p className="muted">
          Add an employment record that is missing from your Career Profile. Self-added records remain unverified until the employer confirms them.
        </p>

        <div className="field">
          <label>Previous employer</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input style={{flex:"1 1 220px"}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search company name, CIN or GSTIN" />
            <button className="btn alt" type="button" onClick={searchOrganizations}>Search</button>
          </div>
        </div>

        {organizations.length > 0 && (
          <div className="field">
            <label>Verified employer</label>
            <select value={organizationId} onChange={e=>setOrganizationId(e.target.value)} required>
              <option value="">Select employer</option>
              {organizations.map(o=>(
                <option key={o.id} value={o.id}>{o.name}{o.cin ? " • CIN " + o.cin : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field"><label>Designation</label><input value={designation} onChange={e=>setDesignation(e.target.value)} required placeholder="e.g. Senior Executive" /></div>
        <div className="field"><label>Department</label><input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="e.g. Finance" /></div>
        <div className="field"><label>Company Employee ID</label><input value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)} placeholder="Optional" /></div>
        <div className="field"><label>Employment type</label><input value={employmentType} onChange={e=>setEmploymentType(e.target.value)} placeholder="e.g. Full-time" /></div>
        <div className="field"><label>Joining date</label><input type="date" value={joinedAt} onChange={e=>setJoinedAt(e.target.value)} required /></div>
        <div className="field"><label>Leaving date</label><input type="date" value={leftAt} onChange={e=>setLeftAt(e.target.value)} required /></div>
        <div className="field"><label>Additional details</label><textarea value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Optional factual details about this employment" /></div>

        {message && <p className="notice">{message}</p>}
        <button className="btn" disabled={busy}>{busy ? "Adding…" : "Add experience"}</button>
      </form>
    </div>
  );
}
