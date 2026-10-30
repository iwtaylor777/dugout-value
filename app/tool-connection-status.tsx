"use client";
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
export function ToolConnectionStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return online ? null : <p className="tool-connection-note" role="status">You’re offline. You can keep using the data already loaded here. Keep this tab open to retain your edits; opening another page may need a connection.</p>;
}
