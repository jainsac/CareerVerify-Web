"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Verify(){
  const [loggedIn,setLoggedIn]=useState(false);
  useEffect(()=>{fetch("/api/me").then(r=>setLoggedIn(r.ok)).catch(()=>setLoggedIn(false));},[]);
  return <div className="wrap">
    <nav className="nav">
      <Link className="brand" href={loggedIn ? "/candidate" : "/"}>Career<span>Verify</span></Link>
      {loggedIn ? <Link className="btn alt" href="/candidate">Dashboard</Link> : <Link href="/register">Register</Link>}
    </nav>
    <div className="form card">
      <div className="pill">PUBLIC VERIFICATION</div>
      <h1>Verify a Career ID</h1>
      <p className="muted">Enter the Career ID or use a QR reference supplied by the employee. Only information approved for the verification flow should be returned.</p>
      <div className="field"><label>Career ID</label><input placeholder="CV-IND-7F82-K4M9-29X6"/></div>
      <button className="btn">Continue</button>
      <p className="notice">Aadhaar, PAN, mobile, email and private employment history are not public Career ID data.</p>
    </div>
  </div>
}