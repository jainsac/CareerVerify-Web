"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { name: string; email: string; phone?: string | null; careerProfile?: { careerId: string } | null };

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me").then(async r => {
      if (!r.ok) { window.location.href = "/login"; return; }
      const d = await r.json();
      setMe(d); setName(d.name || ""); setPhone(d.phone || "");
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    const r = await fetch("/api/me", { method: "PATCH", headers: {"content-type":"application/json"}, body: JSON.stringify({name, phone}) });
    const d = await r.json(); setBusy(false);
    setMessage(r.ok ? "Profile updated successfully." : d.error || "Profile update failed.");
    if (r.ok) setMe({...me!, ...d});
  }

  return <div className="wrap">
    <nav className="nav">
      <Link className="brand" href="/candidate">Career<span>Verify</span></Link>
      <div className="links"><Link className="btn alt" href="/candidate">Dashboard</Link><Link className="btn alt" href="/verify">Verification</Link></div>
    </nav>
    <form className="form card" onSubmit={save}>
      <div className="pill">EMPLOYEE PROFILE</div>
      <h1>Your profile</h1>
      <p className="muted">Your Career ID is permanent. Employment history is maintained through verified employer records.</p>
      <div className="field"><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} required /></div>
      <div className="field"><label>Email</label><input value={me?.email || ""} disabled /></div>
      <div className="field"><label>Phone number</label><input inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile number" /></div>
      <div className="field"><label>Career ID</label><input value={me?.careerProfile?.careerId || ""} disabled /></div>
      {message && <p className="notice">{message}</p>}
      <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  </div>;
}
