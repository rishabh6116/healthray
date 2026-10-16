import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth, saveTokens, clearTokens, setEditing, hasTokens, parseBlock } from "../lib/auth.js";
import { ask } from "../lib/confirm.js";
import { KeyIcon, Chevron, TrashIcon, CheckIcon } from "./Icons.jsx";

const FIELDS = [["auth", "x-auth-token"], ["dev", "x-device-token"], ["acc", "x-healthray-access-token"]];

/* Sidebar footer row -> pop-up menu above it -> form flies out to the right (like an account menu with a submenu). */
export default function CredentialsPanel() {
  const { tokens, editing } = useAuth();
  const has = hasTokens(tokens);
  const [menu, setMenu] = useState(false);
  const shown = menu || editing;           // requestAuth() (missing/expired tokens) also opens it
  const [pos, setPos] = useState(null);
  const [v, setV] = useState(tokens);
  const [msg, setMsg] = useState("");
  const cardRef = useRef(null);
  const firstRef = useRef(null);

  const close = () => { setMenu(false); setEditing(false); };

  useLayoutEffect(() => {
    if (!shown || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setPos({ left: r.left, bottom: window.innerHeight - r.top + 8, width: r.width });
  }, [shown]);

  useEffect(() => {
    if (!editing) return;
    setV(tokens); setMsg("");
    const t = setTimeout(() => firstRef.current && firstRef.current.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [editing]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);

  const onPaste = (e) => {
    const parsed = parseBlock(e.clipboardData.getData("text"));
    if (Object.keys(parsed).length) { e.preventDefault(); setV((s) => ({ ...s, ...parsed })); setMsg(""); }
  };
  const save = () => {
    if (!hasTokens({ auth: v.auth.trim(), dev: v.dev.trim(), acc: v.acc.trim() })) return setMsg("Enter at least one token.");
    saveTokens(v); setMenu(false);
  };
  const clear = async () => {
    if (await ask("Remove the saved login tokens from this browser?", { ok: "Clear", danger: true })) clearTokens();
  };

  const popup = shown && pos && (
    <>
      <div className="cm-bk" onClick={close} />
      <div className={"cm" + (editing ? " fly" : "")} style={{ left: pos.left, bottom: pos.bottom, width: pos.width }} role="menu">
        <div className="cm-menu">
          <div className="cm-hd">
            <span>Login tokens</span>
            {has ? <span className="cr-ok"><CheckIcon />Saved</span> : <span className="cr-no">Not set</span>}
          </div>
          <button type="button" role="menuitem" className={"cm-it" + (editing ? " on" : "")} onClick={() => setEditing(!editing)}>
            <KeyIcon /><span>{has ? "Edit tokens" : "Add tokens"}</span><Chevron />
          </button>
          {has && (
            <>
              <div className="cm-sep" />
              <button type="button" role="menuitem" className="cm-it bad" onClick={clear}>
                <TrashIcon /><span>Clear tokens</span>
              </button>
            </>
          )}
        </div>

        {editing && (
          <div className="cm-fly" role="dialog" aria-label="Credentials">
            <div className="cm-ft">Credentials</div>
            {FIELDS.map(([k, ph], i) => (
              <div key={k} className="cr-f">
                <label htmlFor={"cr-" + k}>{ph}{tokens[k] && <span className="cr-set">saved</span>}</label>
                <input id={"cr-" + k} ref={i === 0 ? firstRef : null} className="inp" type="password" autoComplete="off" spellCheck="false"
                  placeholder={ph} value={v[k] || ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} onPaste={onPaste}
                  onKeyDown={(e) => e.key === "Enter" && save()} />
              </div>
            ))}
            {msg && <div className="cr-hint err">{msg}</div>}
            <div className="cr-df">
              <button className="btn" type="button" onClick={save}>Save</button>
              <button className="ghost" type="button" onClick={close}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="sfoot">
      <button ref={cardRef} className={"cr-card" + (shown ? " on" : "")} type="button" aria-haspopup="menu" aria-expanded={shown}
        onClick={() => (shown ? close() : setMenu(true))}>
        <span className="cr-ic"><KeyIcon /></span>
        <span className="cr-t">Credentials</span>
        <span className="cr-s">{has ? "Saved" : "Not set"}</span>
        <Chevron />
      </button>
      {popup && createPortal(popup, document.body)}
    </div>
  );
}
