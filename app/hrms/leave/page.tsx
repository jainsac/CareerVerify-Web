"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LeavePage() {
  const [orgs,setOrgs]=useState<any[]>([]);
  const [orgId,setOrgId]=useState("");
  const [employees,setEmployees]=useState<any[]>([]);
  const [policies,setPolicies]=useState<any[]>([]);
  const [requests,setRequests]=useState<any[]>([]);
  const [employeeId,setEmployeeId]=useState("");
  const [policyId,setPolicyId]=useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [reason,setReason]=useState("");
  const [policyName,setPolicyName]=useState("Annual Leave");
  const [leaveType,setLeaveType]=useState("ANNUAL");
  const [limit,setLimit]=useState("18");
  const [message,setMessage]=useState("");

  async function load(id=orgId){
    if(!id)return;
    const [e,l]=await Promise.all([
      fetch("/api/hrms/employees/list?organizationId="+encodeURIComponent(id)),
      fetch("/api/hrms/leave?organizationId="+encodeURIComponent(id))
    ]);
    if(e.ok)setEmployees(await e.json());
    if(l.ok){const d=await l.json();setPolicies(d.policies||[]);setRequests(d.requests||[]);}
  }

  useEffect(()=>{fetch("/api/me").then(r=>r.json()).then(d=>{const list=d.organizations||[];setOrgs(list);if(list[0]){setOrgId(list[0].id);load(list[0].id);}})},[]);
  useEffect(()=>{if(orgId)load()},[orgId]);

  async function savePolicy(){
    const r=await fetch("/api/hrms/leave",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,action:"POLICY",name:policyName,leaveType,annualLimit:Number(limit)})});
    const d=await r.json();setMessage(r.ok?"Leave policy saved.":d.error||"Unable to save.");if(r.ok)load();
  }

  async function createRequest(){
    const days=Math.floor((new Date(endDate).getTime()-new Date(startDate).getTime())/86400000)+1;
    const r=await fetch("/api/hrms/leave",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,action:"REQUEST",employmentRecordId:employeeId,policyId,startDate,endDate,days,reason})});
    const d=await r.json();setMessage(r.ok?"Leave request created.":d.error||"Unable to create request.");if(r.ok)load();
  }

  async function decide(id:string,status:string){
    const r=await fetch("/api/hrms/leave",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,id,status})});
    if(r.ok)load();else setMessage("Unable to update leave request.");
  }

  return <div className="wrap">
    <nav className="nav"><Link className="brand" href="/hrms">Career<span>Verify</span></Link><Link className="btn alt" href="/hrms/employees">Employees</Link></nav>
    <div className="card"><div className="pill">LEAVE</div><h1>Leave management</h1>
      {orgs.length>1&&<div className="field"><label>Company</label><select value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
      <h2>Leave policy</h2><div className="grid"><input value={policyName} onChange={e=>setPolicyName(e.target.value)} placeholder="Policy name"/><input value={leaveType} onChange={e=>setLeaveType(e.target.value)} placeholder="Leave type"/><input type="number" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="Annual limit"/></div><button className="btn" onClick={savePolicy}>Save policy</button>
      <h2>Leave request</h2><div className="grid"><select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.careerProfile.user.name}</option>)}</select><select value={policyId} onChange={e=>setPolicyId(e.target.value)}><option value="">Policy</option>{policies.map(p=><option key={p.id} value={p.id}>{p.name} ({p.annualLimit})</option>)}</select><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason"/></div><button className="btn" onClick={createRequest} disabled={!employeeId||!policyId||!startDate||!endDate}>Create request</button>
      {message&&<p className="notice">{message}</p>}
    </div>
    <section className="section"><div className="grid">{requests.map(x=><div className="card" key={x.id}><div className="pill">{x.status}</div><h3>{x.employmentRecord.careerProfile.user.name}</h3><p>{x.policy.name} • {x.days} day(s)</p><p>{new Date(x.startDate).toLocaleDateString()} – {new Date(x.endDate).toLocaleDateString()}</p>{x.status==="PENDING"&&<div className="actions"><button className="btn" onClick={()=>decide(x.id,"APPROVED")}>Approve</button><button className="btn alt" onClick={()=>decide(x.id,"REJECTED")}>Reject</button></div>}</div>)}</div></section>
  </div>;
}
