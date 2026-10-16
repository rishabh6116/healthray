import { useEffect, useRef, useState } from "react";

/* animated number */
export function Count({ to, fmt = String }) {
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

export const Metric = ({ cls, icon, label, children }) => (
  <div className={"m " + cls}>
    <div className="chip"><svg viewBox="0 0 24 24">{icon}</svg></div>
    <div><div className="l">{label}</div><div className="v">{children}</div></div>
  </div>
);
