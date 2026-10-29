"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PlayerValueDialog({ name, onClose, children }: {
  name: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return <dialog
    ref={dialogRef}
    className="player-value-dialog"
    aria-label={`${name}: value breakdown`}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}
  >
    <div className="value-dialog-bar">
      <div><strong>Why this value</strong><p>Edit the inputs to see how the estimate changes.</p></div>
      <button type="button" onClick={onClose} autoFocus aria-label="Close player value details">Close <span aria-hidden="true">×</span></button>
    </div>
    <div className="value-dialog-content">{children}</div>
    <p className="value-dialog-note">Your edits stay on this board until you reset them or reload the page.</p>
  </dialog>;
}
