"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Org = { id: string; name: string };
type Row = {
  id: string;
  designation: string;
  department?: string | null;
  resignationStatus: string;
  resignationSubmittedAt?: string | null;
  resignationReason?: string | null;
  resignationNoticeDate?: string | null;
  careerProfile: { user: { name: string; email: string } };
};

export default function Resignations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load(id: string) {
    if (!id) return;
    const r = await fetch("/api/hrms/resignations?organizationId=" + encodeURIComponent(id));
    const d = await r.json();
    setRows(r.ok ? d : []);
    if (!r.ok) setMessage(d.error || "Unable to load.");
  }

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      const list = d.organizations || [];
      setOrgs(list);
      if (list[0]) { setOrgId(list[0].id); load(list[0].id); }
    });
  }, []);

  async function act(id: string, action: "ACCEPT" | "REJECT") {
    const reason = window.prompt(action === "REJECT" ? "Reason for rejection:" : "Optional note:");
    if (action === "REJECT" && !reason?.trim()) return;
    setBusy(id);
    const r = await fetch("/api/hrms/resignations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, employmentId: id, action, reason: reason || "" })
    });
    const d = await r.json();
    setBusy("");
    setMessage(r.ok ? "Resignation updated." : d.error || "Action failed.");
    if (r.ok) load(orgId);
  }

  return <div className="wrap">
    <nav className="nav">
      <Link className="brand" href="/hrms">Career<span>Verify</span></Link>
      <Link className="btn alt" href="/hrms/employees">Employees</Link>
    </nav>
    <div className="card">
      <div className="pill">HRMS</div>
      <h1>Resignation management</h1>
      <p className="muted">Review employee resignation requests without changing the permanent Career ID.</p>
      {orgs.length > 1 && <div className="field"><label>Company</label><select value={orgId} onChange={e => { setOrgId(e.target.value); load(e.target.value); }}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
      {message && <p className="notice">{message}</p>}
    </div>
    <section className="section">
      {rows.length ? <div className="grid">{rows.map(x => <div className="card" key={x.id}>
        <div className="pill">{x.resignationStatus}</div>
        <h3>{x.careerProfile.user.name}</h3>
        <p>{x.careerProfile.user.email}</p>
        <p>{x.designation}{x.department ? " • " + x.department : ""}</p>
        {x.resignationSubmittedAt && <p className="muted">Submitted {new Date(x.resignationSubmittedAt).toLocaleDateString()}</p>}
        {x.resignationNoticeDate && <p>Requested exit date: <strong>{new Date(x.resignationNoticeDate).toLocaleDateString()}</strong></p>}
        {x.resignationReason && <p>Reason: {x.resignationReason}</p>}
        {x.resignationStatus === "SUBMITTED" && <div className="actions">
          <button className="btn" disabled={busy === x.id} onClick={() => act(x.id, "ACCEPT")}>Accept</button>
          <button className="btn alt" disabled={busy === x.id} onClick={() => act(x.id, "REJECT")}>Reject</button>
        </div>}
      </div>)}</div> : <div className="card"><h3>No resignation requests</h3><p className="muted">Submitted resignations will appear here.</p></div>}
    </section>
  </div>;
}
