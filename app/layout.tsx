"use client";
import {useEffect,useState} from "react";
import "./globals.css"; import type {Metadata} from "next";
export default function RootLayout({children}:{children:React.ReactNode}){const [n,setN]=useState<any[]>([]);useEffect(()=>{fetch("/api/notifications").then(r=>r.ok?r.json():[]).then(setN)},[]);return <html lang="en"><body>{n.length>0&&<div className="notice" style={{margin:"12px auto",maxWidth:1100}}>You have {n.filter(x=>!x.readAt).length} unread notification(s).</div>}{children}</body></html>}
