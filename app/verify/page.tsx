"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Verify(){
  const [loggedIn,setLoggedIn]=useState(false);
  const [checking,setChecking]=useState(true);

  useEffect(()=>{
    fetch("/api/me")
      .then(async r=>{
        if(!r.ok){
          setLoggedIn(false);
          setChecking(false);
          return;
        }
        const d=await r.json();
        if(d.role!=="EMPLOYER" && d.role!=="ADMIN"){
          window.location.replace("/candidate");
          return;
        }
        setLoggedIn(true);
        setChecking(false);
      })
      .catch(()=>{
        setLoggedIn(false);
        setChecking(false);
      });
  },[]);

  if(checking){
    return <div className="wrap"><div className="form card"><p className="muted">Loading…</p></div></div>;
  }

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
