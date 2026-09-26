"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [identifier,setIdentifier]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({identifier,password})});const d=await r.json();setBusy(false);if(!r.ok){setError(d.error||"Sign in failed");return}router.push(d.role==="EMPLOYER"?"/employer":"/candidate");}
  return <div className="wrap"><form className="form card" onSubmit={submit}><Link className="brand" href="/">Career<span>Verify</span></Link><h1>Sign in</h1><div className="field"><label>Email, phone number or Career ID</label><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@example.com / 9876543210 / CV-IND-..." autoComplete="username"/></div><div className="field"><label>Password</label><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></div>{error&&<div className="notice">{error}</div>}<button className="btn" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><p className="muted">You can sign in with your email, registered phone number, or Career ID using the same password.</p><p className="muted">New here? <Link href="/register">Create an account</Link></p></form></div>
}
