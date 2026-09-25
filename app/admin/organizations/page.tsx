"use client";
import {useEffect,useState} from "react";
type Org={id:string;name:string;cin?:string|null;gstin?:string|null;verifiedAt?:string|null;createdAt:string;members:number;employments:number};
export default function Admin(){
 const [items,setItems]=useState<Org[]>([]),[msg,setMsg]=useState("");
 const load=()=>fetch("/api/admin/organizations").then(r=>r.ok?r.json():[]).then(setItems);
 useEffect(()=>{load()},[]);
 async function verify(id:string,verified:boolean){setMsg("Updating…");const r=await fetch("/api/admin/organizations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:id,verified})});const d=await r.json();setMsg(r.ok?(verified?"Organization verified.":"Verification revoked."):d.error||"Update failed");if(r.ok)load()}
 return <main className="wrap"><div className="card"><div className="pill">PLATFORM ADMIN</div><h1>Organization verification</h1><p className="muted">Review registered organizations and control their platform verification status.</p>{msg&&<p className="notice">{msg}</p>}</div><section className="section"><h2>Organizations</h2>{items.length?<div className="grid">{items.map(o=><div className="card" key={o.id}><h3>{o.name}</h3><p className="muted">CIN: {o.cin||"—"} • GSTIN: {o.gstin||"—"}</p><p>{o.members} members • {o.employments} employment records</p><p className="muted">{o.verifiedAt?"Verified":"Not verified"}</p><div className="actions">{!o.verifiedAt?<button className="btn" onClick={()=>verify(o.id,true)}>Verify organization</button>:<button className="btn alt" onClick={()=>verify(o.id,false)}>Revoke verification</button>}</div></div>)}</div>:<div className="card"><p className="muted">No organizations registered yet.</p></div>}</section></main>
}