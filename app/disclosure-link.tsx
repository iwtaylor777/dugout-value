"use client";
import type { ReactNode } from "react";

export function DisclosureLink({ target, children }: { target: string; children: ReactNode }) {
  return <a href={`#${target}`} onClick={() => {
    const details = document.getElementById(target);
    if (details instanceof HTMLDetailsElement) details.open = true;
  }}>{children}</a>;
}
