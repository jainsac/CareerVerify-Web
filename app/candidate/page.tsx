"use client";
import Link from "next/link";
import {useEffect,useState} from "react";

type Doc={id:string;documentType:string;title:string;source:string;issuedAt?:string|null;verifiedAt?:string|null;documentRef?:string|null};
type Issue={id:string;concern:string;status:string;employerResponse?:string|null;createdAt:string};
type Emp={
 id:string;designation:string;department?:string|null;employmentType?:string|null;joinedAt:string;leftAt?:string|null;
 status:string;source?:string;verifiedAt?:string|null;editUnlockedAt?:string|null;editUnlockReason?:string|null;
 reverificationPendingAt?:string|null;resignationStatus?:string;organization:{name:string};documents?:Doc[];issueRequests?:Issue[];
};

type Verification={id:string;status:string;consentedAt?:string|null;requestingOrganization:string;priorOrganization:string;response?:{verified:boolean}|null};

function Letter({id,onDone}:{id:string;onDone:()=>void}) {
 const [file,setFile]=useState<File|null>(null),[msg,setMsg]=useState("");
 async function save(){
  if(!file)return;
  setMsg("Uploading…");
  const form=new FormData(); form.append("employmentRecordId",id); form.append("file",file);
  const r=await fetch("/api/experience-letter/upload",{method:"POST",body:form}); const d=await r.json();
  setMsg(r.ok?"Experience letter uploaded and registered.":d.error||"Upload failed"); if(r.ok)onDone();
 }
 return <div style={{marginTop:10}}><input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="btn alt" onClick={save} disabled={!file}>Upload experience letter</button>{msg&&<p className="muted">{msg}</p>}</div>
}

function EditExperience({row,onDone}:{row:Emp;onDone:()=>void}) {
 const [designation,setDesignation]=useState(row.designation),[department,setDepartment]=useState(row.department||"");
 const [employmentType,setEmploymentType]=useState(row.employmentType||"");
 const [joinedAt,setJoinedAt]=useState(row.joinedAt.slice(0,10)),[leftAt,setLeftAt]=useState(row.leftAt?row.leftAt.slice(0,10):"");
 const [remarks,setRemarks]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function save(){
  setBusy(true);setMsg("");
  const r=await fetch("/api/employment",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({employmentRecordId:row.id,designation,department,employmentType,joinedAt,leftAt,remarks})});
  const d=await r.json();setBusy(false);setMsg(r.ok?"Updated. Sent to employer for re-verification.":d.error||"Unable to update.");
  if(r.ok)onDone();
 }
 return <div className="card" style={{marginTop:12}}>
  <h3>Edit corrected experience</h3>
  <p className="muted">Your employer approved a correction. After saving, the old verified status will remain in the audit history and this updated version will require re-verification.</p>
  <div className="field"><label>Designation</label><input value={designation} onChange={e=>setDesignation(e.target.value)}/></div>
  <div className="field"><label>Department</label><input value={department} onChange={e=>setDepartment(e.target.value)}/></div>
  <div className="field"><label>Employment type</label><input value={employmentType} onChange={e=>setEmploymentType(e.target.value)}/></div>
  <div className="field"><label>Joining date</label><input type="date" value={joinedAt} onChange={e=>setJoinedAt(e.target.value)}/></div>
  <div className="field"><label>Leaving date</label><input type="date" value={leftAt} onChange={e=>setLeftAt(e.target.value)}/></div>
  <div className="field"><label>Correction details</label><textarea value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Describe the corrected details"/></div>
  {msg&&<p className="notice">{msg}</p>}
  <button className="btn" onClick={save} disabled={busy}>{busy?"Saving…":"Save & request re-verification"}</button>
 </div>
}

function ExperienceCard({row,onReload}:{row:Emp;onReload:()=>void}) {
 const [issue,setIssue]=useState(false),[concern,setConcern]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function report(){
  if(concern.trim().length<5){setMsg("Please describe the issue.");return}
  setBusy(true);setMsg("");
  const r=await fetch("/api/employment/issue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employmentRecordId:row.id,concern})});
  const d=await r.json();setBusy(false);setMsg(r.ok?"Correction request sent to the verifying employer.":d.error||"Unable to send request.");
  if(r.ok){setConcern("");setIssue(false);onReload()}
 }
 const latest=row.issueRequests?.[0];
 const verified=Boolean(row.verifiedAt);
 return <div className="card">
  {verified?<div className="pill" style={{borderColor:"#15803d",color:"#15803d"}}>✓ VERIFIED EXPERIENCE</div>:row.reverificationPendingAt?<div className="pill">RE-VERIFICATION PENDING</div>:<div className="pill">NOT YET VERIFIED</div>}
  <h3>{row.organization.name}</h3>
  <p><strong>{row.designation}</strong>{row.department?" • "+row.department:""}</p>
  <p className="muted">{new Date(row.joinedAt).toLocaleDateString()} – {row.leftAt?new Date(row.leftAt).toLocaleDateString():"Present"} • {row.status}</p>

  {verified&&<p className="muted">Verified by {row.organization.name}. Verified employment details are locked to preserve the employer-confirmed record.</p>}
  {row.editUnlockedAt&&<EditExperience row={row} onDone={onReload}/>}
  {row.reverificationPendingAt&&<p className="notice">Your corrected details have been submitted. Waiting for {row.organization.name} to re-verify the experience.</p>}

  {verified&&!row.editUnlockedAt&&!row.reverificationPendingAt&&<button className="btn alt" onClick={()=>setIssue(v=>!v)}>Report an issue / Request correction</button>}
  {issue&&<div className="card" style={{marginTop:12}}>
    <h4>What needs to be corrected?</h4>
    <textarea value={concern} onChange={e=>setConcern(e.target.value)} placeholder="Explain the issue to the employer, e.g. joining date, designation, department, employment period…" />
    {msg&&<p className="notice">{msg}</p>}
    <button className="btn" onClick={report} disabled={busy}>{busy?"Sending…":"Send correction request"}</button>
  </div>}

  {latest&&<p className="muted">Correction request: <strong>{latest.status}</strong>{latest.employerResponse?" • "+latest.employerResponse:""}</p>}

  {(row.documents?.length||0)>0&&<div style={{marginTop:14}}>
    <h4>Employment documents</h4>
    <div className="grid">{row.documents?.map(d=><div className="card" key={d.id}><strong>{d.title}</strong><p className="muted">{d.documentType} • Source: {d.source==="HRMS"?"Employer HRMS":d.source}</p>{d.verifiedAt&&<p className="notice">Employer verified document</p>}</div>)}</div>
  </div>}

  <Letter id={row.id} onDone={onReload}/>
  {row.status==="ACTIVE"&&row.resignationStatus!=="SUBMITTED"?<button className="btn alt" onClick={async()=>{const reason=window.prompt("Resignation reason (optional)");const r=await fetch("/api/employee/resignation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employmentId:row.id,reason:reason||""})});const d=await r.json();setMsg(r.ok?"Resignation submitted to your employer.":d.error||"Unable to submit resignation.");if(r.ok)onReload()}}>Submit resignation</button>:row.status==="ACTIVE"&&row.resignationStatus==="SUBMITTED"?<button className="btn" onClick={async()=>{const reason=window.prompt("Why are you withdrawing your resignation?");if(!reason)return;const r=await fetch("/api/employee/resignation",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({employmentId:row.id,reason})});const d=await r.json();setMsg(r.ok?"Resignation withdrawn.":d.error||"Unable to withdraw resignation.");if(r.ok)onReload()}}>Withdraw resignation</button>:null}
  {msg&&<p className="muted">{msg}</p>}
 </div>
}

export default function Candidate(){
 const [careerId,setCareerId]=useState(""),[rows,setRows]=useState<Emp[]>([]),[requests,setRequests]=useState<Verification[]>([]);
 const [loading,setLoading]=useState(true),[message,setMessage]=useState(""),[loggingOut,setLoggingOut]=useState(false);
 const load=()=>Promise.all([
  fetch("/api/employment").then(r=>r.ok?r.json():[]).then(setRows),
  fetch("/api/verification/requests").then(r=>r.ok?r.json():[]).then(setRequests),
 ]).finally(()=>setLoading(false));
 useEffect(()=>{fetch("/api/me").then(r=>r.json()).then(d=>setCareerId(d.careerProfile?.careerId||""));load()},[]);
 const logout=async()=>{setLoggingOut(true);await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login"};
 const consent=async(id:string)=>{setMessage("Submitting consent…");const r=await fetch("/api/verification/consent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:id,consent:true})});const d=await r.json();setMessage(r.ok?"Consent granted.":d.error||"Unable to grant consent.");if(r.ok)load()};
 return <div className="wrap">
  <nav className="nav"><Link className="brand" href="/candidate">Career<span>Verify</span></Link><div className="links"><Link className="btn alt" href="/profile">Profile</Link><button className="btn alt" type="button" onClick={logout} disabled={loggingOut}>{loggingOut?"Signing out…":"Logout"}</button></div></nav>
  <div className="card"><div className="pill">EMPLOYEE WORKSPACE</div><h1>Your Career ID</h1><div className="stat">{careerId||"Loading…"}</div><p className="muted">Share this ID when an employer needs to initiate verification. Verified employment records can be reused by future employers.</p></div>
  <section className="section"><div className="card"><div className="pill">CAREER PROFILE</div><h2>Complete your profile</h2><p className="muted">Verified employer records form the trusted part of your employment history.</p><Link className="btn" href="/profile">Open profile</Link></div><div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}><Link className="btn alt" href="/employee/payslips">My Payslips</Link><Link className="btn alt" href="/employment/add">Add past experience</Link><Link className="btn alt" href="/disputes">Raise a dispute</Link></div></section>
  <section className="section"><h2>Verification requests</h2>{message&&<p className="notice">{message}</p>}{requests.length?<div className="grid">{requests.map(x=><div className="card" key={x.id}><div className="pill">{x.status}</div><h3>{x.requestingOrganization}</h3><p>Requesting verification from <strong>{x.priorOrganization}</strong></p><p className="muted">This request remains active until the prior employer responds.</p>{x.status==="PENDING"&&!x.consentedAt?<button className="btn" onClick={()=>consent(x.id)}>Give consent</button>:x.consentedAt&&x.status==="PENDING"?<p className="muted">Consent granted. Awaiting prior employer response.</p>:x.response?<p>{x.response.verified?"Verification confirmed.":"Verification not confirmed."}</p>:null}</div>)}</div>:<div className="card"><h3>No verification requests</h3><p className="muted">New employer verification requests will appear here.</p></div>}</section>
  <section className="section"><h2>Employment history</h2>{loading?<p className="muted">Loading…</p>:rows.length?<div className="grid">{rows.map(x=><ExperienceCard key={x.id} row={x} onReload={load}/>)}</div>:<div className="card"><h3>No employment records yet</h3><p className="muted">Verified employment records will appear here.</p></div>}</section>
 </div>
}
