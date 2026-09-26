"use client";

import { useEffect, useState } from "react";

type D = {
  verified: boolean;
  careerId: string;
  organization: string;
  designation: string;
  joinedAt: string;
  leftAt?: string | null;
  issuedAt: string;
  documentHash?: string | null;
};

export default function LetterVerify({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params
      .then((p) =>
        fetch("/api/verification/letter/" + encodeURIComponent(p.token)),
      )
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw new Error(x.error);
        setData(x);
      })
      .catch((x) => setError(x.message));
  }, [params]);

  return (
    <div className="wrap">
      <div className="form card">
        <div className="pill">EXPERIENCE LETTER VERIFICATION</div>
        <h1>{data?.verified ? "Verified experience record" : "Experience letter verification"}</h1>
        {error ? (
          <p className="notice">{error}</p>
        ) : !data ? (
          <p className="muted">Checking verification…</p>
        ) : (
          <>
            <p>
              Career ID: <strong>{data.careerId}</strong>
            </p>
            <p><strong>{data.organization}</strong></p>
            <p>{data.designation}</p>
            <p className="muted">
              {new Date(data.joinedAt).toLocaleDateString()} –{" "}
              {data.leftAt
                ? new Date(data.leftAt).toLocaleDateString()
                : "Present"}
            </p>
            <p className="notice">
              This page verifies the registered employment record. The original private document is not publicly exposed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
