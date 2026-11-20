(() => {
  "use strict";

  const {
    STANDARD_PRESETS,
    CUSTOM_SEED_PRESETS,
    COMFORT_BANDS,
    FOCUS_BANDS,
    clonePreset,
    mergeSeedCustomPresets,
    createDefaultState,
    resolveAutoPreset
  } = globalThis.EG280_PEQ;

  let currentState = createDefaultState();
  let audioCtx = null;
  let preampNode = null;
  let levelerGainNode = null;
  let filterNodes = [];
  let comfortNodes = [];
  let focusNodes = [];
  let limiterNode = null;
  let directLGain = null;
  let directRGain = null;
  let directShelfL = null;
  let directShelfR = null;
  let crossLtoRGain = null;
  let crossRtoLGain = null;
  let outputGainNode = null;
  let analyserNode = null;
  let spectrumBinsBuffer = null;
  let timeDomainBuffer = null;
  let currentLevelerDb = 0.0;
  let hudTimer = null;
  const SPECTRUM_BAR_COUNT = 72;
  const hookedElements = new WeakSet();
  let hookedCount = 0;
  let lastError = null;
  let lastSeenTrackKey = "";
  let lastAppliedRevision = 0;

  // Bauer BS2B / Linkwitz Constant-Power Crossfeed Constants
  const CF_DIRECT_LINEAR = 0.82;
  const CF_CROSS_LINEAR = 0.18;
  const CF_HIGH_SHELF_DB = -20 * Math.log10(CF_DIRECT_LINEAR); // +1.7237 dB
  const CF_CUTOFF_HZ = 700;
  const CF_ITD_SECONDS = 0.00026; // 260 microseconds

  function dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  function normalizeState(rawState) {
    const base = createDefaultState();
    const merged = {
      ...base,
      ...(rawState || {}),
      customPresets: mergeSeedCustomPresets(rawState && rawState.customPresets),
      channelMemory: (rawState && rawState.channelMemory) || {}
    };
    return merged;
  }

  function showStudioHud(headline, detail = "", accent = "#2dd4bf") {
    if (!document || !document.body) return;
    let el = document.getElementById("aether-peq-hud");
    if (!el) {
      el = document.createElement("div");
      el.id = "aether-peq-hud";
      el.style.cssText = [
        "position:fixed",
        "right:20px",
        "bottom:24px",
        "z-index:2147483647",
        "pointer-events:none",
        "background:#0d1017",
        "border:1px solid rgba(255,255,255,0.16)",
        "border-radius:4px",
        "padding:8px 12px",
        "box-shadow:0 14px 32px rgba(0,0,0,0.8)",
        "font-family:'JetBrains Mono',Consolas,monospace",
        "color:#f1f5f9",
        "opacity:0",
        "transform:translateY(6px)",
        "transition:opacity 0.16s ease,transform 0.16s ease"
      ].join(";");
      document.body.appendChild(el);
    }

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-size:10px;font-weight:700;letter-spacing:0.06em;color:#94a3b8;text-transform:uppercase;">
        <span style="width:6px;height:6px;border-radius:1px;background:${accent};display:inline-block;"></span>
        <span>AETHER PEQ DSP</span>
      </div>
      <div style="margin-top:3px;font-size:12px;font-weight:700;color:#f8fafc;">${headline}</div>
      ${detail ? `<div style="margin-top:1px;font-size:10px;color:#94a3b8;">${detail}</div>` : ""}
    `;

    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });

    if (hudTimer) clearTimeout(hudTimer);
    hudTimer = setTimeout(() => {
      if (el) {
        el.style.opacity = "0";
        el.style.transform = "translateY(6px)";
      }
    }, 2400);
  }

  function ensureAudioGraph() {
    if (audioCtx) return true;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    audioCtx = new AudioContextClass({ latencyHint: "playback" });

    preampNode = audioCtx.createGain();
    levelerGainNode = audioCtx.createGain();
    levelerGainNode.gain.value = 1.0;
    outputGainNode = audioCtx.createGain();
    outputGainNode.gain.value = 1.0;

    filterNodes = [];
    for (let i = 0; i < 8; i++) {
      const f = audioCtx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = 1000;
      f.Q.value = 1.0;
      f.gain.value = 0.0;
      filterNodes.push(f);
    }

    comfortNodes = COMFORT_BANDS.map((cb) => {
      const f = audioCtx.createBiquadFilter();
      f.type = cb.type;
      f.frequency.value = cb.freq;
      f.Q.value = cb.q;
      f.gain.value = 0.0;
      return f;
    });

    focusNodes = (FOCUS_BANDS || []).map((fb) => {
      const f = audioCtx.createBiquadFilter();
      f.type = fb.type;
      f.frequency.value = fb.freq;
      f.Q.value = fb.q;
      f.gain.value = 0.0;
      return f;
    });

    limiterNode = audioCtx.createDynamicsCompressor();
    limiterNode.threshold.value = -1.0;
    limiterNode.knee.value = 2.5;
    limiterNode.ratio.value = 14.0;
    limiterNode.attack.value = 0.002;
    limiterNode.release.value = 0.08;

    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);
    directLGain = audioCtx.createGain();
    directRGain = audioCtx.createGain();
    crossLtoRGain = audioCtx.createGain();
    crossRtoLGain = audioCtx.createGain();

    directShelfL = audioCtx.createBiquadFilter();
    directShelfL.type = "highshelf";
    directShelfL.frequency.value = CF_CUTOFF_HZ;
    directShelfL.Q.value = Math.SQRT1_2;
    directShelfL.gain.value = 0.0;

    directShelfR = audioCtx.createBiquadFilter();
    directShelfR.type = "highshelf";
    directShelfR.frequency.value = CF_CUTOFF_HZ;
    directShelfR.Q.value = Math.SQRT1_2;
    directShelfR.gain.value = 0.0;

    const lpL = audioCtx.createBiquadFilter();
    lpL.type = "lowpass";
    lpL.frequency.value = CF_CUTOFF_HZ;
    lpL.Q.value = Math.SQRT1_2;

    const lpR = audioCtx.createBiquadFilter();
    lpR.type = "lowpass";
    lpR.frequency.value = CF_CUTOFF_HZ;
    lpR.Q.value = Math.SQRT1_2;

    const delayL = audioCtx.createDelay(0.01);
    delayL.delayTime.value = CF_ITD_SECONDS;
    const delayR = audioCtx.createDelay(0.01);
    delayR.delayTime.value = CF_ITD_SECONDS;

    // Single phase-coherent pipeline
    preampNode.connect(levelerGainNode);
    let prev = levelerGainNode;
    for (const f of filterNodes) {
      prev.connect(f);
      prev = f;
    }
    for (const cf of comfortNodes) {
      prev.connect(cf);
      prev = cf;
    }
    for (const ff of focusNodes) {
      prev.connect(ff);
      prev = ff;
    }
    prev.connect(limiterNode);
    limiterNode.connect(splitter);

    splitter.connect(directLGain, 0);
    directLGain.connect(directShelfL);
    directShelfL.connect(merger, 0, 0);

    splitter.connect(directRGain, 1);
    directRGain.connect(directShelfR);
    directShelfR.connect(merger, 0, 1);

    splitter.connect(lpL, 0);
    lpL.connect(delayL);
    delayL.connect(crossLtoRGain);
    crossLtoRGain.connect(merger, 0, 1);

    splitter.connect(lpR, 1);
    lpR.connect(delayR);
    delayR.connect(crossRtoLGain);
    crossRtoLGain.connect(merger, 0, 0);

    merger.connect(outputGainNode);
    outputGainNode.connect(audioCtx.destination);

    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.82;
    analyserNode.minDecibels = -92;
    analyserNode.maxDecibels = -12;
    spectrumBinsBuffer = new Uint8Array(analyserNode.frequencyBinCount);
    timeDomainBuffer = new Float32Array(analyserNode.fftSize);
    outputGainNode.connect(analyserNode);

    applyStateToGraph(currentState, true);
    return true;
  }

  function setParamSmooth(param, value, instant = false, tau = 0.015) {
    if (!audioCtx || !param) return;
    const now = audioCtx.currentTime;
    try {
      param.cancelScheduledValues(now);
      if (instant) {
        param.setValueAtTime(value, now);
      } else {
        param.setTargetAtTime(value, now, tau);
      }
    } catch (_err) {
      param.value = value;
    }
  }

  function applyStateToGraph(state, instant = false) {
    currentState = normalizeState(state);
    if (!audioCtx) return;

    const isBypass = Boolean(currentState.bypass);

    const clampedPreamp = isBypass
      ? 0.0
      : Math.max(-18, Math.min(12, Number(currentState.preamp) || 0));
    setParamSmooth(preampNode.gain, dbToLinear(clampedPreamp), instant);

    if (isBypass || !currentState.leveler) {
      currentLevelerDb = 0.0;
      setParamSmooth(levelerGainNode.gain, 1.0, instant, 0.08);
    }

    const useLimiter = !isBypass && currentState.limiter !== false;
    setParamSmooth(limiterNode.threshold, useLimiter ? -1.0 : 0.0, instant);
    setParamSmooth(limiterNode.knee, useLimiter ? 2.5 : 0.0, instant);
    setParamSmooth(limiterNode.ratio, useLimiter ? 14.0 : 1.0, instant);

    const useCrossfeed = !isBypass && Boolean(currentState.crossfeed);
    setParamSmooth(directLGain.gain, useCrossfeed ? CF_DIRECT_LINEAR : 1.0, instant);
    setParamSmooth(directRGain.gain, useCrossfeed ? CF_DIRECT_LINEAR : 1.0, instant);
    setParamSmooth(directShelfL.gain, useCrossfeed ? CF_HIGH_SHELF_DB : 0.0, instant);
    setParamSmooth(directShelfR.gain, useCrossfeed ? CF_HIGH_SHELF_DB : 0.0, instant);
    setParamSmooth(crossLtoRGain.gain, useCrossfeed ? CF_CROSS_LINEAR : 0.0, instant);
    setParamSmooth(crossRtoLGain.gain, useCrossfeed ? CF_CROSS_LINEAR : 0.0, instant);

    const useComfort = !isBypass && Boolean(currentState.comfort);
    comfortNodes.forEach((node, idx) => {
      const targetGain = useComfort ? COMFORT_BANDS[idx].gain : 0.0;
      setParamSmooth(node.gain, targetGain, instant);
    });

    const useFocus = !isBypass && Boolean(currentState.focus);
    focusNodes.forEach((node, idx) => {
      const targetGain = useFocus && FOCUS_BANDS[idx] ? FOCUS_BANDS[idx].gain : 0.0;
      setParamSmooth(node.gain, targetGain, instant);
    });

    const maxFreq = Math.min(20000, (audioCtx.sampleRate || 48000) * 0.48);
    const bands = Array.isArray(currentState.bands) ? currentState.bands : [];
    for (let i = 0; i < filterNodes.length; i++) {
      const node = filterNodes[i];
      const band = bands[i];
      if (!band) {
        setParamSmooth(node.gain, 0.0, instant);
        continue;
      }

      const validType = ["lowshelf", "peaking", "highshelf"].includes(band.type)
        ? band.type
        : "peaking";
      if (node.type !== validType) {
        node.type = validType;
      }

      const freq = Math.max(20, Math.min(maxFreq, Number(band.freq) || 1000));
      const gain =
        !isBypass && band.enabled
          ? Math.max(-15, Math.min(15, Number(band.gain) || 0))
          : 0.0;
      const q = Math.max(0.2, Math.min(12, Number(band.q) || 1.0));

      setParamSmooth(node.frequency, freq, instant);
      setParamSmooth(node.Q, q, instant);
      setParamSmooth(node.gain, gain, instant);
    }
  }

  /**
   * Smart Short-Term RMS Auto-Leveler (-4.0 dB to +4.0 dB gentle riding)
   * Keeps quiet YouTube live sessions and loud rock masters within a comfortable listening window.
   */
  function updateSmartLeveler() {
    if (
      !audioCtx ||
      audioCtx.state !== "running" ||
      !analyserNode ||
      !timeDomainBuffer ||
      !levelerGainNode ||
      currentState.bypass ||
      !currentState.leveler
    ) {
      return;
    }

    analyserNode.getFloatTimeDomainData(timeDomainBuffer);
    let sumSq = 0;
    for (let i = 0; i < timeDomainBuffer.length; i++) {
      const s = timeDomainBuffer[i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / timeDomainBuffer.length);
    const rmsDb = 20 * Math.log10(Math.max(1e-6, rms));

    // Ignore near-silence (< -48 dBFS) so silence isn't boosted
    if (rmsDb < -48) return;

    const targetRmsDb = -18.5;
    const errorDb = targetRmsDb - (rmsDb - currentLevelerDb);
    const desiredDb = Math.max(-4.0, Math.min(4.0, errorDb * 0.55));
    // Slow smoothing (18% step per 250ms) to preserve musical dynamics
    currentLevelerDb = currentLevelerDb * 0.82 + desiredDb * 0.18;
    setParamSmooth(levelerGainNode.gain, dbToLinear(currentLevelerDb), false, 0.22);
  }

  function hookMediaElement(el) {
    if (!el || hookedElements.has(el)) return;
    if (!ensureAudioGraph()) return;

    try {
      const source = audioCtx.createMediaElementSource(el);
      source.connect(preampNode);
      hookedElements.add(el);
      hookedCount += 1;
      lastError = null;

      const resumeIfNeeded = () => {
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
      };

      el.addEventListener("play", resumeIfNeeded, { passive: true });
      el.addEventListener("playing", resumeIfNeeded, { passive: true });
      if (!el.paused) {
        resumeIfNeeded();
      }
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }

  function scanMediaElements() {
    const elements = document.querySelectorAll("video, audio");
    elements.forEach(hookMediaElement);
  }

  function getChannelName() {
    const ytChannel = document.querySelector(
      "ytd-watch-metadata #owner #channel-name a, ytd-video-owner-renderer #channel-name a"
    );
    if (ytChannel && ytChannel.textContent) {
      return ytChannel.textContent.trim();
    }
    const ytmByline = document.querySelector("ytmusic-player-bar .byline a");
    if (ytmByline && ytmByline.textContent) {
      return ytmByline.textContent.trim();
    }
    return "";
  }

  function getTrackInfo() {
    const channel = getChannelName();
    const meta = navigator.mediaSession && navigator.mediaSession.metadata;
    if (meta && meta.title) {
      return {
        title: meta.title,
        artist: meta.artist || channel || "",
        channel
      };
    }
    const ytmTitle = document.querySelector("ytmusic-player-bar .title");
    const ytmByline = document.querySelector("ytmusic-player-bar .byline");
    if (ytmTitle && ytmTitle.textContent) {
      return {
        title: ytmTitle.textContent.trim(),
        artist: ytmByline ? ytmByline.textContent.trim() : channel,
        channel
      };
    }
    return {
      title: document.title.replace(" - YouTube Music", "").replace(" - YouTube", "").trim(),
      artist: channel,
      channel
    };
  }

  function maybeRunAutoDj() {
    if (!currentState.autoDj) return;
    const track = getTrackInfo();
    const trackKey = `${track.title}|${track.artist}|${track.channel}|${currentState.activePresetId}`;
    if (!track.title || trackKey === lastSeenTrackKey) return;
    lastSeenTrackKey = trackKey;

    let matchedPresetId = resolveAutoPreset(track.title, track.artist, currentState.activePresetId);
    let sourceLabel = "AUTO-DJ MATCH";

    // Fallback to Per-Channel EQ Memory if no artist/genre keyword matched
    if (!matchedPresetId && track.channel && currentState.channelMemory) {
      const remembered = currentState.channelMemory[track.channel.toLowerCase()];
      if (remembered) {
        matchedPresetId = remembered;
        sourceLabel = `CHANNEL MEMORY (${track.channel})`;
      }
    }

    if (!matchedPresetId || matchedPresetId === currentState.activePresetId) return;

    const allPresets = {
      ...STANDARD_PRESETS,
      ...CUSTOM_SEED_PRESETS,
      ...(currentState.customPresets || {})
    };
    const preset = allPresets[matchedPresetId];
    if (!preset) return;

    const copy = clonePreset(preset);
    const nextState = {
      ...currentState,
      activePresetId: matchedPresetId,
      preamp: copy.preamp,
      limiter: copy.limiter !== false,
      bands: copy.bands
    };
    applyStateToGraph(nextState, false);
    chrome.storage.local.set({ eg280State: nextState });
    showStudioHud(preset.name, `${sourceLabel} • ${track.title}`, "#f59e0b");
  }

  function setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        const nextBypass = !currentState.bypass;
        const nextState = { ...currentState, bypass: nextBypass };
        applyStateToGraph(nextState, false);
        chrome.storage.local.set({ eg280State: nextState });
        showStudioHud(
          nextBypass ? "DSP BYPASSED (0 dB UNITY)" : "DSP ENGAGED",
          "Hotkey Alt+B • Phase-Coherent A/B",
          nextBypass ? "#f59e0b" : "#2dd4bf"
        );
      } else if (key === "f") {
        e.preventDefault();
        const nextFocus = !currentState.focus;
        const nextState = { ...currentState, focus: nextFocus };
        applyStateToGraph(nextState, false);
        chrome.storage.local.set({ eg280State: nextState });
        showStudioHud(
          nextFocus ? "DEEP WORK FOCUS: ON" : "DEEP WORK FOCUS: OFF",
          "Hotkey Alt+F • 1.85kHz Vocal-Masking Duck (-2.2 dB)",
          nextFocus ? "#2dd4bf" : "#94a3b8"
        );
      } else if (key === "l") {
        e.preventDefault();
        const nextLeveler = !currentState.leveler;
        const nextState = { ...currentState, leveler: nextLeveler };
        applyStateToGraph(nextState, false);
        chrome.storage.local.set({ eg280State: nextState });
        showStudioHud(
          nextLeveler ? "SMART RMS LEVELER: ON" : "SMART RMS LEVELER: OFF",
          "Hotkey Alt+L • Auto Loudness Normalization (±4.0 dB)",
          nextLeveler ? "#2dd4bf" : "#94a3b8"
        );
      } else if (key === "x") {
        e.preventDefault();
        const nextCf = !currentState.crossfeed;
        const nextState = { ...currentState, crossfeed: nextCf };
        applyStateToGraph(nextState, false);
        chrome.storage.local.set({ eg280State: nextState });
        showStudioHud(
          nextCf ? "BS2B CROSSFEED: ON" : "BS2B CROSSFEED: OFF",
          "Hotkey Alt+X • 700Hz / 260μs Constant-Power Matrix",
          nextCf ? "#f59e0b" : "#94a3b8"
        );
      }
    });
  }

  function init() {
    chrome.storage.local.get(["eg280State"], (result) => {
      if (result && result.eg280State) {
        currentState = normalizeState(result.eg280State);
      } else {
        currentState = createDefaultState();
      }
      scanMediaElements();
      applyStateToGraph(currentState, true);
      maybeRunAutoDj();
    });

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          scanMediaElements();
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setInterval(maybeRunAutoDj, 1500);
    setInterval(updateSmartLeveler, 250);
    setupKeyboardShortcuts();

    const gestureResume = () => {
      if (hookedCount === 0) scanMediaElements();
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", gestureResume, { passive: true });
    window.addEventListener("keydown", gestureResume, { passive: true });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.eg280State && changes.eg280State.newValue) {
        const incoming = changes.eg280State.newValue;
        if (incoming._rev && incoming._rev <= lastAppliedRevision) return;
        if (incoming._rev) lastAppliedRevision = incoming._rev;
        applyStateToGraph(incoming, false);
      }
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || !msg.type) return;

      if (msg.type === "APPLY_STATE") {
        if (hookedCount === 0) scanMediaElements();
        if (msg.state && msg.state._rev) {
          lastAppliedRevision = msg.state._rev;
        }
        applyStateToGraph(msg.state, false);
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        sendResponse({ ok: true });
      } else if (msg.type === "GET_STATUS") {
        scanMediaElements();
        sendResponse({
          ok: true,
          host: window.location.hostname,
          hookedCount,
          lastError,
          audioState: audioCtx ? audioCtx.state : "uninitialized",
          sampleRate: audioCtx ? audioCtx.sampleRate : 48000,
          levelerDb: Number(currentLevelerDb.toFixed(1)),
          track: getTrackInfo()
        });
      }
    });

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== "spectrum") return;
      const timer = setInterval(() => {
        if (!analyserNode || !spectrumBinsBuffer || !audioCtx) return;
        analyserNode.getByteFrequencyData(spectrumBinsBuffer);
        const nyquist = (audioCtx.sampleRate || 48000) / 2;
        const binCount = spectrumBinsBuffer.length;
        const bars = new Array(SPECTRUM_BAR_COUNT);
        const minF = 20;
        const maxF = 20000;

        for (let i = 0; i < SPECTRUM_BAR_COUNT; i++) {
          const f0 = minF * Math.pow(maxF / minF, i / SPECTRUM_BAR_COUNT);
          const f1 = minF * Math.pow(maxF / minF, (i + 1) / SPECTRUM_BAR_COUNT);
          const fCenter = Math.sqrt(f0 * f1);
          const idx0 = (f0 / nyquist) * binCount;
          const idx1 = (f1 / nyquist) * binCount;

          let rawByte = 0;
          if (idx1 - idx0 < 1) {
            const center = (idx0 + idx1) * 0.5;
            const lo = Math.max(0, Math.min(binCount - 1, Math.floor(center)));
            const hi = Math.max(0, Math.min(binCount - 1, lo + 1));
            const frac = center - lo;
            rawByte = spectrumBinsBuffer[lo] * (1 - frac) + spectrumBinsBuffer[hi] * frac;
          } else {
            const start = Math.max(0, Math.floor(idx0));
            const end = Math.min(binCount - 1, Math.ceil(idx1));
            let peak = 0;
            for (let b = start; b <= end; b++) {
              if (spectrumBinsBuffer[b] > peak) peak = spectrumBinsBuffer[b];
            }
            rawByte = peak;
          }

          if (rawByte > 1) {
            const tiltOctaves = Math.log2(fCenter / 400);
            const tiltByteOffset = tiltOctaves * 3.0 * (255 / 80);
            bars[i] = Math.max(0, Math.min(255, Math.round(rawByte + tiltByteOffset)));
          } else {
            bars[i] = 0;
          }
        }

        try {
          port.postMessage({ type: "SPECTRUM", bins: bars });
        } catch (_err) {
          clearInterval(timer);
        }
      }, 33);

      port.onDisconnect.addListener(() => {
        clearInterval(timer);
      });
    });
  }

  init();
})();
