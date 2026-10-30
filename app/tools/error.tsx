"use client";
import Link from "next/link";

export default function ToolError({ reset }: { reset: () => void }) {
  return <section className="tool-loading" role="alert"><h1>This tool couldn’t load</h1><p>Check your connection, then try again. Reloading may clear edits that haven’t been saved in a trade link.</p><button type="button" onClick={reset}>Try again</button><p><Link href="/tools">Back to tools</Link></p></section>;
}
