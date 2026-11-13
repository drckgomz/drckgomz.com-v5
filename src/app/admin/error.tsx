"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section className="space-y-4 p-6" role="alert">
    <h1 className="text-2xl font-semibold">Administration could not load</h1>
    <p>Please retry. If the problem continues, check the local application and database service.</p>
    <button type="button" onClick={reset} className="rounded border border-white/30 px-4 py-3">Try again</button>
  </section>;
}
