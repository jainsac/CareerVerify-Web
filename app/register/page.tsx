"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Register(){
 const [role,setRole]=useState("EMPLOYEE"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role,name,email,password})});const d=await r.json();setBusy(false);if(!r.ok){setError(d.error||"Registration failed");return}router.push(role==="EMPLOYER"?"/employer":"/candidate");}
 return <div className="wrap"><form className="form card" onSubmit={submit}><Link className="brand" href="/">Career<span>Verify</span></Link><h1>Create account</h1><div className="field"><label>Account type</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="EMPLOYEE">Employee</option><option value="EMPLOYER">Employer</option></select></div><div className="field"><label>Full name / authorized representative</label><input required value={name} onChange={e=>setName(e.target.value)}/></div><div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Password</label><input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<div className="notice">{error}</div>}<button className="btn" disabled={busy}>{busy?"Creating…":"Create account"}</button><p className="muted">By continuing, you agree to the platform terms and privacy notice.</p></form></div>
}