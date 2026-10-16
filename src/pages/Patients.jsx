import { useEffect, useMemo, useRef, useState } from "react";
import Shell from "../components/Shell.jsx";
import DateRange from "../components/DateRange.jsx";
import { Count, Metric } from "../components/Metric.jsx";
import { Chevron } from "../components/Icons.jsx";
import { getState, hasTokens, requestAuth, authHeaders } from "../lib/auth.js";
import { money, isoOf, lbl, MN, pretty, ssGet, ssSet } from "../lib/utils.js";

const PATIENTS_URL = "https://labapi.healthray.com/api/v1/patient?page=1&per_page=25";
const SK = "patientsSession", SF = "patientsFilters";

const ist = (d) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t)
    ? t.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
};

/* ---------- patient model (tolerant to different response shapes) ---------- */
const pick = (o, ...ks) => { for (const k of ks) { const v = o && o[k]; if (v != null && v !== "" && typeof v !== "object") return v; } return ""; };
const addrStr = (a) => (!a ? "" : typeof a === "string" ? a : [a.house_no, a.street_address, a.address1, a.address, a.city, a.state, a.zipcode].filter(Boolean).join(", "));
const ageOf = (d) => {
  if (!d) return ""; const t = new Date(d); if (isNaN(t)) return "";
  const n = new Date(); let a = n.getFullYear() - t.getFullYear();
  if (n.getMonth() < t.getMonth() || (n.getMonth() === t.getMonth() && n.getDate() < t.getDate())) a--;
  return a >= 0 && a < 130 ? a : "";
};
const GEN = { m: "Male", male: "Male", f: "Female", female: "Female", o: "Other", other: "Other" };
function norm(r) {
  const b = r.patient && typeof r.patient === "object" ? Object.assign({}, r, r.patient) : r;
  const u = b.user && typeof b.user === "object" ? b.user : {};
  const fm = b.family_member && typeof b.family_member === "object" ? b.family_member : {};
  const A = b.address && typeof b.address === "object" ? b.address : (u.address && typeof u.address === "object" ? u.address : {});
  const name = pick(b, "name", "patient_name", "full_name") ||
    [pick(b, "title"), pick(b, "first_name") || pick(u, "first_name"), pick(b, "middle_name") || pick(u, "middle_name"), pick(b, "last_name") || pick(u, "last_name")].filter(Boolean).join(" ");
  const mob = pick(b, "mobile_no", "mobile_number", "mobile", "phone") || pick(u, "mobile_number", "mobile_no");
  const cc = pick(b, "country_code") || pick(u, "country_code");
  const dob = pick(b, "birth_date", "dob", "date_of_birth") || pick(fm, "birth_date") || pick(u, "birth_date");
  const g0 = String(pick(b, "gender", "sex") || pick(fm, "gender") || "").trim();
  return {
    raw: r, id: pick(r, "id") || pick(b, "id"), name: name || "(no name)", mob, mobile: mob ? ((cc || "") + " " + mob).trim() : "",
    gender: GEN[g0.toLowerCase()] || g0, dob: b.birth_date_in === "Year" ? "" : dob, exact: b.birth_date_in !== "Year", age: pick(b, "age") || ageOf(dob),
    pid: pick(b, "dynamic_unique_id", "patient_id", "patient_unique_id", "uhid", "healthray_uid", "patient_number", "unique_id"),
    email: pick(b, "email") || pick(u, "email"),
    address: typeof b.address === "string" ? b.address : addrStr(b.address || u.address), city: String(pick(A, "city") || pick(A, "house_no")).trim().toUpperCase(),
    reg: pick(b, "created_at", "registered_on", "registered_at", "registration_date") || pick(r, "created_at"),
    balance: b.balance != null && typeof b.balance !== "object" ? b.balance : "",
  };
}

const GROUPS = [
  { k: "gen", t: "Gender", open: 1, get: (p) => [p.gender || "Unknown"] },
  { k: "city", t: "City / Area", open: 1, find: 1, get: (p) => [p.city] },
  { k: "mon", t: "Registered month", open: 1, get: (p) => { const d = p.reg ? new Date(p.reg) : null; return d && !isNaN(d) ? [MN[d.getMonth()].slice(0, 3) + " " + d.getFullYear()] : []; } },
  { k: "mob", t: "Mobile", get: (p) => [p.mob ? "Has mobile" : "No mobile"] },
  { k: "bal", t: "Balance", get: (p) => (p.balance === "" ? [] : [+p.balance > 0 ? "Due" : "Clear"]) },
];
const hay = (p) => [p.name, p.mobile, p.pid, p.email, p.address].join(" ").toLowerCase();

const Row = ({ k, v }) => (<><dt>{k}</dt><dd>{v}</dd></>);
const DL = ({ rows }) => (
  <dl>{rows.filter((x) => x[1] !== "" && x[1] != null).map((x) => <Row key={x[0]} k={x[0]} v={x[1]} />)}</dl>
);

function PatientCard({ p }) {
  const more = Object.entries(p.raw).filter(([, v]) => v != null && v !== "" && typeof v !== "object").map(([k, v]) => [k.replace(/_/g, " "), v]);
  return (
    <article className="oc">
      <div className="oh"><strong>{p.name}</strong>
        {p.gender && <span className="bd">{p.gender}</span>}
        {p.age !== "" && <span className="bd">{p.exact ? "" : "~"}{p.age} yrs</span>}
        {p.pid && <span className="bd">{p.pid}</span>}
        <span className="dt">{ist(p.reg)}</span></div>
      <div className="ob">
        <div><h4>Contact</h4><DL rows={[["Mobile", p.mobile], ["Email", p.email], ["Address", p.address]]} /></div>
        <div><h4>Details</h4><DL rows={[["DOB", p.dob], ["Patient ID", p.pid], ["Registered", ist(p.reg)], ["Balance", p.balance !== "" ? money(p.balance) : ""]]} /></div>
      </div>
      {more.length > 0 && <details className="more"><summary>All fields ({more.length})</summary><DL rows={more} /></details>}
    </article>
  );
}

function PatientTable({ rows }) {
  return (
    <div className="tbl tw" style={{ border: 0 }}><table>
      <thead><tr><th>Patient</th><th>Mobile</th><th>Gender / Age</th><th>Address</th><th>Registered</th></tr></thead>
      <tbody>{rows.map((p, i) => (
        <tr key={p.id || i}>
          <td><strong>{p.name}</strong><div className="sm">{p.pid}</div></td>
          <td>{p.mobile}</td>
          <td>{p.gender}{p.age !== "" ? ` · ${p.exact ? "" : "~"}${p.age}` : ""}</td>
          <td className="ad">{p.address}</td>
          <td>{ist(p.reg)}</td>
        </tr>))}
      </tbody>
    </table></div>
  );
}

export default function Patients() {
  const [data, setData] = useState([]);
  const [pages, setPages] = useState(1);
  const [range, setRange] = useState({ start: "", end: "" });
  const [pp, setPp] = useState(50);
  const [mp, setMp] = useState("0");
  const [view, setView] = useState("card");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState({});
  const [age, setAge] = useState({ min: "", max: "" });
  const [fsearch, setFsearch] = useState({});
  const [fold, setFold] = useState(() => { const o = Object.fromEntries(GROUPS.map((g) => [g.k, !g.open])); o.age = true; return o; });
  const [status, setStatus] = useState({ msg: "", err: false });
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    const d = ssGet(SK);
    if (d && Array.isArray(d.data) && d.data.length) {
      setData(d.data); setPages(d.pages || 1);
      setRange({ start: d.start || "", end: d.end || "" });
      if (d.pp) setPp(d.pp); if (d.mp) setMp(d.mp);
      const f = ssGet(SF);
      if (f) { setSel(f.sel || {}); setAge(f.age || { min: "", max: "" }); setQ(f.q || ""); setView(f.view === "table" ? "table" : "card"); }
      setStatus({ msg: `${d.data.length} patients · ${d.pages || 1} page(s)`, err: false });
    }
    hydrated.current = true;
  }, []);
  useEffect(() => { if (hydrated.current && data.length) ssSet(SF, { sel, age, q, view }); }, [sel, age, q, view, data.length]);

  const passes = (p, skip) => {
    for (const g of GROUPS) {
      if (g.k === skip) continue;
      const s = sel[g.k]; if (!s || !s.length) continue;
      if (!g.get(p).some((v) => s.includes(v))) return false;
    }
    if (skip !== "age" && (age.min !== "" || age.max !== "")) {
      if (p.age === "") return false;
      if (age.min !== "" && +p.age < +age.min) return false;
      if (age.max !== "" && +p.age > +age.max) return false;
    }
    return true;
  };
  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return data.filter((p) => passes(p) && (!qq || hay(p).includes(qq)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sel, age, q]);

  const facets = useMemo(() => GROUPS.map((g) => {
    const all = new Map();
    data.forEach((p) => g.get(p).filter(Boolean).forEach((v) => all.set(v, (all.get(v) || 0) + 1)));
    const vals = [...all.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    if (vals.length < 2) return null;
    const cnt = new Map();
    data.forEach((p) => { if (passes(p, g.k)) g.get(p).forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1)); });
    return { g, vals, cnt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, sel, age]);

  const toggle = (k, v, on) => setSel((s) => { const c = new Set(s[k] || []); on ? c.add(v) : c.delete(v); return { ...s, [k]: [...c] }; });
  const clearAll = () => { setSel({}); setAge({ min: "", max: "" }); };
  const err = (m) => setStatus({ msg: m, err: true });

  const fetchPatients = async () => {
    setStatus({ msg: "", err: false });
    const t = getState().tokens;
    if (!hasTokens(t)) { requestAuth(); return err("Save your login tokens in the sidebar first."); }
    const r = { url: PATIENTS_URL, method: "GET", headers: authHeaders(t), body: "" };
    if (range.start && !range.end) return err("Pick the end date too (or clear the range).");
    setLoading(true); setStatus({ msg: "Fetching patients…", err: false });
    try {
      const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r, start: range.start, end: range.end, per_page: +pp || 50, max_pages: +mp || 0 }) });
      const j = await res.json();
      if (!res.ok || j.error) {
        const m = j.error || "Server error: " + res.status;
        if (/\b(401|403)\b|expired|unauthori/i.test(m)) { requestAuth(); err(m + " Update your login tokens in the sidebar."); } else err(m);
        return;
      }
      const rows = (j.data || []).map(norm);
      setData(rows); setPages(j.pages || 1); clearAll();
      setStatus({ msg: `${rows.length} patients · ${j.pages} page(s)`, err: false });
      ssSet(SK, { data: rows, pages: j.pages, start: range.start, end: range.end, pp, mp });
      try { sessionStorage.removeItem(SF); } catch {}
    } catch (e) { err("Connection error: " + e.message); }
    finally { setLoading(false); }
  };

  const rangeTag = `${range.start || "all"}_to_${range.end || "all"}`;
  const exportCsv = () => {
    const H = ["Name", "Patient ID", "Mobile", "Gender", "Age", "DOB", "Email", "Address", "City", "Registered (IST)", "Balance"];
    const qt = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = filtered.map((p) => [p.name, p.pid, p.mobile, p.gender, p.age, p.dob, p.email, p.address, p.city, ist(p.reg), p.balance]);
    const blob = new Blob(["\ufeff" + [H.map(qt).join(","), ...rows.map((r) => r.map(qt).join(","))].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `patients_${rangeTag}.csv`; a.click();
  };
  const printPdf = () => {
    if (!filtered.length) return;
    setPrinting(true);
    const t = document.title; document.title = `patients_${rangeTag}`;
    const done = () => { document.title = t; setPrinting(false); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 60);
  };

  const ageOn = age.min !== "" || age.max !== "";
  const chips = [];
  GROUPS.forEach((g) => (sel[g.k] || []).forEach((v) => chips.push({ k: g.k, v })));
  const printFilters = [
    ...GROUPS.filter((g) => (sel[g.k] || []).length).map((g) => `${g.t}: ${sel[g.k].map(pretty).join(", ")}`),
    ...(ageOn ? [`Age: ${age.min || 0} – ${age.max || "max"}`] : []),
    ...(q.trim() ? [`Search: ${q.trim()}`] : []),
  ];

  const ages = filtered.filter((p) => p.age !== "").map((p) => +p.age).filter((x) => !isNaN(x));
  const td = isoOf(new Date());
  const regToday = filtered.filter((p) => p.reg && !isNaN(new Date(p.reg)) && isoOf(new Date(p.reg)) === td).length;

  const sideHeader = <div className="sh"><span>Filters</span><button className="lnk" type="button" onClick={clearAll}>Clear all</button></div>;
  const side = (
    <div>
      {facets.map((f) => f && (
        <section key={f.g.k} className={"fg" + (fold[f.g.k] ? " closed" : "")}>
          <button className="fgh" type="button" onClick={() => setFold((s) => ({ ...s, [f.g.k]: !s[f.g.k] }))}>
            <span>{f.g.t}</span><em className="fgc">{(sel[f.g.k] || []).length || ""}</em><Chevron />
          </button>
          <div className="fgb">
            {f.g.find && <input className="fs" placeholder={`Search ${f.g.t.toLowerCase()}`} value={fsearch[f.g.k] || ""}
              onChange={(e) => setFsearch((s) => ({ ...s, [f.g.k]: e.target.value }))} />}
            <div className="fl">
              {f.vals.map((v) => {
                const on = (sel[f.g.k] || []).includes(v), n = f.cnt.get(v) || 0;
                const hidden = f.g.find && fsearch[f.g.k] && !String(v).toLowerCase().includes(fsearch[f.g.k].toLowerCase());
                return (
                  <label key={v} className={"fi" + (on ? " on" : "") + (!n && !on ? " zero" : "")} hidden={!!hidden}>
                    <input type="checkbox" checked={on} onChange={(e) => toggle(f.g.k, v, e.target.checked)} />
                    <span className="cb" /><span className="fn">{pretty(v)}</span><span className="fc">{n}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      ))}
      {!!data.length && (
        <section className={"fg" + (fold.age ? " closed" : "")}>
          <button className="fgh" type="button" onClick={() => setFold((s) => ({ ...s, age: !s.age }))}>
            <span>Age</span><em className="fgc">{ageOn ? 1 : ""}</em><Chevron />
          </button>
          <div className="fgb"><div className="amt">
            <input type="number" min="0" placeholder="Min age" value={age.min} onChange={(e) => setAge({ ...age, min: e.target.value })} />
            <input type="number" min="0" placeholder="Max age" value={age.max} onChange={(e) => setAge({ ...age, max: e.target.value })} />
          </div></div>
        </section>
      )}
    </div>
  );

  return (
    <Shell title="Patients" subtitle="Diagnostics" sideHeader={sideHeader} side={side}>
      {printing && (
        <div className="phead">
          <div className="ph1"><img src="/logo.png" alt="" /><h1>Patients Report</h1>
            <div className="pm">{range.start ? `${lbl(range.start)} – ${lbl(range.end)}` : "All dates"}<br />{filtered.length} of {data.length} patients · {view === "card" ? "Detailed" : "Summary"} view<br />Generated {ist(new Date())}</div></div>
          <div className="pf">{printFilters.length ? "Filters: " + printFilters.join("  ·  ") : "Filters: none (all fetched patients)"}</div>
        </div>
      )}

      <section className="panel">
        <div className="form">
          <div>
            <DateRange start={range.start} end={range.end} onChange={(s, e) => setRange({ start: s, end: e })} label="Registered between (optional)" />
          </div>
          <div><label htmlFor="pp">Batch size</label>
            <input id="pp" className="inp" type="number" min="1" max="500" value={pp} onChange={(e) => setPp(e.target.value)} /></div>
          <div><label htmlFor="mp">Pages</label>
            <select id="mp" className="inp" value={mp} onChange={(e) => setMp(e.target.value)}>
              <option value="0">All pages</option><option value="1">First page only</option><option value="5">First 5 pages</option></select></div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={fetchPatients} disabled={loading}>Fetch patients</button>
          <span id="status" className={status.err ? "err" : ""}>{status.msg}</span>
        </div>
      </section>

      <div className="metrics">
        <Metric cls="blue" label="Total patients" icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>}><Count to={filtered.length} /></Metric>
        <Metric cls="teal" label="With mobile" icon={<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />}><Count to={filtered.filter((p) => p.mob).length} /></Metric>
        <Metric cls="violet" label="Male" icon={<><circle cx="10" cy="14" r="5" /><path d="M14 10l7-7M15 3h6v6" /></>}><Count to={filtered.filter((p) => p.gender === "Male").length} /></Metric>
        <Metric cls="rose" label="Female" icon={<><circle cx="12" cy="9" r="5" /><path d="M12 14v8M9 19h6" /></>}><Count to={filtered.filter((p) => p.gender === "Female").length} /></Metric>
        <Metric cls="green" label="Registered today" icon={<><circle cx="12" cy="12" r="10" /><path d="M8 12.5l3 3 5-6" /></>}><Count to={regToday} /></Metric>
        <Metric cls="amber" label="Average age" icon={<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>}><Count to={ages.length ? Math.round(ages.reduce((s, x) => s + x, 0) / ages.length) : 0} /></Metric>
      </div>

      <div className="bar">
        <div className="bl">
          <input className="search" placeholder="Search patients" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="res">{data.length ? `${filtered.length} of ${data.length} patients` : ""}</span>
        </div>
        <div className="bl">
          <div className="vs">
            <button className={"tab" + (view === "card" ? " on" : "")} type="button" onClick={() => setView("card")}>Cards</button>
            <button className={"tab" + (view === "table" ? " on" : "")} type="button" onClick={() => setView("table")}>Table</button>
          </div>
          <button className="ghost" type="button" disabled={!data.length} onClick={exportCsv}>Export CSV</button>
          <button className="ghost" type="button" disabled={!data.length} onClick={printPdf}>Print PDF</button>
        </div>
      </div>

      <div className="act">
        {chips.map((c) => <button key={c.k + c.v} className="fchip" type="button" onClick={() => toggle(c.k, c.v, false)}>{pretty(c.v)}<span>×</span></button>)}
        {ageOn && <button className="fchip" type="button" onClick={() => setAge({ min: "", max: "" })}>Age {age.min || 0} – {age.max || "max"}<span>×</span></button>}
      </div>

      <div>
        {loading ? <><div className="sk" /><div className="sk" /></>
          : !data.length ? <div className="empty">Save your login tokens (sidebar), then tap <strong>Fetch patients</strong>.</div>
          : !filtered.length ? <div className="empty">No patients match these filters.</div>
          : view === "card" ? filtered.map((p, i) => <PatientCard key={p.id || i} p={p} />)
          : <PatientTable rows={filtered} />}
      </div>
    </Shell>
  );
}
