import { useEffect, useMemo, useRef, useState } from "react";
import Shell from "../components/Shell.jsx";
import DateRange from "../components/DateRange.jsx";
import { Chevron } from "../components/Icons.jsx";
import { getState, requestAuth, authHeaders } from "../lib/auth.js";
import { money, ist, pname, tests, total, lbl, uniq, pretty, ssGet, ssSet } from "../lib/utils.js";

const SK = "labOrdersSession", SF = "labOrdersFilters";

const GROUPS = [
  { k: "pay", t: "Payment", open: 1, get: (o) => [o.is_paid ? "Paid" : "Unpaid"] },
  { k: "st", t: "Order status", open: 1, get: (o) => [o.status] },
  { k: "doc", t: "Doctor", open: 1, get: (o) => [o.doctor?.user_name] },
  { k: "cat", t: "Category", open: 1, get: (o) => uniq(tests(o).map((t) => t.ipd_category?.category_name)) },
  { k: "test", t: "Test", open: 1, find: 1, get: (o) => uniq(tests(o).map((t) => t.billing_item?.name)) },
  { k: "tst", t: "Test status", get: (o) => uniq(tests(o).map((t) => t.status)) },
  { k: "staff", t: "Created by", get: (o) => [o.created_by?.user_name] },
  { k: "mode", t: "Payment mode", get: (o) => [o.payer_details?.payment_type || "Cash"] },
  { k: "type", t: "Order type", get: (o) => [(o.lab_order_type || "").toUpperCase()] },
  { k: "gen", t: "Gender", get: (o) => [o.case?.family_member?.gender || "Unknown"] },
];

const hay = (o) =>
  [pname(o), o.patient?.mobile_no, o.case?.patient_case_id, o.lab_order_no, o.doctor?.user_name, ...tests(o).map((t) => t.billing_item?.name)]
    .join(" ").toLowerCase();

const addr = (a) => (a ? [a.house_no, a.street_address, a.address, a.city, a.state, a.zipcode].filter(Boolean).join(", ") : "");

function DL({ rows }) {
  return (
    <dl>
      {rows.filter((x) => x[1] !== "" && x[1] != null).map((x) => (
        <FragmentRow key={x[0]} k={x[0]} v={x[1]} />
      ))}
    </dl>
  );
}
const FragmentRow = ({ k, v }) => (<><dt>{k}</dt><dd>{v}</dd></>);

function OrderCard({ o }) {
  const p = o.patient || {}, c = o.case || {}, fm = c.family_member || {}, d = o.doctor || {}, cb = o.created_by || {}, py = o.payer_details || {};
  return (
    <article className="oc">
      <div className="oh">
        <strong>{o.lab_order_no}</strong><span className="bd">{o.status}</span>
        <span className={"bd " + (o.is_paid ? "paid" : "unpaid")}>{o.is_paid ? "Paid" : "Unpaid"}</span>
        <span className="bd">{(o.lab_order_type || "").toUpperCase()}</span>
        <span className="dt">{ist(o.order_date)}</span>
      </div>
      <div className="ob">
        <div><h4>Patient</h4>
          <DL rows={[["Name", pname(o)], ["Case ID", c.patient_case_id],
            ["Mobile", p.mobile_no ? (p.country_code || "") + " " + p.mobile_no : ""],
            ["Gender / DOB", fm.gender ? `${fm.gender} (${fm.birth_date || ""})` : ""],
            ["Address", addr(p.address)], ["Balance", p.balance != null ? money(p.balance) : ""]]} />
        </div>
        <div><h4>Order</h4>
          <DL rows={[["Doctor", d.user_name], ["Hospital", o.organization && o.organization.name], ["Staff", cb.user_name],
            ["Created", ist(o.created_at)], ["Payment", py.payment_type || "Cash"]]} />
        </div>
      </div>
      <div className="tt"><table>
        <thead><tr><th>Test</th><th>Category</th><th>Status</th><th>Sample no</th><th>Price</th></tr></thead>
        <tbody>
          {tests(o).map((t, i) => (
            <tr key={i}>
              <td><strong>{t.billing_item?.name}</strong></td>
              <td className="sm">{t.ipd_category?.category_name}</td>
              <td><span className="bd">{t.status}</span></td>
              <td>{t.lbo_no}</td>
              <td><strong>{money(t.price)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="of">{tests(o).length} test(s) · Total {money(total(o))}</div>
    </article>
  );
}

function TableView({ rows }) {
  return (
    <div className="tbl tw" style={{ border: 0 }}><table>
      <thead><tr><th>Order</th><th>Date</th><th>Patient</th><th>Doctor</th><th>Tests</th><th>Payment</th><th>Total</th></tr></thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id ?? o.lab_order_no}>
            <td><strong>{o.lab_order_no}</strong><div className="sm">{(o.lab_order_type || "").toUpperCase()}</div></td>
            <td>{ist(o.order_date)}</td>
            <td><strong>{pname(o)}</strong><div className="sm">{o.patient?.mobile_no || ""}</div></td>
            <td>{o.doctor?.user_name || ""}</td>
            <td><span className="bd">{tests(o).length} test(s)</span>
              <div className="sm">{tests(o).map((t) => t.billing_item?.name).filter(Boolean).slice(0, 2).join(", ")}{tests(o).length > 2 ? "…" : ""}</div></td>
            <td><span className={"bd " + (o.is_paid ? "paid" : "unpaid")}>{o.is_paid ? "Paid" : "Unpaid"}</span>
              <div className="sm">{o.payer_details?.payment_type || "Cash"}</div></td>
            <td><strong>{money(total(o))}</strong></td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

/* animated number */
function Count({ to, fmt = String }) {
  const [v, setV] = useState(to);
  const from = useRef(0);
  useEffect(() => {
    const t0 = performance.now(), a = from.current; let raf;
    const f = (t) => {
      const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (to - a) * e));
      if (k < 1) raf = requestAnimationFrame(f); else from.current = to;
    };
    raf = requestAnimationFrame(f);
    return () => { cancelAnimationFrame(raf); from.current = to; };
  }, [to]);
  return <>{fmt(v)}</>;
}

const Metric = ({ cls, icon, label, children }) => (
  <div className={"m " + cls}>
    <div className="chip"><svg viewBox="0 0 24 24">{icon}</svg></div>
    <div><div className="l">{label}</div><div className="v">{children}</div></div>
  </div>
);

export default function LabOrders() {
  const [data, setData] = useState([]);
  const [pages, setPages] = useState(1);
  const [range, setRange] = useState({ start: "", end: "" });
  const [pp, setPp] = useState(50);
  const [ord, setOrd] = useState("DESC");
  const [view, setView] = useState("card");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState({});            // {groupKey: [values]}
  const [amt, setAmt] = useState({ min: "", max: "" });
  const [fsearch, setFsearch] = useState({});
  const [status, setStatus] = useState({ msg: "", err: false });
  const [loading, setLoading] = useState(false);
  const hydrated = useRef(false);

  const [fold, setFold] = useState(() => {
    const o = Object.fromEntries(GROUPS.map((g) => [g.k, !g.open])); o.amt = true; return o;
  });

  /* restore previous session (cleared when the tab closes) */
  useEffect(() => {
    const d = ssGet(SK);
    if (d && Array.isArray(d.data) && d.data.length) {
      setData(d.data); setPages(d.pages || 1);
      setRange({ start: d.start || "", end: d.end || "" });
      if (d.pp) setPp(d.pp); if (d.ord) setOrd(d.ord);
      const f = ssGet(SF);
      if (f) { setSel(f.sel || {}); setAmt(f.amt || { min: "", max: "" }); setQ(f.q || ""); setView(f.view === "table" ? "table" : "card"); }
      setStatus({ msg: `${d.data.length} orders · ${d.pages || 1} page(s)`, err: false });
    }
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (!hydrated.current || !data.length) return;
    ssSet(SF, { sel, amt, q, view });
  }, [sel, amt, q, view, data.length]);

  const passes = (o, skip) => {
    for (const g of GROUPS) {
      if (g.k === skip) continue;
      const s = sel[g.k]; if (!s || !s.length) continue;
      if (!g.get(o).some((v) => s.includes(v))) return false;
    }
    if (skip !== "amt") {
      const t = total(o);
      if (amt.min !== "" && t < +amt.min) return false;
      if (amt.max !== "" && t > +amt.max) return false;
    }
    return true;
  };

  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return data.filter((o) => passes(o) && (!qq || hay(o).includes(qq)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sel, amt, q]);

  const facets = useMemo(() => GROUPS.map((g) => {
    const all = new Map();
    data.forEach((o) => g.get(o).forEach((v) => all.set(v, (all.get(v) || 0) + 1)));
    const vals = [...all.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    if (vals.length < 2) return null;
    const cnt = new Map();
    data.forEach((o) => { if (passes(o, g.k)) g.get(o).forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1)); });
    return { g, vals, cnt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, sel, amt]);

  const toggle = (k, v, on) => setSel((s) => {
    const cur = new Set(s[k] || []); on ? cur.add(v) : cur.delete(v);
    return { ...s, [k]: [...cur] };
  });
  const clearAll = () => { setSel({}); setAmt({ min: "", max: "" }); };

  const err = (m) => setStatus({ msg: m, err: true });

  const fetchOrders = async () => {
    setStatus({ msg: "", err: false });
    const t = getState().tokens;
    if (!t.acc) { requestAuth(); return err("Save your login tokens in the sidebar first."); }
    if (!range.start || !range.end) return err("Pick a start and end date.");
    setLoading(true); setStatus({ msg: "Fetching orders…", err: false });
    try {
      const res = await fetch("/fetch", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t.acc, headers: authHeaders(t), start: range.start, end: range.end, per_page: +pp || 50, order: ord }) });
      const j = await res.json();
      if (!res.ok || j.error) {
        const m = j.error || "Server error: " + res.status;
        if (/\b(401|403)\b|expired|unauthori/i.test(m)) { requestAuth(); err(m + " Update your login tokens in the sidebar."); } else err(m);
        return;
      }
      const rows = j.data || [];
      setData(rows); setPages(j.pages || 1); clearAll();
      setStatus({ msg: `${rows.length} orders · ${j.pages} page(s)`, err: false });
      ssSet(SK, { data: rows, pages: j.pages, start: range.start, end: range.end, pp, ord });
      try { sessionStorage.removeItem(SF); } catch {}
    } catch (e) { err("Connection error: " + e.message); }
    finally { setLoading(false); }
  };

  const exportCsv = () => {
    const H = ["Order no", "Order date (IST)", "Status", "Order paid", "Order type", "Patient", "Case ID", "Mobile", "Doctor", "Test", "Category", "Price"];
    const qt = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`, rows = [];
    filtered.forEach((o) => {
      const p = o.patient || {}, c = o.case || {};
      const base = [o.lab_order_no, ist(o.order_date), o.status, o.is_paid ? "Yes" : "No", o.lab_order_type, pname(o), c.patient_case_id, p.mobile_no, o.doctor?.user_name];
      (tests(o).length ? tests(o) : [{}]).forEach((t) => rows.push([...base, t.billing_item?.name, t.ipd_category?.category_name, t.price]));
    });
    const blob = new Blob(["\ufeff" + [H.map(qt).join(","), ...rows.map((r) => r.map(qt).join(","))].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `lab_orders_${range.start || "start"}_to_${range.end || "end"}.csv`; a.click();
  };

  /* print header is rendered in React, then the browser print dialog opens */
  const [printing, setPrinting] = useState(false);
  const printPdf = () => {
    if (!filtered.length) return;
    setPrinting(true);
    const t = document.title;
    document.title = `lab_orders_${range.start || "start"}_to_${range.end || "end"}`;
    const done = () => { document.title = t; setPrinting(false); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 60);
  };

  const filterChips = [];
  GROUPS.forEach((g) => (sel[g.k] || []).forEach((v) => filterChips.push({ k: g.k, v, label: pretty(v) })));
  const amtOn = amt.min !== "" || amt.max !== "";
  const printFilters = [
    ...GROUPS.filter((g) => (sel[g.k] || []).length).map((g) => `${g.t}: ${sel[g.k].map(pretty).join(", ")}`),
    ...(amtOn ? [`Amount: ₹${amt.min || 0} – ${amt.max || "max"}`] : []),
    ...(q.trim() ? [`Search: ${q.trim()}`] : []),
  ];

  const sum = (f) => filtered.reduce((s, o) => s + f(o), 0);
  const sideHeader = (
    <div className="sh"><span>Filters</span><button className="lnk" type="button" onClick={clearAll}>Clear all</button></div>
  );
  const side = (
    <div>
      {facets.map((f) => f && (
        <section key={f.g.k} className={"fg" + (fold[f.g.k] ? " closed" : "")}>
          <button className="fgh" type="button" onClick={() => setFold((s) => ({ ...s, [f.g.k]: !s[f.g.k] }))}>
            <span>{f.g.t}</span><em className="fgc">{(sel[f.g.k] || []).length || ""}</em><Chevron />
          </button>
          <div className="fgb">
            {f.g.find && <input className="fs" placeholder={`Search ${f.g.t.toLowerCase()}s`} value={fsearch[f.g.k] || ""}
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
        <section className={"fg" + (fold.amt ? " closed" : "")}>
          <button className="fgh" type="button" onClick={() => setFold((s) => ({ ...s, amt: !s.amt }))}>
            <span>Order amount</span><em className="fgc">{amtOn ? 1 : ""}</em><Chevron />
          </button>
          <div className="fgb"><div className="amt">
            <input type="number" min="0" placeholder="Min ₹" value={amt.min} onChange={(e) => setAmt({ ...amt, min: e.target.value })} />
            <input type="number" min="0" placeholder="Max ₹" value={amt.max} onChange={(e) => setAmt({ ...amt, max: e.target.value })} />
          </div></div>
        </section>
      )}
    </div>
  );

  return (
    <Shell title="Lab Orders" subtitle="Diagnostics" sideHeader={sideHeader} side={side}>
      {printing && (
        <div className="phead">
          <div className="ph1"><img src="/logo.png" alt="" /><h1>Lab Orders Report</h1>
            <div className="pm">{lbl(range.start)} – {lbl(range.end)}<br />{filtered.length} of {data.length} orders · {view === "card" ? "Detailed" : "Summary"} view<br />Generated {ist(new Date())}</div></div>
          <div className="pf">{printFilters.length ? "Filters: " + printFilters.join("  ·  ") : "Filters: none (all fetched orders)"}</div>
        </div>
      )}

      <section className="panel">
        <div className="form">
          <DateRange start={range.start} end={range.end} onChange={(s, e) => setRange({ start: s, end: e })} />
          <div><label htmlFor="pp">Batch size</label>
            <input id="pp" className="inp" type="number" min="1" max="500" value={pp} onChange={(e) => setPp(e.target.value)} /></div>
          <div><label htmlFor="ord">Order</label>
            <select id="ord" className="inp" value={ord} onChange={(e) => setOrd(e.target.value)}>
              <option value="DESC">Newest first</option><option value="ASC">Oldest first</option></select></div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={fetchOrders} disabled={loading}>Fetch orders</button>
          <span id="status" className={status.err ? "err" : ""}>{status.msg}</span>
        </div>
      </section>

      <div className="metrics">
        <Metric cls="blue" label="Total orders" icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></>}><Count to={filtered.length} /></Metric>
        <Metric cls="rose" label="Total tests" icon={<path d="M22 12h-4l-3 9L9 3l-3 9H2" />}><Count to={sum((o) => tests(o).length)} /></Metric>
        <Metric cls="teal" label="Unpaid orders" icon={<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>}><Count to={filtered.filter((o) => !o.is_paid).length} /></Metric>
        <Metric cls="amber" label="Total billed" icon={<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />}><Count to={sum(total)} fmt={money} /></Metric>
        <Metric cls="green" label="Paid amount" icon={<><circle cx="12" cy="12" r="10" /><path d="M8 12.5l3 3 5-6" /></>}><Count to={filtered.filter((o) => o.is_paid).reduce((s, o) => s + total(o), 0)} fmt={money} /></Metric>
        <Metric cls="violet" label="Unpaid amount" icon={<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />}><Count to={filtered.filter((o) => !o.is_paid).reduce((s, o) => s + total(o), 0)} fmt={money} /></Metric>
      </div>

      <div className="bar">
        <div className="bl">
          <input className="search" placeholder="Search orders" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="res">{data.length ? `${filtered.length} of ${data.length} orders` : ""}</span>
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
        {filterChips.map((c) => (
          <button key={c.k + c.v} className="fchip" type="button" onClick={() => toggle(c.k, c.v, false)}>{c.label}<span>×</span></button>
        ))}
        {amtOn && <button className="fchip" type="button" onClick={() => setAmt({ min: "", max: "" })}>₹{amt.min || 0} – {amt.max || "max"}<span>×</span></button>}
      </div>

      <div>
        {loading ? <><div className="sk" /><div className="sk" /></>
          : !data.length ? <div className="empty">Pick a date range, save your login tokens (sidebar), then tap <strong>Fetch orders</strong>.</div>
          : !filtered.length ? <div className="empty">No orders match these filters.</div>
          : view === "card" ? filtered.map((o) => <OrderCard key={o.id ?? o.lab_order_no} o={o} />)
          : <TableView rows={filtered} />}
      </div>
    </Shell>
  );
}
