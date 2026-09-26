"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ClaimForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/hrms/employees/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const d = await r.json();
    setBusy(false);
    setMessage(r.ok ? "HRMS invitation accepted. Your company employment is now linked to your CareerVerify identity." : d.error || "Unable to accept invitation.");
    setDone(r.ok);
  }

  return <div className="wrap">
    <nav className="nav"><Link className="brand" href="/">Career<span>Verify</span></Link><Link className="btn alt" href="/login">Sign in</Link></nav>
    <div className="card">
      <div className="pill">HRMS INVITATION</div>
      <h1>Accept company invitation</h1>
      <p className="muted">If you already have a CareerVerify account, sign in first and then open this invitation. A new employee account can set its password here.</p>
      {!done && <><div className="field"><label>New password (new accounts only)</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ chars, upper/lower/number/symbol" /></div><button className="btn" onClick={submit} disabled={busy || !token}>{busy ? "Processing…" : "Accept invitation"}</button></>}
      {message && <p className="notice">{message}</p>}
      {done && <Link className="btn" href="/candidate">Open Career Profile</Link>}
    </div>
  </div>;
}

export default function ClaimPage() {
  return <Suspense fallback={<div className="wrap"><div className="card">Loading…</div></div>}><ClaimForm /></Suspense>;
}
