import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { subscribeConfirm, getConfirm } from "../lib/confirm.js";

/* Mount once. Renders the themed confirm dialog for ask(). */
export default function ConfirmHost() {
  const c = useSyncExternalStore(subscribeConfirm, getConfirm);
  const okRef = useRef(null);

  useEffect(() => {
    if (!c) return;
    okRef.current && okRef.current.focus();
    const onKey = (e) => { if (e.key === "Escape") c.resolve(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c]);

  if (!c) return null;
  return createPortal(
    <div className="dlg-bk" onClick={() => c.resolve(false)}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-label={c.message} onClick={(e) => e.stopPropagation()}>
        <p>{c.message}</p>
        <div className="dlg-b">
          <button className="ghost" type="button" onClick={() => c.resolve(false)}>Cancel</button>
          <button ref={okRef} className={"btn" + (c.danger ? " danger" : "")} type="button" onClick={() => c.resolve(true)}>{c.ok}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
