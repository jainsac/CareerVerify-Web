"use client";
import Link from "next/link";
import {useEffect,useState} from "react";

type Payslip={
 id:string; employeeCode?:string|null; designation:string; department?:string|null; organizationName:string;
 payrollRun:{id:string;periodStart:string;periodEnd:string;status:string};
 payslip:{id:string;basic:number;hra:number;allowances:number;gross:number;pfEmployee:number;esiEmployee:number;professionalTax:number;tds:number;otherDeductions:number;totalDeductions:number;netPay:number;createdAt:string}|null;
};

const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function Payslips(){
 const [rows,setRows]=useState<Payslip[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/employee/payslips").then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load payslips");return d}).then(setRows).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 return <div className="wrap"><nav className="nav"><Link className="brand" href="/candidate">Career<span>Verify</span></Link><div className="links"><Link className="btn alt" href="/candidate">Dashboard</Link><Link className="btn alt" href="/profile">Profile</Link></div></nav>
 <div className="card"><div className="pill">PAYROLL</div><h1>My Payslips</h1><p className="muted">Finalized payslips issued through your employer's HRMS appear here.</p></div>
 <section className="section">{loading?<div className="card">Loading payslips…</div>:error?<div className="card"><p>{error}</p></div>:rows.length?<div className="grid">{rows.map(x=><div className="card" key={x.id}><div className="pill">{x.payrollRun.status}</div><h3>{x.organizationName}</h3><p>{new Date(x.payrollRun.periodStart).toLocaleDateString()} – {new Date(x.payrollRun.periodEnd).toLocaleDateString()}</p><p>Gross: <strong>{money(x.payslip?.gross||0)}</strong></p><p>Total deductions: {money(x.payslip?.totalDeductions||0)}</p><p>Net pay: <strong>{money(x.payslip?.netPay||0)}</strong></p><Link className="btn" href={`/employee/payslips/${x.id}`}>View payslip</Link></div>)}</div>:<div className="card"><h3>No finalized payslips yet</h3><p className="muted">Your employer's finalized payroll will appear here.</p></div>}</section></div>
}