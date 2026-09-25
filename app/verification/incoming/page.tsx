"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type RequestItem={id:string;careerId:string;employeeName:string;status:string;expiresAt:string;consentedAt?:string|null;respondedAt?:string|null;response?:{verified:boolean;designation?:string|null;joinedAt?:string|null;leftAt?:string|null;notes?:string|null}|null};
export default function IncomingVerification(){
 const [items,setItems]=useState<RequestItem[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
 const load=()=>fetch("/api/verification/incoming").then(r=>r.ok?r.json():[]).then(setItems).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);
 const respond=async(item:RequestItem,approved:boolean)=>{
  setBusy(item.id);setMessage("");
  const r=await fetch("/api/verification/respond",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:"",approved})});
  const d=await r.json();setBusy("");setMessage(r.ok?"Response submitted.":"The response could not be submitted from this screen yet.");if(r.ok)load();
 };
 return <div className="wrap"><nav className="nav"><Link className="brand" href="/">Career<span>Verify</span></Link><Link className="btn alt" href="/employer">Employer workspace</Link></nav><div className="card"><div className="pill">PRIOR EMPLOYER</div><h1>Incoming verification requests</h1><p className="muted">Review requests after the employee has granted consent.</p>{message&&<p className="notice">{message}</p>}</div><section className="section">{loading?<p className="muted">Loading…</p>:items.length?<div className="grid">{items.map(x=><div className="card" key={x.id}><div className="pill">{x.status}</div><h3>{x.employeeName}</h3><p>Career ID: <strong>{x.careerId}</strong></p><p className="muted">Expires {new Date(x.expiresAt).toLocaleDateString()}</p>{x.status==="PENDING"&&!x.response?(x.consentedAt?<div><p className="muted">Employee consent received.</p><div className="actions"><button className="btn" disabled={busy===x.id} onClick={()=>respond(x,true)}>Verify</button><button className="btn alt" disabled={busy===x.id} onClick={()=>respond(x,false)}>Reject</button></div></div>:<p className="muted">Waiting for employee consent.</p>):x.response?<p>{x.response.verified?"Verified":"Rejected"}</p>:null}</div>)}</div>:<div className="card"><h3>No incoming requests</h3><p className="muted">Requests for your organization will appear here.</p></div>}</section></div>
}
