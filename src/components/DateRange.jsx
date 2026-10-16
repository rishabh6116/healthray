import { useEffect, useRef, useState } from "react";
import { CalIcon, Chevron } from "./Icons.jsx";
import { MN, iso, isoOf, lbl, shift } from "../lib/utils.js";

const PRESETS = [
  ["Today", () => [shift(0), shift(0)]],
  ["Yesterday", () => [shift(-1), shift(-1)]],
  ["Last 7 days", () => [shift(-6), shift(0)]],
  ["Last 30 days", () => [shift(-29), shift(0)]],
  ["This month", () => { const n = new Date(); return [iso(n.getFullYear(), n.getMonth(), 1), shift(0)]; }],
];

/* Apple-style range calendar. value = {start, end} (YYYY-MM-DD strings). */
export default function DateRange({ start, end, onChange, label = "Date range" }) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("days");
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [hover, setHover] = useState("");
  const wrap = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  // when a range is restored from outside, jump the calendar to it
  useEffect(() => {
    if (start) { const d = new Date(start + "T00:00:00"); setView({ y: d.getFullYear(), m: d.getMonth() }); }
  }, [start]);

  const openCal = (s) => {
    setStep(s);
    const ref = (s === 1 && end) || start;
    if (ref) { const d = new Date(ref + "T00:00:00"); setView({ y: d.getFullYear(), m: d.getMonth() }); }
    setMode("days");
    setOpen(true);
  };

  const onField = (e) => {
    if (open && !e.target.closest(".pill")) { setOpen(false); return; }
    openCal(e.target.id === "pe" ? 1 : 0);
  };

  const pickDay = (i) => {
    if (step === 0 || !start || i < start) { onChange(i, ""); setStep(1); }
    else { onChange(start, i); setStep(0); setOpen(false); }
  };

  const nav = (dir) => {
    if (mode === "days") {
      let { y, m } = view; m += dir;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      setView({ y, m });
    } else setView({ ...view, y: view.y + dir });
  };

  const hi = step === 1 && start && !end ? hover : "";
  const a = start, b = end || (hi && hi >= a ? hi : "");

  const cells = [];
  if (mode === "days") {
    const first = new Date(view.y, view.m, 1).getDay();
    const dim = new Date(view.y, view.m + 1, 0).getDate();
    const prev = new Date(view.y, view.m, 0).getDate();
    const td = isoOf(new Date());
    for (let p = first - 1; p >= 0; p--)
      cells.push(<div key={"p" + p} className="c out"><button type="button" className="d" tabIndex={-1}>{prev - p}</button></div>);
    for (let d = 1; d <= dim; d++) {
      const i = iso(view.y, view.m, d);
      const cls = ["c", i === td && "today", (i === start || i === end) && "sel",
        a && b && i > a && i < b && "in", a && b && i === a && b > a && "rs", a && b && i === b && b > a && "re"].filter(Boolean).join(" ");
      cells.push(<div key={i} className={cls} onMouseOver={() => step === 1 && !end && setHover(i)}>
        <button type="button" className="d" onClick={() => pickDay(i)}>{d}</button></div>);
    }
    const used = first + dim, rem = used % 7 ? 7 - (used % 7) : 0;
    for (let n = 1; n <= rem; n++)
      cells.push(<div key={"n" + n} className="c out"><button type="button" className="d" tabIndex={-1}>{n}</button></div>);
  }

  return (
    <div className="rng" ref={wrap}>
      <label>{label}</label>
      <div className={"rfield" + (open ? " open" : "")} tabIndex={0} onClick={onField}>
        <CalIcon />
        <div className="seg">
          <span id="ps" className={"pill" + (start ? " has" : "") + (open && step === 0 ? " on" : "")}>{start ? lbl(start) : "Start date"}</span>
          <span className="arrow">→</span>
          <span id="pe" className={"pill" + (end ? " has" : "") + (open && step === 1 ? " on" : "")}>{end ? lbl(end) : "End date"}</span>
        </div>
      </div>
      <div className={"pop" + (open ? " open" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p[0]} type="button" className="pr" onClick={() => { const [s, e] = p[1](); onChange(s, e); setStep(0); setOpen(false); }}>{p[0]}</button>
          ))}
        </div>
        <div className="ch">
          <button type="button" className={"ttl" + (mode === "months" ? " up" : "")} onClick={() => setMode(mode === "days" ? "months" : "days")}>
            {mode === "days" ? `${MN[view.m]} ${view.y}` : view.y}<Chevron />
          </button>
          <div className="nav">
            <button type="button" className="nb" onClick={() => nav(-1)}><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button>
            <button type="button" className="nb" onClick={() => nav(1)}><Chevron /></button>
          </div>
        </div>
        {mode === "days" ? (
          <>
            <div className="wk">{["S","M","T","W","T","F","S"].map((w, i) => <div key={i}>{w}</div>)}</div>
            <div className="days" onMouseLeave={() => setHover("")}>{cells}</div>
          </>
        ) : (
          <div className="mg">
            {MN.map((n, i) => (
              <button key={n} type="button" className={"mo" + (i === view.m ? " sel" : "")} onClick={() => { setView({ ...view, m: i }); setMode("days"); }}>{n.slice(0, 3)}</button>
            ))}
          </div>
        )}
        <div className="cf">
          <button type="button" className="lnk" onClick={() => { onChange("", ""); setStep(0); }}>Clear</button>
          <span className="hint">{step === 0 ? "Select start date" : "Select end date"}</span>
          <button type="button" className="lnk" onClick={() => { const n = new Date(); setView({ y: n.getFullYear(), m: n.getMonth() }); setMode("days"); }}>Today</button>
        </div>
      </div>
    </div>
  );
}
