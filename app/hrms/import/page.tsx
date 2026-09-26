"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Org={id:string;name:string};
type Result={total:number;valid?:number;invalid?:number;imported?:number;errors?:{row:number;errors?:string[];error?:string}[];preview?:Record<string,unknown>[];failed?:{row:number;error:string}[]};

export default function ImportPage(){
 const [orgs,setOrgs]=useState<Org[]>([]),[orgId,setOrgId]=useState(""),[rows,setRows]=useState<Record<string,string>[]>([]),[headers,setHeaders]=useState<string[]>([]),[result,setResult]=useState<Result|null>(null),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch("/api/me").then(r=>r.json()).then(d=>{setOrgs(d.organizations||[]);if(d.organizations?.[0])setOrgId(d.organizations[0].id)})},[]);
 function parse(text:string){const lines=text.split(/\r?\n/).filter(Boolean);if(!lines.length)return;const split=(s:string)=>s.split(",").map(x=>x.trim().replace(/^"|"$/g,""));const h=split(lines[0]);setHeaders(h);setRows(lines.slice(1).map(line=>{const v=split(line);return Object.fromEntries(h.map((k,i)=>[k,v[i]||""]))}));setResult(null);setMsg(rows.length?"":"CSV loaded.");}
 async function validate(){setBusy(true);const r=await fetch("/api/hrms/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,rows})});const d=await r.json();setResult(d);setMsg(r.ok?"Validation complete.":"Validation failed.");setBusy(false)}
 async function importRows(){if(!result?.preview?.length)return;setBusy(true);const r=await fetch("/api/hrms/import",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId:orgId,rows:result.preview})});const d=await r.json();setResult(d);setMsg(r.ok?"Import completed.":"Import failed.");setBusy(false)}
 return <div className="wrap"><nav className="nav"><Link className="brand" href="/hrms">Career<span>Verify</span></Link><Link className="btn alt" href="/hrms/integrations">Integrations</Link><Link className="btn alt" href="/hrms/employees">Employees</Link></nav>
 <div className="card"><div className="pill">MIGRATION CENTER</div><h1>Bulk employee import</h1><p className="muted">Upload a CSV, validate it against your company's existing employees, review the preview and then import. Maximum 2,000 rows per batch.</p>{orgs.length>1&&<div className="field"><label>Company</label><select value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}<div className="field"><label>CSV file</label><input type="file" accept=".csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)f.text().then(parse)}}/></div>{msg&&<p className="notice">{msg}</p>}</div>
 {rows.length>0&&<section className="section"><div className="card"><h2>Loaded {rows.length} rows</h2><p className="muted">{headers.join(" • ")}</p><button className="btn" onClick={validate} disabled={busy||!orgId}>{busy?"Validating…":"Validate & preview"}</button></div></section>}
 {result&&<section className="section"><div className="card"><h2>Validation result</h2><p>Total: {result.total} • Valid: {result.valid??"—"} • Invalid: {result.invalid??result.failed?.length??"—"}</p>{result.errors?.length?<div className="card"><h3>Errors</h3>{result.errors.slice(0,50).map(e=><p key={e.row}>Row {e.row}: {(e.errors||[]).join(", ")}</p>)}</div>:null}{result.preview?.length?<><h3>Preview</h3><div className="table">{result.preview.slice(0,10).map((x,i)=><p key={i}>{String(x.name)} • {String(x.companyEmail)} • {String(x.designation)} • {String(x.joiningDate)}</p>)}</div><button className="btn" onClick={importRows} disabled={busy}>{busy?"Importing…":"Import validated rows"}</button></>:null}{result.imported!==undefined&&<p className="notice">Imported: {result.imported}. Failed: {result.failed?.length||0}.</p>}</div></section>}
 </div>
}
