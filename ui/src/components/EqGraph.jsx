import React, { useEffect, useRef, useState, useCallback } from "react";

const PAD = { l: 28, r: 10, t: 10, b: 17 };
const MIN_F = 20;
const MAX_F = 20000;
const MIN_DB = -12;
const MAX_DB = 12;

export default function EqGraph({
  bands,
  bypass,
  comfort,
  focus = false,
  sampleRate,
  targetSpectrumRef,
  focusedBandIdx = -1,
  onHoverBandChange,
  onBandUpdate
}) {
  const canvasRef = useRef(null);
  const liveSpectrumRef = useRef(new Array(72).fill(0));
  const peakSpectrumRef = useRef(new Array(72).fill(0));
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [cursorReadout, setCursorReadout] = useState(null);
  const hoveredRef = useRef(-1);
  const draggingRef = useRef(-1);
  const focusedRef = useRef(-1);

  hoveredRef.current = hoveredIdx;
  draggingRef.current = draggingIdx;
  focusedRef.current = focusedBandIdx;

  const getMetrics = useCallback(() => {
    const canvas = canvasRef.current;
    const cssW = (canvas && canvas.clientWidth) || 540;
    const cssH = (canvas && canvas.clientHeight) || 114;
    const plotW = cssW - PAD.l - PAD.r;
    const plotH = cssH - PAD.t - PAD.b;

    const freqToX = (f) => {
      const ratio = (Math.log10(f) - Math.log10(MIN_F)) / (Math.log10(MAX_F) - Math.log10(MIN_F));
      return PAD.l + ratio * plotW;
    };
    const xToFreq = (x) => {
      const ratio = Math.max(0, Math.min(1, (x - PAD.l) / plotW));
      return MIN_F * Math.pow(MAX_F / MIN_F, ratio);
    };
    const dbToY = (db) => {
      const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
      const ratio = (MAX_DB - clamped) / (MAX_DB - MIN_DB);
      return PAD.t + ratio * plotH;
    };
    const yToDb = (y) => {
      const ratio = Math.max(0, Math.min(1, (y - PAD.t) / plotH));
      return MAX_DB - ratio * (MAX_DB - MIN_DB);
    };

    return { cssW, cssH, plotW, plotH, freqToX, xToFreq, dbToY, yToDb };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !globalThis.EG280_PEQ) return;
    const { evaluateMagnitudeDb } = globalThis.EG280_PEQ;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const m = getMetrics();

    if (canvas.width !== Math.round(m.cssW * dpr) || canvas.height !== Math.round(m.cssH * dpr)) {
      canvas.width = Math.round(m.cssW * dpr);
      canvas.height = Math.round(m.cssH * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, m.cssW, m.cssH);

    // Sub-decade minor vertical frequency grid lines
    const minorFreqs = [40, 60, 80, 300, 400, 600, 800, 3000, 4000, 6000, 8000, 15000];
    ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1;
    for (const f of minorFreqs) {
      const x = Math.round(m.freqToX(f)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PAD.t);
      ctx.lineTo(x, PAD.t + m.plotH);
      ctx.stroke();
    }

    // Major logarithmic frequency grid
    const gridFreqs = [30, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    const gridLabels = {
      30: "30",
      50: "50",
      100: "100",
      200: "200",
      500: "500",
      1000: "1k",
      2000: "2k",
      5000: "5k",
      10000: "10k",
      20000: "20k"
    };

    ctx.font = '600 9.5px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (const f of gridFreqs) {
      const x = Math.round(m.freqToX(f)) + 0.5;
      ctx.strokeStyle = f === 1000 ? "rgba(255, 255, 255, 0.085)" : "rgba(255, 255, 255, 0.045)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.t);
      ctx.lineTo(x, PAD.t + m.plotH);
      ctx.stroke();

      ctx.fillStyle = "rgba(148, 163, 184, 0.62)";
      ctx.fillText(gridLabels[f], x, PAD.t + m.plotH + 4);
    }

    // Horizontal dB lines
    const dbLines = [6, 0, -6];
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const db of dbLines) {
      const y = Math.round(m.dbToY(db)) + 0.5;
      ctx.strokeStyle = db === 0 ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(PAD.l + m.plotW, y);
      ctx.stroke();

      ctx.fillStyle = db === 0 ? "rgba(203, 213, 225, 0.78)" : "rgba(148, 163, 184, 0.55)";
      ctx.fillText(`${db > 0 ? "+" : ""}${db}`, PAD.l - 5, y);
    }

    // Live FFT Spectrum Analyzer bars + Peak Hold Trace
    const live = liveSpectrumRef.current;
    const peaks = peakSpectrumRef.current;
    const barCount = live.length;
    const barStep = m.plotW / barCount;
    const barWidth = Math.max(1.5, barStep - 1.4);
    const baselineY = PAD.t + m.plotH;

    const barGrad = ctx.createLinearGradient(0, PAD.t, 0, baselineY);
    if (bypass) {
      barGrad.addColorStop(0, "rgba(148, 163, 184, 0.25)");
      barGrad.addColorStop(1, "rgba(148, 163, 184, 0.03)");
    } else {
      barGrad.addColorStop(0, "rgba(45, 212, 191, 0.42)");
      barGrad.addColorStop(0.65, "rgba(45, 212, 191, 0.16)");
      barGrad.addColorStop(1, "rgba(45, 212, 191, 0.02)");
    }
    ctx.fillStyle = barGrad;

    for (let i = 0; i < barCount; i++) {
      const level = live[i] / 255;
      if (level <= 0.005) continue;
      const barH = Math.max(1.5, level * m.plotH * 0.92);
      const bx = PAD.l + i * barStep;
      const by = baselineY - barH;
      ctx.fillRect(bx, by, barWidth, barH);
    }

    // Subtle Peak-Hold ticks
    ctx.fillStyle = bypass ? "rgba(148, 163, 184, 0.35)" : "rgba(45, 212, 191, 0.55)";
    for (let i = 0; i < barCount; i++) {
      const pLevel = peaks[i] / 255;
      if (pLevel <= 0.015) continue;
      const py = baselineY - pLevel * m.plotH * 0.92;
      const bx = PAD.l + i * barStep;
      ctx.fillRect(bx, py, barWidth, 1);
    }

    const zeroY = m.dbToY(0);
    const steps = 192;

    // Individual Active/Hovered Band Transfer Curve Preview (Pro-Q style solo bell/shelf)
    const soloIdx =
      draggingRef.current >= 0
        ? draggingRef.current
        : hoveredRef.current >= 0
        ? hoveredRef.current
        : focusedRef.current;

    if (!bypass && soloIdx >= 0 && bands[soloIdx] && bands[soloIdx].enabled) {
      const soloBand = [bands[soloIdx]];
      const soloPts = [];
      for (let i = 0; i <= steps; i++) {
        const f = MIN_F * Math.pow(MAX_F / MIN_F, i / steps);
        const db = evaluateMagnitudeDb(soloBand, f, sampleRate, false);
        soloPts.push({ x: m.freqToX(f), y: m.dbToY(db) });
      }
      const isBoost = bands[soloIdx].gain >= 0;

      ctx.beginPath();
      ctx.moveTo(soloPts[0].x, zeroY);
      for (const p of soloPts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(soloPts[soloPts.length - 1].x, zeroY);
      ctx.closePath();
      ctx.fillStyle = isBoost ? "rgba(45, 212, 191, 0.11)" : "rgba(245, 158, 11, 0.11)";
      ctx.fill();

      ctx.save();
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      soloPts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = isBoost ? "rgba(45, 212, 191, 0.65)" : "rgba(245, 158, 11, 0.65)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    }

    // Master Composite EQ Curve
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const f = MIN_F * Math.pow(MAX_F / MIN_F, t);
      const db = bypass ? 0 : evaluateMagnitudeDb(bands, f, sampleRate, comfort, focus);
      points.push({ x: m.freqToX(f), y: m.dbToY(db) });
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, zeroY);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(points[points.length - 1].x, zeroY);
    ctx.closePath();
    ctx.fillStyle = bypass ? "rgba(148, 163, 184, 0.04)" : "rgba(245, 158, 11, 0.11)";
    ctx.fill();

    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = bypass ? "#64748b" : "#f59e0b";
    ctx.lineWidth = 1.85;
    ctx.stroke();

    // Precision Band Nodes (1..8)
    if (!bypass) {
      ctx.font = '700 8px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      bands.forEach((band, idx) => {
        if (!band.enabled) return;
        const bx = m.freqToX(Math.max(MIN_F, Math.min(MAX_F, band.freq)));
        const by = m.dbToY(band.gain);
        const isHot =
          idx === hoveredRef.current ||
          idx === draggingRef.current ||
          idx === focusedRef.current;

        const radius = isHot ? 6.8 : 5.2;
        const fillCol =
          band.gain > 0.05 ? "#2dd4bf" : band.gain < -0.05 ? "#f59e0b" : "#94a3b8";

        if (isHot) {
          ctx.beginPath();
          ctx.arc(bx, by, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHot ? "#ffffff" : fillCol;
        ctx.fill();
        ctx.strokeStyle = "#07090c";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.fillStyle = "#07090c";
        ctx.fillText(String(idx + 1), bx, by + 0.3);
      });
    }

    ctx.restore();
  }, [bands, bypass, comfort, focus, sampleRate, getMetrics]);

  // Redraw immediately on state changes
  useEffect(() => {
    draw();
  }, [draw, focusedBandIdx]);

  // Smooth 60fps animation loop for live spectrum bars & peak hold decay
  useEffect(() => {
    let rafId = null;
    const tick = () => {
      const target = targetSpectrumRef.current;
      const live = liveSpectrumRef.current;
      const peaks = peakSpectrumRef.current;
      let dirty = false;
      for (let i = 0; i < live.length; i++) {
        const diff = (target[i] || 0) - live[i];
        if (Math.abs(diff) > 0.25) {
          live[i] += diff * (diff > 0 ? 0.5 : 0.22);
          dirty = true;
        } else if (live[i] !== (target[i] || 0)) {
          live[i] = target[i] || 0;
          dirty = true;
        }

        if (live[i] >= peaks[i]) {
          peaks[i] = live[i];
        } else if (peaks[i] > 0.5) {
          peaks[i] = Math.max(0, peaks[i] - 0.85);
          dirty = true;
        }
      }
      if (dirty) draw();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [draw, targetSpectrumRef]);

  const findNearestBand = (mx, my) => {
    if (bypass) return -1;
    const m = getMetrics();
    let bestIdx = -1;
    let bestDist = 15;
    bands.forEach((b, idx) => {
      if (!b.enabled) return;
      const bx = m.freqToX(Math.max(MIN_F, Math.min(MAX_F, b.freq)));
      const by = m.dbToY(b.gain);
      const d = Math.hypot(mx - bx, my - by);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };

  const handlePointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const idx = findNearestBand(e.clientX - rect.left, e.clientY - rect.top);
    if (idx >= 0) {
      setDraggingIdx(idx);
      if (onHoverBandChange) onHoverBandChange(idx);
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const idx = findNearestBand(e.clientX - rect.left, e.clientY - rect.top);
    if (idx >= 0) {
      onBandUpdate(idx, { gain: 0.0 });
    }
  };

  const handlePointerMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const m = getMetrics();

    if (mx >= PAD.l && mx <= PAD.l + m.plotW && my >= PAD.t && my <= PAD.t + m.plotH) {
      setCursorReadout({
        freq: Math.round(Math.max(20, Math.min(20000, m.xToFreq(mx)))),
        db: Math.round(Math.max(-12, Math.min(12, m.yToDb(my))) * 10) / 10
      });
    } else {
      setCursorReadout(null);
    }

    if (draggingRef.current >= 0) {
      const idx = draggingRef.current;
      const freq = Math.round(Math.max(20, Math.min(20000, m.xToFreq(mx))));
      const gain = Math.round(Math.max(-12, Math.min(12, m.yToDb(my))) * 10) / 10;
      onBandUpdate(idx, { freq, gain });
      return;
    }

    const nearest = findNearestBand(mx, my);
    if (nearest !== hoveredRef.current) {
      setHoveredIdx(nearest);
      if (onHoverBandChange) onHoverBandChange(nearest);
    }
  };

  const handlePointerUp = (e) => {
    if (draggingRef.current >= 0) {
      setDraggingIdx(-1);
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch (_err) {}
    }
  };

  const handleWheel = (e) => {
    const idx = hoveredRef.current >= 0 ? hoveredRef.current : focusedRef.current;
    if (idx < 0 || bypass) return;
    const band = bands[idx];
    if (!band || band.type !== "peaking") return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    const q = Math.round(Math.max(0.2, Math.min(10.0, band.q + delta)) * 10) / 10;
    onBandUpdate(idx, { q });
  };

  const activeTipIdx =
    draggingIdx >= 0 ? draggingIdx : hoveredIdx >= 0 ? hoveredIdx : focusedBandIdx;
  const activeTipBand = activeTipIdx >= 0 && !bypass ? bands[activeTipIdx] : null;

  return (
    <div className="studio-well relative rounded">
      <canvas
        ref={canvasRef}
        width={540}
        height={114}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setCursorReadout(null);
          if (draggingRef.current < 0) {
            setHoveredIdx(-1);
            if (onHoverBandChange) onHoverBandChange(-1);
          }
        }}
        onWheel={handleWheel}
        className={`block h-[114px] w-full ${
          draggingIdx >= 0 ? "cursor-grabbing" : hoveredIdx >= 0 ? "cursor-grab" : "cursor-crosshair"
        }`}
      />
      {activeTipBand ? (
        <div className="font-mono-tech pointer-events-none absolute top-1.5 right-2 flex items-center gap-1.5 rounded border border-white/15 bg-[#0d1017]/95 px-2 py-0.5 text-[10px] text-slate-200">
          <span className="font-bold text-slate-400">B{activeTipIdx + 1}</span>
          <span>{Math.round(activeTipBand.freq)} Hz</span>
          <span className={activeTipBand.gain >= 0 ? "text-teal-300" : "text-amber-300"}>
            {activeTipBand.gain > 0 ? "+" : ""}
            {activeTipBand.gain.toFixed(1)} dB
          </span>
          {activeTipBand.type === "peaking" && (
            <span className="text-slate-400">Q {activeTipBand.q.toFixed(2)}</span>
          )}
        </div>
      ) : (
        cursorReadout && (
          <div className="font-mono-tech pointer-events-none absolute top-1.5 right-2 rounded border border-white/10 bg-[#0d1017]/85 px-1.5 py-0.5 text-[9.5px] text-slate-400">
            {cursorReadout.freq >= 1000
              ? `${(cursorReadout.freq / 1000).toFixed(2)} kHz`
              : `${cursorReadout.freq} Hz`}{" "}
            • {cursorReadout.db > 0 ? "+" : ""}
            {cursorReadout.db.toFixed(1)} dB
          </div>
        )
      )}
    </div>
  );
}
