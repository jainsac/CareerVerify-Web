"use client";
import {useEffect,useState} from "react";
type D={id:string;reason:string;createdAt:string;careerId:string;employeeName:string;organization:string;employmentRecordId:string};
export default function AdminDisputes(){
 const [items,setItems]=useState<D[]>([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState("");
 const load=()=>fetch("/api/admin/disputes").then(r=>r.ok?r.json():[]).then(setItems);
 useEffect(()=>{load()},[]);
 async function resolve(id:string,status:"RESOLVED"|"REJECTED"){
  const resolution=window.prompt(status==="RESOLVED"?"Resolution / correction details":"Reason for rejecting the dispute");
  if(!resolution?.trim())return;
  setBusy(id);const r=await fetch("/api/admin/disputes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({disputeId:id,status,resolution})});const d=await r.json();setBusy("");setMsg(r.ok?"Dispute updated.":d.error||"Update failed");if(r.ok)load();
 }
 return <main className="wrap"><div className="card"><div className="pill">PLATFORM ADMIN</div><h1>Employment disputes</h1><p className="muted">Review employee disputes and record the final resolution.</p>{msg&&<p className="notice">{msg}</p>}</div><section className="section"><h2>Open disputes</h2>{items.length?<div className="grid">{items.map(d=><div className="card" key={d.id}><div className="pill">OPEN</div><h3>{d.employeeName}</h3><p>Career ID: <strong>{d.careerId}</strong></p><p>Organization: {d.organization}</p><p><strong>Dispute reason</strong></p><p className="muted">{d.reason}</p><p className="muted">Raised {new Date(d.createdAt).toLocaleDateString()}</p><div className="actions"><button className="btn" disabled={busy===d.id} onClick={()=>resolve(d.id,"RESOLVED")}>Resolve</button><button className="btn alt" disabled={busy===d.id} onClick={()=>resolve(d.id,"REJECTED")}>Reject</button></div></div>)}</div>:<div className="card"><h3>No open disputes</h3><p className="muted">There are currently no open employment disputes.</p></div>}</section></main>