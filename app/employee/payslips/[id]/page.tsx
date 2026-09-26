"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";

export default function PayslipDetail(){
 const p=useParams<{id:string}>(),[row,setRow]=useState<any>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!p.id)return;fetch("/api/employee/payslips?entryId="+encodeURIComponent(p.id)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load payslip");if(!d.length)throw new Error("Payslip not found or not finalized.");return d[0]}).then(setRow).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[p.id]);
 const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 if(loading)return <div className="wrap"><div className="card">Loading payslip…</div></div>;
 if(!row)return <div className="wrap"><nav className="nav"><Link className="brand" href="/candidate">Career<span>Verify</span></Link></nav><div className="card"><h2>Unable to open payslip</h2><p>{error}</p><Link className="btn" href="/employee/payslips">Back to payslips</Link></div></div>;
 const s=row.payslip;
 return <div className="wrap"><nav className="nav no-print"><Link className="brand" href="/candidate">Career<span>Verify</span></Link><div className="links"><Link className="btn alt" href="/employee/payslips">All payslips</Link><button className="btn" onClick={()=>window.print()}>Print / Save PDF</button></div></nav>
 <div className="card payslip"><div className="pill">FINALIZED PAYSLIP</div><h1>{row.organizationName}</h1><p><strong>Period:</strong> {new Date(row.payrollRun.periodStart).toLocaleDateString()} – {new Date(row.payrollRun.periodEnd).toLocaleDateString()}</p><p className="muted">{row.designation}{row.department?" • "+row.department:""}{row.employeeCode?" • Employee ID: "+row.employeeCode:""}</p><hr/>
 <h2>Earnings</h2><p>Basic: <strong>{money(s.basic)}</strong></p><p>HRA: <strong>{money(s.hra)}</strong></p><p>Allowances: <strong>{money(s.allowances)}</strong></p><p>Gross: <strong>{money(s.gross)}</strong></p>
 <h2>Deductions</h2><p>PF: {money(s.pfEmployee)}</p><p>ESI: {money(s.esiEmployee)}</p><p>Professional Tax: {money(s.professionalTax)}</p><p>TDS: {money(s.tds)}</p><p>Other deductions: {money(s.otherDeductions)}</p><p>Total deductions: <strong>{money(s.totalDeductions)}</strong></p><hr/><h2>Net Pay: {money(s.netPay)}</h2><p className="muted">Use Print / Save PDF to save a PDF copy.</p></div>
 <style jsx global>{`@media print{.no-print{display:none!important}.wrap{max-width:none!important;padding:0!important}.payslip{box-shadow:none!important;border:0!important}body{background:#fff!important}}`}</style></div>;
}