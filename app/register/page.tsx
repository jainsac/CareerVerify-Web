"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const checks = [
  ["length", "At least 8 characters"],
  ["lowercase", "At least 1 lowercase character (a-z)"],
  ["uppercase", "At least 1 uppercase character (A-Z)"],
  ["number", "At least 1 number (0-9)"],
  ["special", "At least 1 special character"],
] as const;

export default function Register() {
 const [role,setRole]=useState("EMPLOYEE"),[name,setName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[password,setPassword]=useState(""),[companyName,setCompanyName]=useState(""),[cin,setCin]=useState(""),[gstin,setGstin]=useState(""),[certificate,setCertificate]=useState<File|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const router=useRouter();
 const passwordChecks=useMemo(()=>({length:password.length>=8,lowercase:/[a-z]/.test(password),uppercase:/[A-Z]/.test(password),number:/\d/.test(password),special:/[^A-Za-z0-9]/.test(password)}),[password]);
 const score=Object.values(passwordChecks).filter(Boolean).length;
 const strength=score<=2?{label:"Weak",className:"weak"}:score<=4?{label:"Medium",className:"medium"}:{label:"Strong",className:"strong"};
 const complete=score===5;
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(!complete){setError("Please meet all password requirements before creating your account.");return}
  if(role==="EMPLOYER" && (!companyName.trim() || (!cin.trim()&&!gstin.trim()) || !certificate)){setError("Employer registration requires company name, CIN or GSTIN, and the company registration certificate.");return}
  setBusy(true);setError("");
  const form=new FormData();
  form.append("role",role);form.append("name",name);form.append("email",email);form.append("phone",phone);form.append("password",password);
  if(role==="EMPLOYER"){form.append("companyName",companyName);form.append("cin",cin);form.append("gstin",gstin);if(certificate)form.append("certificate",certificate)}
  const r=await fetch("/api/auth/register",{method:"POST",body:form});
  const d=await r.json();setBusy(false);
  if(!r.ok){setError(d.error||"Registration failed");return}
  router.push(role==="EMPLOYER"?"/employer":"/candidate");
 }
 return <div className="wrap"><form className="form card" onSubmit={submit}><Link className="brand" href="/">Career<span>Verify</span></Link><h1>Create account</h1>
 <div className="field"><label>Account type</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="EMPLOYEE">Employee</option><option value="EMPLOYER">Employer</option></select></div>
 <div className="field"><label>Full name / authorized representative</label><input required value={name} onChange={e=>setName(e.target.value)}/></div>
 <div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
 <div className="field"><label>Phone number</label><input required type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}/></div>
 {role==="EMPLOYER"&&<div className="card" style={{margin:"12px 0"}}><div className="pill">EMPLOYER VERIFICATION</div><h3>Company details & certificate</h3><p className="muted">Employer accounts must be reviewed by the platform admin before production approval. For the current test phase, the account can still be used to test the employer workflow while it remains marked Pending.</p><div className="field"><label>Company name</label><input required value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Registered company name"/></div><div className="field"><label>CIN</label><input value={cin} onChange={e=>setCin(e.target.value)} placeholder="CIN"/></div><div className="field"><label>GSTIN</label><input value={gstin} onChange={e=>setGstin(e.target.value)} placeholder="GSTIN"/></div><div className="field"><label>Company registration certificate <strong>(Mandatory)</strong></label><input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>setCertificate(e.target.files?.[0]||null)}/><p className="muted">PDF, JPG or PNG • maximum 10 MB</p></div></div>}
 <div className="field"><label>Password</label><input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><div className="password-strength"><div className="password-strength-head"><strong>Password strength</strong><span className={strength.className}>{password?strength.label:"—"}</span></div><div className="strength-track"><div className={"strength-bar "+strength.className} style={{width:(password?score*20:0)+"%"}}/></div></div><div className="password-rules"><strong>Password requirements — all are mandatory</strong>{checks.map(([key,label])=><div key={key} className={passwordChecks[key]?"rule ok":"rule"}><span>{passwordChecks[key]?"✓":"✕"}</span> {label}</div>)}</div></div>
 {error&&<div className="notice">{error}</div>}<button className="btn" disabled={busy}>{busy?"Creating…":"Create account"}</button><p className="muted">By continuing, you agree to the platform terms and privacy notice.</p></form></div>
}