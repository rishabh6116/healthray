import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopNav from "./TopNav.jsx";
import { MenuIcon, CloseIcon } from "./Icons.jsx";
import CredentialsPanel from "./CredentialsPanel.jsx";

/* Common page frame: sidebar (page-specific) + main column with the top nav in the highlighted slot. */
export default function Shell({ title, subtitle, sideHeader, side, children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("fopen", open);
    return () => document.body.classList.remove("fopen");
  }, [open]);
  useEffect(() => { document.title = title; }, [title]);

  return (
    <div className="app">
      <aside className="side" id="side">
        <div className="brand">
          <Link to="/" className="logo-lnk" aria-label="Healthray home" onClick={() => setOpen(false)}><img className="logo" src="/logo.png" alt="Healthray" /></Link>
          <div><b>Healthray</b><small>Diagnostics</small></div>
          <button className="ghost xbtn" type="button" aria-label="Close" onClick={() => setOpen(false)}><CloseIcon /></button>
        </div>
        {sideHeader}
        {side}
        <CredentialsPanel />
      </aside>
      <div className="bk" onClick={() => setOpen(false)} />
      <main>
        <div className="top">
          <button className="ghost ham" type="button" aria-label="Open menu" onClick={() => setOpen(true)}><MenuIcon /></button>
          <Link to="/" className="logo-lnk" aria-label="Healthray home"><img className="logo" src="/logo.png" alt="" style={{ width: 30, height: 30 }} /></Link>
          <h1>Healthray</h1>
        </div>
        <TopNav />
        {children}
      </main>
    </div>
  );
}
