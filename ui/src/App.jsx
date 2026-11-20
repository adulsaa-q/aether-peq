import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload
} from "lucide-react";
import EqGraph from "./components/EqGraph";

const APP_VERSION = "2.1.0";

function formatDb(val) {
  const num = Number(val) || 0;
  return `${num > 0 ? "+" : ""}${num.toFixed(1)} dB`;
}

function FilterTypeSegment({ value, onChange }) {
  const options = [
    { id: "lowshelf", label: "LS", title: "Low-Shelf Filter (12 dB/oct, S=1)" },
    { id: "peaking", label: "PK", title: "Parametric Peaking Bell Filter (Variable Q)" },
    { id: "highshelf", label: "HS", title: "High-Shelf Filter (12 dB/oct, S=1)" }
  ];
  return (
    <div className="font-mono-tech inline-grid grid-cols-3 rounded border border-white/10 bg-[#080a0e] p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.id)}
            className={`rounded-[2px] px-1.5 py-0.5 text-[9.5px] font-bold tracking-tight transition-colors ${
              active
                ? "bg-[#1d2432] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BipolarGainSlider({ gain, onChange, onReset }) {
  const clamped = Math.max(-12, Math.min(12, Number(gain) || 0));
  const pct = (Math.abs(clamped) / 12) * 50;
  const isPositive = clamped >= 0;

  return (
    <div
      className="relative flex flex-1 items-center"
      onDoubleClick={onReset}
      title="Drag to adjust gain • Double-click to reset to 0.0 dB"
    >
      {/* Recessed bipolar track */}
      <div className="pointer-events-none absolute right-0 left-0 h-[5px] rounded-[2px] border border-white/[0.07] bg-[#07090c]">
        {/* Center 0 dB reference tick */}
        <div className="absolute top-[-2px] bottom-[-2px] left-1/2 w-[1px] -translate-x-1/2 bg-white/30" />
        {/* Dynamic fill from 0 dB center */}
        {Math.abs(clamped) > 0.05 && (
          <div
            style={{
              left: isPositive ? "50%" : `${50 - pct}%`,
              width: `${pct}%`
            }}
            className={`
              absolute top-0 bottom-0
              ${isPositive ? "bg-teal-400/75" : "bg-amber-400/75"}
            `}
          />
        )}
      </div>
      <input
        type="range"
        min="-12"
        max="12"
        step="0.1"
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="studio-slider relative z-10 w-full"
      />
    </div>
  );
}

export default function App() {
  const {
    STANDARD_PRESETS,
    CUSTOM_SEED_PRESETS,
    FACTORY_PRESETS,
    parseImportedProfile,
    clonePreset,
    mergeSeedCustomPresets,
    createDefaultState,
    computePeakGainDb,
    applyEarFeedbackStep
  } = globalThis.EG280_PEQ;

  const standardMap = STANDARD_PRESETS || FACTORY_PRESETS;
  const seedCustomMap = CUSTOM_SEED_PRESETS || {};

  const [state, setState] = useState(() => createDefaultState());
  const [status, setStatus] = useState({
    connected: false,
    needsReload: false,
    text: "Checking tab...",
    host: "",
    sampleRate: 48000,
    track: null
  });
  const [focusedBandIdx, setFocusedBandIdx] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [ioModal, setIoModal] = useState({ open: false, mode: "export", text: "", error: "" });
  const [earLabOpen, setEarLabOpen] = useState(false);
  const [blindTest, setBlindTest] = useState({
    active: false,
    xIsBypass: false,
    selectedSlot: "X",
    revealed: false
  });

  const activeTabIdRef = useRef(null);
  const spectrumPortRef = useRef(null);
  const storageTimerRef = useRef(null);
  const revCounterRef = useRef(Date.now());
  const targetSpectrumRef = useRef(new Array(72).fill(0));
  const dropdownRef = useRef(null);

  const customPresetsMap = useMemo(
    () =>
      mergeSeedCustomPresets
        ? mergeSeedCustomPresets(state.customPresets)
        : state.customPresets || {},
    [mergeSeedCustomPresets, state.customPresets]
  );

  const allPresets = useMemo(
    () => ({
      ...standardMap,
      ...customPresetsMap
    }),
    [standardMap, customPresetsMap]
  );

  const activePreset = allPresets[state.activePresetId] || null;
  const isCustomActive = Boolean(customPresetsMap[state.activePresetId]);
  const isUserDeletableCustom = isCustomActive && !seedCustomMap[state.activePresetId];
  const isEg280Active = String(state.activePresetId || "").startsWith("eg280-");

  const { peakBoostDb, netPeakDb } = useMemo(() => {
    const rawPeak = computePeakGainDb
      ? computePeakGainDb(
          state.bands,
          status.sampleRate || 48000,
          Boolean(state.comfort),
          Boolean(state.focus)
        )
      : 0;
    const peak = Math.max(0, rawPeak);
    const net = rawPeak + (Number(state.preamp) || 0);
    return { peakBoostDb: peak, netPeakDb: net };
  }, [computePeakGainDb, state.bands, state.comfort, state.focus, state.preamp, status.sampleRate]);

  const persistAndPush = (nextState, immediateStorage = false) => {
    revCounterRef.current += 1;
    const stamped = { ...nextState, _rev: revCounterRef.current };
    setState(stamped);

    if (activeTabIdRef.current !== null && typeof chrome !== "undefined" && chrome.tabs?.sendMessage) {
      chrome.tabs.sendMessage(activeTabIdRef.current, { type: "APPLY_STATE", state: stamped }, () => {
        void chrome.runtime?.lastError;
      });
    }

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      if (storageTimerRef.current) {
        clearTimeout(storageTimerRef.current);
      }
      if (immediateStorage) {
        chrome.storage.local.set({ eg280State: stamped });
      } else {
        storageTimerRef.current = setTimeout(() => {
          chrome.storage.local.set({ eg280State: stamped });
        }, 110);
      }
    }
  };

  const connectSpectrum = (tabId) => {
    if (typeof chrome === "undefined" || !chrome.tabs?.connect) return null;
    try {
      if (spectrumPortRef.current) {
        try {
          spectrumPortRef.current.disconnect();
        } catch (_e) {}
        spectrumPortRef.current = null;
      }
      const port = chrome.tabs.connect(tabId, { name: "spectrum" });
      spectrumPortRef.current = port;
      port.onMessage.addListener((msg) => {
        if (msg?.type === "SPECTRUM" && Array.isArray(msg.bins)) {
          targetSpectrumRef.current = msg.bins;
        }
      });
      port.onDisconnect.addListener(() => {
        void chrome.runtime?.lastError;
        if (spectrumPortRef.current === port) {
          spectrumPortRef.current = null;
        }
      });
      return port;
    } catch (_err) {
      return null;
    }
  };

  const queryStatus = () => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      setStatus((prev) => ({ ...prev, text: "PREVIEW • 48kHz INTERNAL" }));
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        setStatus((prev) => ({ ...prev, connected: false, needsReload: false, text: "NO ACTIVE TAB" }));
        return;
      }
      const url = tab.url || "";
      const supported =
        url.startsWith("https://music.youtube.com") || url.startsWith("https://www.youtube.com");

      if (!supported) {
        setStatus((prev) => ({
          ...prev,
          connected: false,
          needsReload: false,
          text: "STANDBY • OPEN YOUTUBE / YT MUSIC"
        }));
        return;
      }

      activeTabIdRef.current = tab.id;
      chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, (res) => {
        if (chrome.runtime?.lastError || !res?.ok) {
          setStatus((prev) => ({
            ...prev,
            connected: false,
            needsReload: true,
            text: "DSP DETACHED • RELOAD TAB"
          }));
          return;
        }

        const rateKhz = ((res.sampleRate || 48000) / 1000).toFixed(1).replace(".0", "");
        setStatus({
          connected: true,
          needsReload: false,
          host: res.host,
          sampleRate: res.sampleRate || 48000,
          track: res.track || null,
          text: res.lastError
            ? `ERR: ${res.lastError}`
            : `${rateKhz}kHz • 64-BIT FLOAT • ${String(res.audioState || "RUNNING").toUpperCase()}`
        });
        connectSpectrum(tab.id);
      });
    });
  };

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime?.getManifest && chrome.runtime?.reload) {
      const currentManifestVersion = chrome.runtime.getManifest()?.version;
      if (currentManifestVersion && currentManifestVersion !== APP_VERSION) {
        chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs?.[0];
          if (
            tab?.id &&
            (tab.url?.startsWith("https://music.youtube.com") ||
              tab.url?.startsWith("https://www.youtube.com"))
          ) {
            chrome.tabs.reload(tab.id);
          }
          setTimeout(() => chrome.runtime.reload(), 120);
        });
        return;
      }
    }

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["eg280State"], (res) => {
        if (res?.eg280State) {
          const base = createDefaultState();
          setState({
            ...base,
            ...res.eg280State,
            customPresets: mergeSeedCustomPresets
              ? mergeSeedCustomPresets(res.eg280State.customPresets)
              : res.eg280State.customPresets
          });
        }
        queryStatus();
      });

      const handleStorageChange = (changes, area) => {
        if (area === "local" && changes.eg280State?.newValue) {
          const incoming = changes.eg280State.newValue;
          if (incoming._rev && incoming._rev <= revCounterRef.current) return;
          setState((prev) => ({
            ...createDefaultState(),
            ...prev,
            ...incoming,
            customPresets: mergeSeedCustomPresets
              ? mergeSeedCustomPresets(incoming.customPresets)
              : incoming.customPresets
          }));
        }
      };
      chrome.storage.onChanged?.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged?.removeListener(handleStorageChange);
        if (spectrumPortRef.current) {
          try {
            spectrumPortRef.current.disconnect();
          } catch (_e) {}
        }
      };
    } else {
      queryStatus();
    }
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSaveModalOpen(false);
        setIoModal((prev) => ({ ...prev, open: false }));
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const applyPreset = (presetId) => {
    const chosen = allPresets[presetId];
    if (!chosen) return;
    const copy = clonePreset(chosen);
    setMenuOpen(false);
    const channelKey = (status.track?.channel || "").trim().toLowerCase();
    const nextChannelMemory = { ...(state.channelMemory || {}) };
    if (channelKey) {
      nextChannelMemory[channelKey] = presetId;
    }
    persistAndPush(
      {
        ...state,
        activePresetId: presetId,
        preamp: copy.preamp,
        limiter: copy.limiter !== false,
        bands: copy.bands,
        channelMemory: nextChannelMemory
      },
      true
    );
  };

  const handleResetPreset = () => {
    const id = state.activePresetId;
    const original =
      standardMap[id] || seedCustomMap[id] || allPresets[id] || standardMap["std-harman"];
    if (!original) return;
    const copy = clonePreset(original);
    const nextCustom = { ...customPresetsMap };
    if (seedCustomMap[id]) {
      nextCustom[id] = clonePreset(seedCustomMap[id]);
    }
    persistAndPush(
      {
        ...state,
        customPresets: nextCustom,
        activePresetId: copy.id,
        preamp: copy.preamp,
        limiter: copy.limiter !== false,
        bands: copy.bands
      },
      true
    );
  };

  const handleBandUpdate = (idx, patch) => {
    const nextBands = state.bands.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    persistAndPush({ ...state, bands: nextBands }, false);
  };

  const handleAutoPreamp = () => {
    const rawPeak = computePeakGainDb
      ? computePeakGainDb(
          state.bands,
          status.sampleRate || 48000,
          Boolean(state.comfort),
          Boolean(state.focus)
        )
      : Math.max(0, ...state.bands.filter((b) => b.enabled).map((b) => b.gain));
    const recommended = rawPeak > -0.2 ? -(Math.ceil((rawPeak + 0.3) * 2) / 2) : 0.0;
    persistAndPush({ ...state, preamp: Math.max(-12, Math.min(6, recommended)) }, true);
  };

  const handleSaveCustom = () => {
    const name = presetNameInput.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    const displayName = name.startsWith("[Custom]") ? name : `[Custom] ${name}`;
    const nextCustom = {
      ...customPresetsMap,
      [id]: {
        id,
        category: "custom",
        name: displayName,
        subtitle: "User Saved Custom Parametric EQ Profile",
        preamp: state.preamp,
        limiter: state.limiter,
        bands: clonePreset(state.bands)
      }
    };
    setSaveModalOpen(false);
    persistAndPush({ ...state, customPresets: nextCustom, activePresetId: id }, true);
  };

  const handleDeleteCustom = () => {
    if (!isUserDeletableCustom) return;
    const nextCustom = { ...customPresetsMap };
    delete nextCustom[state.activePresetId];
    const fallback = clonePreset(standardMap["std-harman"]);
    persistAndPush(
      {
        ...state,
        customPresets: nextCustom,
        activePresetId: fallback.id,
        preamp: fallback.preamp,
        limiter: fallback.limiter,
        bands: fallback.bands
      },
      true
    );
  };

  const handleApplyImport = () => {
    try {
      const parsed = parseImportedProfile(ioModal.text);
      const normalized = state.bands.map(
        (fallback, idx) => parsed.bands[idx] || { ...fallback, enabled: false, gain: 0 }
      );
      const computedPeak = computePeakGainDb
        ? computePeakGainDb(normalized, status.sampleRate || 48000, Boolean(state.comfort))
        : 0;
      const autoSafePreamp =
        typeof parsed.preamp === "number"
          ? parsed.preamp
          : computedPeak > 0
          ? -(Math.ceil((computedPeak + 0.3) * 2) / 2)
          : 0.0;

      setIoModal({ open: false, mode: "import", text: "", error: "" });
      persistAndPush(
        {
          ...state,
          activePresetId: "custom-imported",
          bands: normalized,
          preamp: autoSafePreamp,
          limiter: typeof parsed.limiter === "boolean" ? parsed.limiter : state.limiter
        },
        true
      );
    } catch (err) {
      setIoModal((prev) => ({ ...prev, error: err.message }));
    }
  };

  const handleEarFeedback = (issueType) => {
    if (!applyEarFeedbackStep) return;
    const nextBands = applyEarFeedbackStep(state.bands, issueType);
    const rawPeak = computePeakGainDb
      ? computePeakGainDb(
          nextBands,
          status.sampleRate || 48000,
          Boolean(state.comfort),
          Boolean(state.focus)
        )
      : 0;
    const currentNet = rawPeak + (Number(state.preamp) || 0);
    const safePreamp =
      currentNet > -0.1 ? -(Math.ceil((rawPeak + 0.3) * 2) / 2) : state.preamp;
    persistAndPush({ ...state, bands: nextBands, preamp: safePreamp }, true);
  };

  const startBlindTest = () => {
    const xIsBypass = Math.random() < 0.5;
    setBlindTest({ active: true, xIsBypass, selectedSlot: "X", revealed: false });
    persistAndPush({ ...state, bypass: xIsBypass }, false);
  };

  const selectBlindSlot = (slot) => {
    const shouldBypass = slot === "X" ? blindTest.xIsBypass : !blindTest.xIsBypass;
    setBlindTest((prev) => ({ ...prev, selectedSlot: slot }));
    persistAndPush({ ...state, bypass: shouldBypass }, false);
  };

  const stopBlindTest = () => {
    setBlindTest({ active: false, xIsBypass: false, selectedSlot: "X", revealed: false });
    persistAndPush({ ...state, bypass: false }, true);
  };

  const trackLabel =
    status.track?.title && status.track?.artist
      ? `${status.track.title} - ${status.track.artist}`
      : status.track?.title || "";

  return (
    <div className="bg-[#0a0c10] px-3 py-2.5 text-slate-100">
      <div className="flex flex-col gap-1.5">
        {/* Hardware Chassis Header */}
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold tracking-[-0.02em] text-slate-100">
                AETHER PEQ
              </span>
              <span className="font-mono-tech rounded-[2px] border border-white/12 bg-[#141821] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-slate-300">
                8-BAND IIR
              </span>
              <span
                className={`font-mono-tech rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${
                  isCustomActive
                    ? "border-amber-400/35 bg-amber-400/10 text-amber-300"
                    : "border-teal-400/30 bg-teal-400/10 text-teal-300"
                }`}
              >
                {isEg280Active ? "CUSTOM • EG280" : isCustomActive ? "CUSTOM" : "STANDARD"}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  !status.connected
                    ? "bg-slate-600"
                    : state.bypass
                    ? "bg-amber-400"
                    : "bg-teal-400"
                }`}
              />
              <span className="font-mono-tech text-[10px] tracking-tight text-slate-400">
                {status.connected && state.bypass ? `BYPASSED • ${status.host}` : status.text}
              </span>
              {status.needsReload && (
                <button
                  onClick={() => {
                    if (activeTabIdRef.current !== null && chrome.tabs?.reload) {
                      chrome.tabs.reload(activeTabIdRef.current, () => setTimeout(queryStatus, 1400));
                    }
                  }}
                  className="font-mono-tech inline-flex items-center gap-1 rounded-[2px] border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9.5px] text-slate-200 hover:bg-white/10"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  ATTACH
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => persistAndPush({ ...state, autoDj: !state.autoDj }, true)}
              title="Auto-switch EQ preset by track/artist metadata (Standard or Custom EG280 bank)"
              className={`font-mono-tech inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[10px] font-semibold tracking-tight transition-colors ${
                state.autoDj
                  ? "border-amber-400/45 bg-[#1b1812] text-amber-300"
                  : "border-white/10 bg-[#12161f] text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  state.autoDj ? "bg-amber-400" : "bg-slate-600"
                }`}
              />
              AUTO-DJ
            </button>

            <button
              type="button"
              onClick={() => persistAndPush({ ...state, bypass: !state.bypass }, true)}
              title="Toggle phase-coherent DSP processing"
              className={`font-mono-tech inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-[10px] font-bold tracking-tight transition-colors ${
                !state.bypass
                  ? "border-teal-400/45 bg-[#101d1d] text-teal-300"
                  : "border-white/10 bg-[#12161f] text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  !state.bypass ? "bg-teal-400" : "bg-amber-400"
                }`}
              />
              {state.bypass ? "BYPASS" : "DSP ON"}
            </button>
          </div>
        </header>

        {/* Preset Selector Bar */}
        <section className="relative z-30 flex items-center justify-between gap-1.5">
          <div ref={dropdownRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`studio-module flex w-full items-center justify-between gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
                menuOpen ? "border-amber-400/55" : "hover:border-white/20"
              }`}
            >
              <span className="truncate text-slate-100">
                {activePreset ? activePreset.name : "Custom / Imported Profile"}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${
                  menuOpen ? "rotate-180 text-amber-400" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="studio-popover studio-scroll absolute top-[calc(100%+4px)] right-0 left-0 max-h-[295px] overflow-y-auto rounded-[4px] p-1.5"
                >
                  <div className="font-mono-tech px-2 pt-1 pb-1 text-[9px] font-bold tracking-wider text-teal-300/90 uppercase">
                    Standard Acoustic Targets (Universal)
                  </div>
                  {Object.values(standardMap).map((p) => {
                    const selected = state.activePresetId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left transition-colors ${
                          selected ? "bg-teal-400/12" : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div
                            className={`truncate text-xs font-semibold ${
                              selected ? "text-teal-300" : "text-slate-100"
                            }`}
                          >
                            {p.name}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">{p.subtitle}</div>
                        </div>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-teal-300" />}
                      </button>
                    );
                  })}

                  {Object.keys(customPresetsMap).length > 0 && (
                    <>
                      <div className="font-mono-tech mt-1.5 border-t border-white/[0.08] px-2 pt-1.5 pb-1 text-[9px] font-bold tracking-wider text-amber-300/90 uppercase">
                        Custom & Hardware Profiles (Simgot EG280 & Saved)
                      </div>
                      {Object.values(customPresetsMap).map((p) => {
                        const selected = state.activePresetId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPreset(p.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left transition-colors ${
                              selected ? "bg-amber-400/12" : "hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="min-w-0">
                              <div
                                className={`truncate text-xs font-semibold ${
                                  selected ? "text-amber-300" : "text-slate-100"
                                }`}
                              >
                                {p.name}
                              </div>
                              <div className="truncate text-[10px] text-slate-400">{p.subtitle}</div>
                            </div>
                            {selected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPresetNameInput("");
                setSaveModalOpen(true);
              }}
              className="studio-module inline-flex items-center gap-1 rounded-[4px] px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:border-white/20"
            >
              <Save className="h-3 w-3 text-teal-300" />
              Save
            </button>
            {isUserDeletableCustom && (
              <button
                type="button"
                onClick={handleDeleteCustom}
                title="Delete user custom preset"
                className="studio-module inline-flex items-center rounded-[4px] px-2 py-1.5 text-[11px] text-rose-300 hover:border-rose-400/40"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={handleResetPreset}
              title="Reset preset to factory-calibrated parameters"
              className="studio-module inline-flex items-center gap-1 rounded-[4px] px-2 py-1.5 text-[11px] text-slate-300 hover:border-white/20"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </section>

        {/* Spectrum Analyzer + Transfer Function Graph */}
        <section className="studio-module rounded-[4px] px-2.5 pt-1.5 pb-1.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[10.5px] font-medium text-slate-300">
              {activePreset ? activePreset.subtitle : "Custom Parametric Transfer Function"}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {trackLabel && (
                <span className="max-w-[140px] truncate text-right text-[10px] text-slate-400">
                  {trackLabel}
                </span>
              )}
              <span
                title={`Composite filter peak: ${formatDb(peakBoostDb)} | Net output ceiling with preamp: ${formatDb(netPeakDb)}`}
                className={`font-mono-tech rounded-[2px] border px-1.5 py-0.5 text-[9.5px] font-semibold ${
                  netPeakDb <= 0.05
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                    : "border-rose-400/40 bg-rose-400/15 text-rose-300"
                }`}
              >
                NET {netPeakDb > 0 ? "+" : ""}
                {netPeakDb.toFixed(1)} dBFS
              </span>
            </div>
          </div>
          <EqGraph
            bands={state.bands}
            bypass={state.bypass}
            comfort={Boolean(state.comfort)}
            focus={Boolean(state.focus)}
            sampleRate={status.sampleRate}
            targetSpectrumRef={targetSpectrumRef}
            focusedBandIdx={focusedBandIdx}
            onHoverBandChange={setFocusedBandIdx}
            onBandUpdate={handleBandUpdate}
          />
        </section>

        {/* Master Preamp & Acoustic Processing Matrix Bar */}
        <section className="studio-module flex items-center justify-between gap-1.5 rounded-[4px] px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="font-mono-tech text-[9.5px] font-semibold tracking-wider text-slate-400 uppercase">
              PRE
            </span>
            <input
              type="range"
              min="-12"
              max="6"
              step="0.5"
              value={state.preamp}
              onDoubleClick={handleAutoPreamp}
              onChange={(e) => persistAndPush({ ...state, preamp: Number(e.target.value) }, false)}
              className="studio-slider min-w-[50px] flex-1"
            />
            <span className="font-mono-tech min-w-[44px] text-right text-[10.5px] font-semibold text-slate-100">
              {formatDb(state.preamp)}
            </span>
            <button
              type="button"
              onClick={handleAutoPreamp}
              title="Compute exact 256-point composite peak gain and set ITU-R BS.1770-4 safe headroom"
              className="font-mono-tech rounded-[2px] border border-white/15 bg-[#161b24] px-1.5 py-0.5 text-[8.5px] font-bold tracking-wider text-slate-300 uppercase hover:border-white/25 hover:text-white"
            >
              AUTO
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => persistAndPush({ ...state, focus: !state.focus }, true)}
              title="Deep Work Focus Mode (Alt+F): Recesses 1.85kHz vocal intelligibility (-2.2dB) to prevent speech distraction while coding"
              className={`font-mono-tech inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                state.focus
                  ? "border-teal-400/45 bg-[#101d1d] text-teal-300"
                  : "border-white/10 bg-[#141821] text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  state.focus ? "bg-teal-400" : "bg-slate-600"
                }`}
              />
              FOCUS
            </button>

            <button
              type="button"
              onClick={() => persistAndPush({ ...state, leveler: !state.leveler }, true)}
              title="Smart RMS Auto-Leveler (Alt+L): Normalizes uneven YouTube track volumes gently (±4.0 dB)"
              className={`font-mono-tech inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                state.leveler
                  ? "border-teal-400/45 bg-[#101d1d] text-teal-300"
                  : "border-white/10 bg-[#141821] text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  state.leveler ? "bg-teal-400" : "bg-slate-600"
                }`}
              />
              LEVEL
            </button>

            <button
              type="button"
              onClick={() => persistAndPush({ ...state, crossfeed: !state.crossfeed }, true)}
              title="Bauer BS2B / Linkwitz Constant-Power Crossfeed (Alt+X): 700Hz, 260μs ITD, +1.72dB High-Shelf"
              className={`font-mono-tech inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                state.crossfeed
                  ? "border-amber-400/45 bg-[#1b1812] text-amber-300"
                  : "border-white/10 bg-[#141821] text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  state.crossfeed ? "bg-amber-400" : "bg-slate-600"
                }`}
              />
              X-FEED
            </button>

            <button
              type="button"
              onClick={() => persistAndPush({ ...state, comfort: !state.comfort }, true)}
              title="ISO 226:2023 60-Phon Equal-Loudness Contour (+2.0dB 75Hz, -2.0dB 3.5kHz Canal Peak, +0.8dB Air)"
              className={`font-mono-tech inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                state.comfort
                  ? "border-amber-400/45 bg-[#1b1812] text-amber-300"
                  : "border-white/10 bg-[#141821] text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  state.comfort ? "bg-amber-400" : "bg-slate-600"
                }`}
              />
              ISO226
            </button>

            <button
              type="button"
              onClick={() => persistAndPush({ ...state, limiter: state.limiter === false }, true)}
              title="True-Peak Soft Limiter (-1.0 dBFS threshold, 14:1 ratio, 2ms attack)"
              className={`font-mono-tech inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                state.limiter !== false
                  ? "border-teal-400/40 bg-[#101d1d] text-teal-300"
                  : "border-white/10 bg-[#141821] text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  state.limiter !== false ? "bg-teal-400" : "bg-slate-600"
                }`}
              />
              LIM
            </button>
          </div>
        </section>

        {/* 8-Band Precision Parametric Matrix */}
        <section className="studio-module rounded-[4px] px-2 py-1.5">
          <div className="font-mono-tech grid grid-cols-[28px_76px_62px_1fr_52px] items-center gap-2 border-b border-white/[0.07] px-0.5 pb-1 text-[9px] font-bold tracking-wider text-slate-400 uppercase">
            <span className="text-center">CH</span>
            <span>FILTER</span>
            <span className="text-right">FREQ (HZ)</span>
            <span>GAIN (0dB CENTER • DBL-CLICK RESET)</span>
            <span className="text-right">Q</span>
          </div>

          <div className="mt-1 flex flex-col gap-0.5">
            {state.bands.map((band, idx) => {
              const isRowFocused = focusedBandIdx === idx;
              return (
                <div
                  key={idx}
                  onPointerEnter={() => setFocusedBandIdx(idx)}
                  onPointerLeave={() => setFocusedBandIdx(-1)}
                  className={`grid grid-cols-[28px_76px_62px_1fr_52px] items-center gap-2 rounded-[3px] px-0.5 py-0.5 transition-colors ${
                    !band.enabled
                      ? "opacity-40"
                      : isRowFocused
                      ? "bg-white/[0.055]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Tactile Hardware Channel Enable Button (01..08) */}
                  <button
                    type="button"
                    onClick={() => handleBandUpdate(idx, { enabled: !band.enabled })}
                    title={`Toggle Band ${idx + 1}`}
                    className={`font-mono-tech h-[20px] rounded-[2px] border text-[10px] font-bold transition-colors ${
                      band.enabled
                        ? band.gain > 0.05
                          ? "border-teal-400/45 bg-teal-400/15 text-teal-300"
                          : band.gain < -0.05
                          ? "border-amber-400/45 bg-amber-400/15 text-amber-300"
                          : "border-white/20 bg-[#181e29] text-slate-200"
                        : "border-white/10 bg-[#0d1017] text-slate-500"
                    }`}
                  >
                    0{idx + 1}
                  </button>

                  {/* 1-Click Segmented Filter Topology Switch (LS / PK / HS) */}
                  <FilterTypeSegment
                    value={band.type}
                    onChange={(type) => handleBandUpdate(idx, { type })}
                  />

                  {/* Center / Corner Frequency (Hz) */}
                  <input
                    type="number"
                    min="20"
                    max="20000"
                    step="10"
                    value={Math.round(band.freq)}
                    onChange={(e) =>
                      handleBandUpdate(idx, {
                        freq: Math.max(20, Math.min(20000, Number(e.target.value) || 1000))
                      })
                    }
                    className="font-mono-tech h-[20px] w-full rounded-[2px] border border-white/10 bg-[#080a0e] px-1.5 text-right text-[11px] text-slate-100 outline-none focus:border-amber-400/70"
                  />

                  {/* Bipolar Center-Detent Gain Slider + Tabular dB Readout */}
                  <div className="flex items-center gap-2">
                    <BipolarGainSlider
                      gain={band.gain}
                      onChange={(gain) => handleBandUpdate(idx, { gain })}
                      onReset={() => handleBandUpdate(idx, { gain: 0.0 })}
                    />
                    <button
                      type="button"
                      onDoubleClick={() => handleBandUpdate(idx, { gain: 0.0 })}
                      title="Double-click to reset band gain to 0.0 dB"
                      className={`font-mono-tech min-w-[50px] text-right text-[11px] font-semibold ${
                        band.gain > 0.05
                          ? "text-teal-300"
                          : band.gain < -0.05
                          ? "text-amber-300"
                          : "text-slate-500"
                      }`}
                    >
                      {formatDb(band.gain)}
                    </button>
                  </div>

                  {/* Bandwidth Q Factor */}
                  <input
                    type="number"
                    min="0.2"
                    max="10.0"
                    step="0.1"
                    disabled={band.type !== "peaking"}
                    value={band.q}
                    onChange={(e) =>
                      handleBandUpdate(idx, {
                        q: Math.max(0.2, Math.min(10.0, Number(e.target.value) || 1.0))
                      })
                    }
                    className="font-mono-tech h-[20px] w-full rounded-[2px] border border-white/10 bg-[#080a0e] px-1.5 text-right text-[11px] text-slate-100 outline-none focus:border-amber-400/70 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer & Ear Lab Trigger */}
        <footer className="font-mono-tech flex items-center justify-between pt-0.5 text-[9px] text-slate-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEarLabOpen((o) => !o)}
              className={`rounded-[2px] border px-1.5 py-0.5 font-bold tracking-wider uppercase transition-colors ${
                earLabOpen || blindTest.active
                  ? "border-amber-400/50 bg-[#1b1812] text-amber-300"
                  : "border-white/12 bg-[#141821] text-slate-300 hover:border-white/25"
              }`}
            >
              {blindTest.active ? "BLIND A/B ACTIVE" : "EAR LAB & BLIND A/B"}
            </button>
            <span>ALT+B BYPASS • ALT+F FOCUS • WHEEL Q</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIoModal({ open: true, mode: "import", text: "", error: "" })}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-amber-300"
            >
              <Upload className="h-2.5 w-2.5" />
              IMPORT AUTOEQ / JSON
            </button>
            <button
              type="button"
              onClick={() =>
                setIoModal({
                  open: true,
                  mode: "export",
                  text: JSON.stringify(
                    { preamp: state.preamp, limiter: state.limiter, bands: state.bands },
                    null,
                    2
                  ),
                  error: ""
                })
              }
              className="inline-flex items-center gap-1 text-slate-300 hover:text-teal-300"
            >
              <Download className="h-2.5 w-2.5" />
              EXPORT
            </button>
          </div>
        </footer>

        {/* Collapsible Ear Calibration & Blind A/B Lab */}
        {earLabOpen && (
          <section className="studio-module font-mono-tech flex flex-col gap-1.5 rounded-[4px] px-2.5 py-2 text-[9.5px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold tracking-wider text-slate-300 uppercase">
                1. ADAPTIVE EAR TUNING (0.3 dB DAMPED STEP)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleEarFeedback("sharp_treble")}
                  title="Cut 4.5-8.5 kHz sibilance/planar peak by -0.3 dB"
                  className="rounded-[2px] border border-white/12 bg-[#141821] px-1.5 py-0.5 text-slate-200 hover:border-amber-400/50 hover:text-amber-300"
                >
                  -SHARP (5-8k)
                </button>
                <button
                  type="button"
                  onClick={() => handleEarFeedback("vocal_glare")}
                  title="Cut 2.5-3.8 kHz upper-mid glare by -0.3 dB"
                  className="rounded-[2px] border border-white/12 bg-[#141821] px-1.5 py-0.5 text-slate-200 hover:border-amber-400/50 hover:text-amber-300"
                >
                  -GLARE (3k)
                </button>
                <button
                  type="button"
                  onClick={() => handleEarFeedback("thin_mids")}
                  title="Boost 180-280 Hz lower-mid warmth by +0.3 dB"
                  className="rounded-[2px] border border-white/12 bg-[#141821] px-1.5 py-0.5 text-slate-200 hover:border-teal-400/50 hover:text-teal-300"
                >
                  +BODY (220Hz)
                </button>
                <button
                  type="button"
                  onClick={() => handleEarFeedback("muddy_bass")}
                  title="Cut 100-250 Hz mid-bass bloat by -0.3 dB"
                  className="rounded-[2px] border border-white/12 bg-[#141821] px-1.5 py-0.5 text-slate-200 hover:border-amber-400/50 hover:text-amber-300"
                >
                  -MUD (150Hz)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-1.5">
              <span className="font-bold tracking-wider text-slate-300 uppercase">
                2. DOUBLE-BLIND A/B TEST (EQ VS FLAT)
              </span>
              {!blindTest.active ? (
                <button
                  type="button"
                  onClick={startBlindTest}
                  className="rounded-[2px] border border-teal-400/40 bg-[#101d1d] px-2 py-0.5 font-bold text-teal-300 hover:border-teal-400"
                >
                  START BLIND X/Y
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectBlindSlot("X")}
                    className={`rounded-[2px] border px-2 py-0.5 font-bold ${
                      blindTest.selectedSlot === "X"
                        ? "border-amber-400 bg-amber-400/20 text-amber-300"
                        : "border-white/12 bg-[#141821] text-slate-400"
                    }`}
                  >
                    SAMPLE X
                  </button>
                  <button
                    type="button"
                    onClick={() => selectBlindSlot("Y")}
                    className={`rounded-[2px] border px-2 py-0.5 font-bold ${
                      blindTest.selectedSlot === "Y"
                        ? "border-amber-400 bg-amber-400/20 text-amber-300"
                        : "border-white/12 bg-[#141821] text-slate-400"
                    }`}
                  >
                    SAMPLE Y
                  </button>
                  {!blindTest.revealed ? (
                    <button
                      type="button"
                      onClick={() => setBlindTest((prev) => ({ ...prev, revealed: true }))}
                      className="rounded-[2px] border border-teal-400/40 bg-[#101d1d] px-2 py-0.5 font-bold text-teal-300"
                    >
                      REVEAL
                    </button>
                  ) : (
                    <span className="px-1 text-teal-300">
                      {blindTest.selectedSlot} ={" "}
                      {(blindTest.selectedSlot === "X"
                        ? blindTest.xIsBypass
                        : !blindTest.xIsBypass)
                        ? "FLAT (0dB)"
                        : "ACTIVE EQ"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={stopBlindTest}
                    className="rounded-[2px] border border-white/15 bg-white/5 px-1.5 py-0.5 text-slate-300 hover:bg-white/10"
                  >
                    EXIT
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Save Preset Modal */}
      <AnimatePresence>
        {saveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              className="studio-popover w-[380px] rounded-[4px] p-4"
            >
              <h3 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
                Save Custom Profile
              </h3>
              <input
                type="text"
                autoFocus
                maxLength={48}
                placeholder="e.g. HD600 - Harman Vocal or EG280 - Late Night"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCustom();
                }}
                className="font-mono-tech mt-3 w-full rounded-[3px] border border-white/15 bg-[#080a0e] px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-400"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="rounded-[3px] border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="rounded-[3px] bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import / Export Modal */}
      <AnimatePresence>
        {ioModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              className="studio-popover w-[420px] rounded-[4px] p-4"
            >
              <h3 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
                {ioModal.mode === "export"
                  ? "Export Parametric Profile (JSON)"
                  : "Import JSON or Squiglink / AutoEQ (.txt)"}
              </h3>
              <textarea
                rows={7}
                spellCheck={false}
                value={ioModal.text}
                onChange={(e) => setIoModal((prev) => ({ ...prev, text: e.target.value, error: "" }))}
                placeholder="Paste JSON or Squiglink / AutoEQ Equalizer APO .txt here..."
                className="font-mono-tech mt-2.5 w-full rounded-[3px] border border-white/15 bg-[#080a0e] p-2 text-[11px] text-slate-100 outline-none focus:border-amber-400"
              />
              {ioModal.error && <p className="mt-1.5 text-[11px] text-rose-400">{ioModal.error}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIoModal({ open: false, mode: "export", text: "", error: "" })}
                  className="rounded-[3px] border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
                >
                  Close
                </button>
                {ioModal.mode === "import" && (
                  <button
                    type="button"
                    onClick={handleApplyImport}
                    className="rounded-[3px] bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    Apply
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
