"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPassword() {
  const [identifier,setIdentifier]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setMessage(""); setError(""); setBusy(true);
    try {
      const r=await fetch("/api/auth/password-reset/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier})});
      const d=await r.json();
      if(!r.ok){setError(d.error||"Unable to process request.");return;}
      setMessage("If an account matches, a password reset link has been sent to its registered email address.");
    } catch { setError("Unable to process the request. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="wrap"><form className="form card" onSubmit={submit}>
    <Link className="brand" href="/">Career<span>Verify</span></Link>
    <h1>Reset password</h1>
    <p className="muted">Enter your registered email, phone number or Career ID. We will send a secure reset link to the account email.</p>
    <div className="field"><label>Email, phone number or Career ID</label><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@example.com / 9876543210 / CV-IND-..." autoComplete="username" /></div>
    {error&&<p className="notice">{error}</p>}
    {message&&<p className="notice">{message}</p>}
    <button className="btn" disabled={busy}>{busy?"Sending…":"Send reset link"}</button>
    <p className="muted"><Link href="/login">Back to sign in</Link></p>
  </form></div>;
}
