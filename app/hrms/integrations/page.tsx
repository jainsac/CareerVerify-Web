"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Org={id:string;name:string};
type Key={id:string;name:string;keyPrefix:string;scopes:string;revokedAt?:string|null};
type Hook={id:string;url:string;events:string;active:boolean};

const scopes=["employees:read","employees:write","employment:read","employment:write","resignations:read","webhooks:write"];
const events=["employee.created","employee.updated","employment.exit","resignation.submitted","resignation.accepted","resignation.withdrawn"];

export default function Integrations(){
 const [orgs,setOrgs]=useState<Org[]>([]),[orgId,setOrgId]=useState(""),[keys,setKeys]=useState<Key[]>([]),[hooks,setHooks]=useState<Hook[]>([]);
 const [name,setName]=useState(""),[selected,setSelected]=useState<string[]>(["employees:read"]),[url,setUrl]=useState(""),[hookEvents,setHookEvents]=useState<string[]>(["employee.created"]),[secret,setSecret]=useState(""),[newKey,setNewKey]=useState(""),[msg,setMsg]=useState("");
 async function load(id:string){if(!id)return;const [a,b]=await Promise.all([fetch("/api/hrms/integrations/keys?organizationId="+encodeURIComponent(id)),fetch("/api/hrms/integrations/webhooks?organizationId="+encodeURIComponent(id))]);setKeys(a.ok?await a.json():[]);setHooks(b.ok?await b.json():[])}
 useEffect(()=>{fetch("/api/me").then(r=>r.json()).then(d=>{setOrgs(d.organizations||[]);if(d.organizations?.[0]){setOrgId(d.organizations[0].id);load(d.organizations[0].id)}})},[]);
 const toggle=(v:string,setter:React.Dispatch<React.SetStateAction<string[]>>) => setter(x=>x.includes(v)?x.filter(y=>y!==v):[...x,v]);
 async function createKey(){const r=await fetch("/api/hrms/integrations/keys",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,name,scopes:selected})});const d=await r.json();setMsg(r.ok?"API key created. Copy it now; it will not be shown again.":d.error||"Failed.");if(r.ok){setNewKey(d.key);setName("");load(orgId)}}
 async function revokeKey(id:string){if(!confirm("Revoke this API key?"))return;const r=await fetch("/api/hrms/integrations/keys",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,id})});if(r.ok)load(orgId)}
 async function createHook(){const r=await fetch("/api/hrms/integrations/webhooks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,url,events:hookEvents})});const d=await r.json();setMsg(r.ok?"Webhook created. Copy the signing secret now.":d.error||"Failed.");if(r.ok){setSecret(d.secret);setUrl("");load(orgId)}}
 async function toggleHook(h:Hook){await fetch("/api/hrms/integrations/webhooks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,id:h.id,active:!h.active})});load(orgId)}
 return <div className="wrap"><nav className="nav"><Link className="brand" href="/hrms">Career<span>Verify</span></Link><Link className="btn alt" href="/hrms/employees">Employees</Link></nav>
 <div className="card"><div className="pill">INTEGRATION CENTER</div><h1>API & Webhooks</h1><p className="muted">Connect existing HRMS platforms, private HR systems and third-party applications without exposing internal servers.</p>{orgs.length>1&&<div className="field"><label>Company</label><select value={orgId} onChange={e=>{setOrgId(e.target.value);load(e.target.value)}}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}{msg&&<p className="notice">{msg}</p>}</div>
 <section className="section"><div className="card"><h2>API keys</h2><div className="field"><label>Key name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="HRMS production"/></div><div className="grid">{scopes.map(s=><label key={s}><input type="checkbox" checked={selected.includes(s)} onChange={()=>toggle(s,setSelected)}/> {s}</label>)}</div><button className="btn" onClick={createKey} disabled={!orgId||!name||!selected.length}>Create API key</button>{newKey&&<div className="card"><strong>Copy this key now:</strong><p>{newKey}</p></div>}<div className="section">{keys.map(k=><div className="card" key={k.id}><strong>{k.name}</strong><p className="muted">{k.keyPrefix}••• • {k.scopes}</p>{k.revokedAt?<span className="pill">REVOKED</span>:<button className="btn alt" onClick={()=>revokeKey(k.id)}>Revoke</button>}</div>)}</div></div></section>
 <section className="section"><div className="card"><h2>Webhooks</h2><div className="field"><label>Endpoint URL</label><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-hrms.example.com/webhooks"/></div><div className="grid">{events.map(e=><label key={e}><input type="checkbox" checked={hookEvents.includes(e)} onChange={()=>toggle(e,setHookEvents)}/> {e}</label>)}</div><button className="btn" onClick={createHook} disabled={!orgId||!url||!hookEvents.length}>Create webhook</button>{secret&&<div className="card"><strong>Signing secret — copy now:</strong><p>{secret}</p></div>}<div className="section">{hooks.map(h=><div className="card" key={h.id}><strong>{h.url}</strong><p className="muted">{h.events}</p><button className="btn alt" onClick={()=>toggleHook(h)}>{h.active?"Disable":"Enable"}</button></div>)}</div></div></section>
 </div>
}
