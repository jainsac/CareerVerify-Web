"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const checks = [
  ["length", "At least 8 characters"],
  ["uppercase", "At least 1 uppercase letter (A-Z)"],
  ["special", "At least 1 special character"],
];

export default function Register() {
  const [role,setRole]=useState("EMPLOYEE"),[name,setName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const router=useRouter();
  const passwordChecks={length:password.length>=8,uppercase:/[A-Z]/.test(password),special:/[^A-Za-z0-9]/.test(password)};
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role,name,email,phone,password})});const d=await r.json();setBusy(false);if(!r.ok){setError(d.error||"Registration failed");return}router.push(role==="EMPLOYER"?"/employer":"/candidate");}
  return <div className="wrap"><form className="form card" onSubmit={submit}><Link className="brand" href="/">Career<span>Verify</span></Link><h1>Create account</h1><div className="field"><label>Account type</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="EMPLOYEE">Employee</option><option value="EMPLOYER">Employer</option></select></div><div className="field"><label>Full name / authorized representative</label><input required value={name} onChange={e=>setName(e.target.value)}/></div><div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Phone number</label><input required type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}/></div><div className="field"><label>Password</label><input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)}/><div className="password-rules"><strong>Password requirements</strong>{checks.map(([key,label])=><div key={key} className={passwordChecks[key as keyof typeof passwordChecks]?"rule ok":"rule"}><span>{passwordChecks[key as keyof typeof passwordChecks]?"✓":"✕"}</span> {label}</div>)}</div></div>{error&&<div className="notice">{error}</div>}<button className="btn" disabled={busy}>{busy?"Creating…":"Create account"}</button><p className="muted">By continuing, you agree to the platform terms and privacy notice.</p></form></div>
}
