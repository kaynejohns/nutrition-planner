import React from "react";
import { currentUser } from "../lib/auth";

export default function Success() {
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId) throw new Error("No session_id in URL");

        const user = currentUser();
        if (!user) throw new Error("Not logged in");

        const res = await fetch("/.netlify/functions/confirm-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!res.ok) throw new Error(await res.text());
        setDone(true);
        // Reload to update premium status
        setTimeout(() => window.location.href = "/", 2000);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#1A1A1E] text-white flex items-center justify-center p-6">
      <div className="bg-[#24242A] p-8 rounded-2xl border border-[#2E2E34] max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Welcome to Premium 🎉</h1>
        {done && <p className="text-[#A9A9B8] mb-6">Your account is now upgraded.</p>}
        {err && <p className="text-red-400 mb-6">{err}</p>}
        {!done && !err && <p className="text-[#A9A9B8] mb-6">Processing your upgrade...</p>}
        <a className="inline-block bg-[#FFCE34] text-black font-bold py-3 px-5 rounded-2xl" href="/">Go to app</a>
      </div>
    </div>
  );
}

