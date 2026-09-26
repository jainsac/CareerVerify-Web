"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Org = { id: string; name: string };
type Me = { organizations?: Org[] };

export default function HRMS() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [message, setMessage] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#17324d");
  const [secondaryColor, setSecondaryColor] = useState("#ffffff");
  const [tagline, setTagline] = useState("");

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then((d: Me) => {
      setOrgs(d.organizations || []);
      if (d.organizations?.[0]) setOrgId(d.organizations[0].id);
    });
  }, []);

  async function saveBranding() {
    if (!orgId) return;
    const r = await fetch("/api/hrms/branding", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, logoUrl, primaryColor, secondaryColor, tagline })
    });
    const d = await r.json();
    setMessage(r.ok ? "Company branding saved." : d.error || "Unable to save branding.");
  }

  const cards = [
    ["Employees", "Employee master, onboarding, transfers and exits.", "/hrms/employees"],
    ["Resignations", "Review, accept or reject employee resignation requests.", "/hrms/resignations"],
    ["Attendance", "Attendance workspace ready for future device/API integrations.", "#"],
    ["Leave", "Leave policies, requests and approvals.", "#"],
    ["Payroll", "Salary structure and payroll module foundation.", "#"],
    ["Documents", "Company documents, employee documents and experience letters.", "#"],
    ["Integrations", "Connect APIs, HRMS systems, imports and webhooks.", "#"],
  ];

  return <div className="wrap">
    <nav className="nav">
      <Link className="brand" href="/employer">Career<span>Verify</span></Link>
      <Link className="btn alt" href="/candidate">Career Profile</Link>
      <Link className="btn alt" href="/verify">Verification</Link>
      <Link className="btn alt" href="/hrms/employees">Employees</Link>
    </nav>
    <div className="card">
      <div className="pill">COMPANY HRMS</div>
      <h1>HR workspace</h1>
      <p className="muted">Your company HRMS lives here, while each employee keeps a separate permanent CareerVerify identity.</p>
      {orgs.length > 0 && <div className="field"><label>Company</label><select value={orgId} onChange={e => setOrgId(e.target.value)}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
      {message && <p className="notice">{message}</p>}
    </div>
    <section className="section">
      <div className="grid">{cards.map(([title, desc, href]) =>
        <Link className="card" key={title} href={href}>
          <h3>{title}</h3><p className="muted">{desc}</p><span className="pill">MODULE</span>
        </Link>
      )}</div>
    </section>
    <section className="section">
      <div className="card">
        <div className="pill">COMPANY BRANDING</div>
        <h2>Customize your HRMS</h2>
        <div className="field"><label>Logo URL</label><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
        <div className="field"><label>Primary color</label><input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} /></div>
        <div className="field"><label>Secondary color</label><input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} /></div>
        <div className="field"><label>Tagline</label><input value={tagline} onChange={e => setTagline(e.target.value)} /></div>
        <button className="btn" onClick={saveBranding} disabled={!orgId}>Save branding</button>
      </div>
    </section>
    <section className="section">
      <div className="card">
        <div className="pill">INTEGRATION CENTER</div>
        <h2>Connect any HRMS</h2>
        <p className="muted">Use API integration when supported, or Excel/CSV migration when an existing HRMS has no API. Internal/private HRMS systems can use a secure connector without exposing their server publicly.</p>
        <div className="grid">
          <div><h3>API & Webhooks</h3><p className="muted">Versioned APIs, scoped keys and event delivery.</p></div>
          <div><h3>Bulk Import</h3><p className="muted">Preview, validate, map and migrate employee data.</p></div>
          <div><h3>Migration</h3><p className="muted">Move employee master and employment history from another HRMS.</p></div>
        </div>
      </div>
    </section>
  </div>;
}
