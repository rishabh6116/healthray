import { useEffect, useMemo, useRef, useState } from "react";
import Shell from "../components/Shell.jsx";
import { Chevron } from "../components/Icons.jsx";
import DateRange from "../components/DateRange.jsx";
import { getState, hasTokens, authHeaders, requestAuth } from "../lib/auth.js";
import { kb, jget } from "../lib/utils.js";
import { ask } from "../lib/confirm.js";

const getReq = () => { const t = getState().tokens; return hasTokens(t) ? authHeaders(t) : null; };
const dayIso = (s, end) => {
  const p = s.split("-").map(Number);
  return (end ? new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999) : new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0)).toISOString();
};

async function post(u, b) {
  try {
    const r = await fetch(u, { method: "POST", body: JSON.stringify(b) });
    return await r.json();
  } catch (e) { return { error: "Server not reachable: " + e }; }
}

function FoldGroup({ title, closed: c0 = false, children }) {
  const [closed, setClosed] = useState(c0);
  return (
    <section className={"fg" + (closed ? " closed" : "")}>
      <button className="fgh" type="button" onClick={() => setClosed(!closed)}><span>{title}</span><Chevron /></button>
      <div className="fgb">{children}</div>
    </section>
  );
}

function Check({ on, onChange, children, rad }) {
  return (
    <label className={"fi" + (rad ? " rad" : "") + (on ? " on" : "")} onClick={(e) => { e.preventDefault(); onChange(!on); }}>
      <input type="checkbox" checked={on} readOnly /><span className="cb" /><span className="fn">{children}</span>
    </label>
  );
}

export default function SendReport() {
  /* sidebar options */
  const [toDoc, setToDoc] = useState(false);
  const [force, setForce] = useState(false);
  const [auto, setAuto] = useState(false);
  const [kvs, setKvs] = useState([]);
  const [surl, setSurl] = useState("https://labapi.healthray.com/api/v1/patient_case/send_wp_report");

  /* form */
  const [oid, setOid] = useState(""); const [org, setOrg] = useState("3219");
  const [pcid, setPcid] = useState(""); const [name, setName] = useState("");
  const [cc, setCc] = useState("+91"); const [mob, setMob] = useState("");
  const [inv, setInv] = useState("");
  const [paid, setPaid] = useState(null);
  const [status, setStatus] = useState({ m: "", err: false });
  const say = (m, err = false) => {
    if (err && /\b(401|403)\b|expired/i.test(m)) requestAuth();
    setStatus({ m, err });
  };

  /* cases */
  const [range, setRange] = useState({ start: "", end: "" });
  const [cq, setCq] = useState(""); const [cases, setCases] = useState([]);
  const [cmsg, setCmsg] = useState("");
  const [cLoading, setCLoading] = useState(false);
  const shownCases = useMemo(() => {
    const q = cq.trim().toLowerCase();
    return cases.filter((c) => !q || [c.name, c.mobile, c.order_no, c.case_no, c.order_id, c.id].join(" ").toLowerCase().includes(q));
  }, [cases, cq]);
  useEffect(() => { if (cases.length) setCmsg(`${shownCases.length} of ${cases.length} cases`); }, [shownCases, cases]);

  const fetchCases = async () => {
    const h = getReq(); if (!h) { requestAuth(); return say("Save your login tokens in the sidebar first.", true); }
    if (!range.start || !range.end) return say("Pick a start and end date.", true);
    setCLoading(true); say("Fetching cases…");
    const d = await post("/api/cases", { headers: h, from: dayIso(range.start, false), to: dayIso(range.end, true) });
    setCLoading(false);
    if (d.error) return say(d.error, true);
    const list = d.cases || [];
    setCases(list); say(list.length ? "" : "No cases in this date range.");
    if (!list.length) setCmsg("No cases in this date range.");
  };

  const checkBill = async (orderId = oid, orgId = org) => {
    const h = getReq(); if (!h) { requestAuth(); return say("Save your login tokens in the sidebar first.", true); }
    if (!String(orderId).trim()) return say("Enter the lab order ID.", true);
    setChecking(true); say("Checking bill…");
    const d = await post("/api/bill", { headers: h, order_id: String(orderId).trim(), org: String(orgId).trim() });
    setChecking(false);
    if (d.error) { setPaid(null); say(d.error, true); } else { setPaid(!!d.is_bill_paid); say(""); }
  };
  const [checking, setChecking] = useState(false);

  const useCase = (c) => {
    setOid(c.order_id || ""); setPcid(c.id || ""); setName(c.name || "");
    setCc(c.cc || "+91"); setMob(String(c.mobile || "").replace(/\D/g, "")); setInv((c.tests || []).join(","));
    setPaid(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (getReq() && c.order_id) checkBill(c.order_id, org);
  };

  /* file */
  const [file, setFile] = useState(null); const [fname, setFname] = useState("");
  const [pv, setPv] = useState(""); const [dragOn, setDragOn] = useState(false);
  const fileInput = useRef(null);
  const autoName = (n, f) => setFname((n.trim() || (f ? f.name.replace(/\.pdf$/i, "") : "report")) + "_null_" + Date.now() + ".pdf");
  const pickFile = (f) => {
    if (f && f.type && f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return say("Please choose a PDF file.", true);
    if (pv) URL.revokeObjectURL(pv);
    setFile(f || null); setPv(f ? URL.createObjectURL(f) : "");
    if (f) autoName(name, f);
    if (fileInput.current && !f) fileInput.current.value = "";
  };
  useEffect(() => { if (file) autoName(name, file); /* eslint-disable-next-line */ }, [name]);

  /* history */
  const [hist, setHist] = useState(() => jget("sendHist", []));
  const [sent, setSent] = useState(0);
  const addHist = (h) => { const H = [h, ...jget("sendHist", [])].slice(0, 50); localStorage.setItem("sendHist", JSON.stringify(H)); setHist(H); };

  const mobDigits = mob.replace(/\D/g, "");
  const testList = inv.split(",").map((s) => s.trim()).filter(Boolean);
  const canSend = !!(file && mobDigits.length >= 8 && pcid.toString().trim() && (paid === true || force));
  const [sending, setSending] = useState(false);

  const send = async () => {
    const h = getReq(); if (!h) { requestAuth(); return say("Save your login tokens in the sidebar first.", true); }
    if (paid !== true && !(await ask("Bill is " + (paid === false ? "UNPAID" : "not checked") + ". Send the report anyway?", { ok: "Send anyway", danger: true }))) return;
    if (!(await ask("Send to " + cc + " " + mobDigits + " (" + (toDoc ? "referring doctor" : "patient") + ")?", { ok: "Send" }))) return;
    const extra = kvs.map((r) => [r.k.trim(), r.v]).filter((x) => x[0]);
    setSending(true); say("Sending…");
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(file); });
    const d = await post("/api/send", {
      headers: h, url: surl.trim(), file: b64, filename: fname.trim() || "report.pdf",
      fields: [["patient_case_id", String(pcid).trim()], ["country_code", cc.trim()], ["mobile_number", mobDigits],
        ["send_to_ref_doc", String(toDoc)], ["investigations", testList.join(",")], ["is_automatic_send_wp", String(auto)], ...extra],
    });
    setSending(false);
    const ok = !d.error;
    if (ok) setSent((n) => n + 1);
    say(ok ? d.message || "Sent" : d.error, !ok);
    addHist({ t: new Date().toLocaleString(), m: cc + " " + mobDigits, c: String(pcid), i: testList.join(", "), ok, r: ok ? "Sent" : "Failed" });
  };

  const reset = () => { setToDoc(false); setForce(false); setAuto(false); setKvs([]); };

  const billUi = paid === true ? ["green", "Paid", "Bill paid"] : paid === false ? ["red", "Unpaid", "Bill unpaid"] : ["amber", "Not checked", "Bill not checked"];

  const sideHeader = <div className="sh"><span>Options</span><button className="lnk" type="button" onClick={reset}>Reset</button></div>;
  const side = (
    <div>
      <FoldGroup title="Share to">
        <Check rad on={!toDoc} onChange={() => setToDoc(false)}>Patient</Check>
        <Check rad on={toDoc} onChange={() => setToDoc(true)}>Referring doctor</Check>
      </FoldGroup>
      <FoldGroup title="Send options">
        <Check on={force} onChange={setForce}>Send even if unpaid</Check>
        <Check on={auto} onChange={setAuto}>is_automatic_send_wp</Check>
      </FoldGroup>
      <FoldGroup title="Extra form fields" closed>
        {kvs.map((r, i) => (
          <div className="kv" key={i}>
            <input className="fs" placeholder="name" value={r.k} onChange={(e) => setKvs(kvs.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} />
            <input className="fs" placeholder="value" value={r.v} onChange={(e) => setKvs(kvs.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
            <button className="x" type="button" onClick={() => setKvs(kvs.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button className="lnk" type="button" onClick={() => setKvs([...kvs, { k: "", v: "" }])}>+ Add field</button>
      </FoldGroup>
      <FoldGroup title="Advanced" closed>
        <input className="fs" value={surl} spellCheck="false" onChange={(e) => setSurl(e.target.value)} />
      </FoldGroup>
    </div>
  );

  return (
    <Shell title="Send Report" subtitle="Diagnostics" sideHeader={sideHeader} side={side}>
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="form f2">
          <DateRange start={range.start} end={range.end} onChange={(st, en) => setRange({ start: st, end: en })} />
          <div><label htmlFor="cf-q">Filter fetched cases</label><input id="cf-q" className="inp" placeholder="Name, mobile, OL number..." value={cq} onChange={(e) => setCq(e.target.value)} /></div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={fetchCases} disabled={cLoading}>Fetch cases</button>
          <span className="res">{cmsg}</span>
        </div>
        {!!cases.length && (
          <div className="tbl" style={{ marginTop: 14 }}><div className="tw" style={{ maxHeight: 340, overflowY: "auto" }}><table>
            <thead><tr><th>Patient</th><th>Order</th><th>Case ID</th><th>Tests</th><th>Registered</th><th /></tr></thead>
            <tbody>
              {shownCases.length ? shownCases.map((c, i) => (
                <tr key={c.id ?? i}>
                  <td><b>{c.name}</b><div className="sm">{c.cc} {c.mobile}</div></td>
                  <td>{c.order_no}<div className="sm">{c.order_id}</div>{c.shared && <span className="bd paid">Sent</span>}</td>
                  <td>{c.id}<div className="sm">{c.case_no}</div></td>
                  <td className="ad" style={{ textAlign: "left" }}>{(c.tests || []).join(", ")}</td>
                  <td>{c.registered ? new Date(c.registered).toLocaleString() : ""}</td>
                  <td><button className="ghost" type="button" onClick={() => useCase(c)}>Use</button></td>
                </tr>
              )) : <tr><td colSpan="6" className="sm">No match</td></tr>}
            </tbody>
          </table></div></div>
        )}
      </section>

      <section className="panel">
        <div className="form2">
          <div><label htmlFor="oid">Lab order ID (bill check)</label><input id="oid" className="inp" inputMode="numeric" placeholder="e.g. 37993860" value={oid} onChange={(e) => { setOid(e.target.value); setPaid(null); }} /></div>
          <div><label htmlFor="org">Organization ID</label><input id="org" className="inp" inputMode="numeric" value={org} onChange={(e) => setOrg(e.target.value)} /></div>
          <div><label htmlFor="pcid">Patient case ID</label><input id="pcid" className="inp" inputMode="numeric" placeholder="e.g. 2469473" value={pcid} onChange={(e) => setPcid(e.target.value)} /></div>
          <div><label htmlFor="pname">Patient name</label><input id="pname" className="inp" placeholder="e.g. Baby of anshika" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="s2"><label>Mobile number</label>
            <div className="ph"><input className="inp cc" value={cc} onChange={(e) => setCc(e.target.value)} />
              <input className="inp" inputMode="numeric" maxLength={15} placeholder="10-digit number" value={mob} onChange={(e) => setMob(e.target.value)} /></div></div>
          <div className="s4"><label htmlFor="inv">Investigations (comma separated)</label>
            <textarea id="inv" className="inp tx" rows="2" placeholder="CBC,LFT,Blood Group & Rh" value={inv} onChange={(e) => setInv(e.target.value)} /></div>
        </div>
        <div className="row"><button className="btn" type="button" onClick={() => checkBill()} disabled={checking}>Check bill</button>
          <span id="status" className={status.err ? "err" : ""}>{status.m}</span></div>
      </section>

      <div className="metrics">
        <div className={"m " + billUi[0]}><div className="chip"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></svg></div><div><div className="l">Bill status</div><div className="v">{billUi[1]}</div></div></div>
        <div className="m teal"><div className="chip"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9" /></svg></div><div><div className="l">Mobile</div><div className="v" style={{ fontSize: 19 }}>{mobDigits ? cc + " " + mobDigits : "-"}</div></div></div>
        <div className="m blue"><div className="chip"><svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg></div><div><div className="l">Case ID</div><div className="v">{String(pcid).trim() || "-"}</div></div></div>
        <div className="m violet"><div className="chip"><svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></svg></div><div><div className="l">Tests</div><div className="v">{testList.length}</div></div></div>
        <div className="m rose"><div className="chip"><svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /></svg></div><div><div className="l">PDF size</div><div className="v">{file ? kb(file.size) : "-"}</div></div></div>
        <div className="m green"><div className="chip"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12.5l3 3 5-6" /></svg></div><div><div className="l">Sent this session</div><div className="v">{sent}</div></div></div>
      </div>

      <div className="bar">
        <div className="bl">
          <input className="search" style={{ width: 320 }} placeholder="PDF file name" value={fname} onChange={(e) => setFname(e.target.value)} />
          <span className="res">{paid === false && !force ? "Unpaid: tick “Send even if unpaid” in Options to enable sending" : ""}</span>
        </div>
        <div className="bl">
          <button className="ghost" type="button" onClick={() => fileInput.current?.click()}>Choose PDF</button>
          <button className="ghost" type="button" disabled={!file} onClick={() => pickFile(null)}>Remove PDF</button>
        </div>
      </div>

      <div className="oc">
        <div className="oh"><strong>Report PDF</strong>
          <span className={"bd " + (paid === true ? "paid" : paid === false ? "unpaid" : "")}>{billUi[2]}</span>
          <span className="bd">{toDoc ? "Referring doctor" : "Patient"}</span>
          <span className="dt">{file ? file.name : "No file selected"}</span></div>
        <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={(e) => pickFile(e.target.files[0])} />
        {!file && (
          <div className={"drop" + (dragOn ? " on" : "")} onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOn(true); }} onDragLeave={() => setDragOn(false)}
            onDrop={(e) => { e.preventDefault(); setDragOn(false); pickFile(e.dataTransfer.files[0]); }}>
            <b>Choose or drop the report PDF here</b><br />
            <span className="sm">Print / save the report PDF from Healthray, then attach it</span>
          </div>
        )}
        {file && (
          <div className="ob">
            <div><h4>Preview</h4><iframe className="pv" title="PDF preview" src={pv} /></div>
            <div><h4>Will be sent</h4>
              <dl>
                {[["Share to", toDoc ? "Referring doctor" : "Patient"], ["Mobile", mobDigits ? cc + " " + mobDigits : "-"],
                  ["Case ID", String(pcid) || "-"], ["Tests", testList.join(", ") || "-"], ["File", fname || "-"]].map((r) => (
                  <Row key={r[0]} k={r[0]} v={r[1]} />))}
              </dl></div>
          </div>
        )}
        <div className="of"><button className="btn wa" type="button" disabled={!canSend || sending} onClick={send}>
          <svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.3L3 20l1.3-5.3A8.5 8.5 0 1 1 21 11.5z" /></svg>Send on WhatsApp</button></div>
      </div>

      {!!hist.length && (
        <div className="tbl"><div className="tw"><table>
          <thead><tr><th>Time</th><th>Mobile</th><th>Case ID</th><th>Investigations</th><th>Result</th></tr></thead>
          <tbody>{hist.map((h, i) => (
            <tr key={i}><td>{h.t}</td><td>{h.m}</td><td>{h.c}</td><td>{h.i}</td>
              <td><span className={"bd " + (h.ok ? "paid" : "unpaid")}>{h.r}</span></td></tr>))}
          </tbody></table></div></div>
      )}
    </Shell>
  );
}

const Row = ({ k, v }) => (<><dt>{k}</dt><dd>{v}</dd></>);
