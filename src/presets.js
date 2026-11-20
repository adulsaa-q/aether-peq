(() => {
  "use strict";

  /**
   * STANDARD UNIVERSAL PRESETS (Factory Reference Curves for Any Headphone / IEM / Monitor)
   * Grounded in peer-reviewed psychoacoustic standards:
   * - Harman Target (Olive, Welti & McMullin, AES 2013-2019)
   * - ISO 11904-1 / ITU-R P.58 Diffuse Field with JM-1 (-0.8 dB/oct) population tilt
   * - ISO 226:2003 / 2023 Equal-Loudness Contours (60-phon vs 80-phon differential)
   * - ITU-R BS.1770-4 True-Peak headroom compensation (Net Peak <= -0.2 dBFS)
   */
  const STANDARD_PRESETS = {
    "std-harman": {
      id: "std-harman",
      category: "standard",
      name: "Standard - Harman Target (2018/2019)",
      subtitle: "Olive-Welti AES Preference • +2.8dB Sub-Bass, Clean 210Hz, Smooth Pinna",
      preamp: -3.2,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 85, gain: 2.8, q: 0.71 },
        { enabled: true, type: "peaking", freq: 210, gain: -1.0, q: 1.1 },
        { enabled: true, type: "peaking", freq: 1000, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 2800, gain: 1.0, q: 1.4 },
        { enabled: true, type: "peaking", freq: 4200, gain: -0.8, q: 1.8 },
        { enabled: true, type: "peaking", freq: 6200, gain: -1.6, q: 2.5 },
        { enabled: true, type: "peaking", freq: 8500, gain: -0.8, q: 2.2 },
        { enabled: true, type: "highshelf", freq: 12500, gain: 1.0, q: 0.71 }
      ]
    },
    "std-diffuse": {
      id: "std-diffuse",
      category: "standard",
      name: "Standard - Studio Neutral (JM-1 Diffuse Field)",
      subtitle: "ISO 11904-1 / B&K 5128 Tilt (-0.8dB/oct) • Mastering Reference",
      preamp: -2.4,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 60, gain: 2.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 190, gain: -0.6, q: 1.2 },
        { enabled: true, type: "peaking", freq: 900, gain: 0.3, q: 1.1 },
        { enabled: true, type: "peaking", freq: 3100, gain: -1.2, q: 1.6 },
        { enabled: true, type: "peaking", freq: 5200, gain: -1.0, q: 2.0 },
        { enabled: true, type: "peaking", freq: 7500, gain: -0.8, q: 2.2 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 0.6, q: 0.71 },
        { enabled: false, type: "peaking", freq: 16000, gain: 0.0, q: 1.0 }
      ]
    },
    "std-vocal": {
      id: "std-vocal",
      category: "standard",
      name: "Standard - Vocal & Acoustic Reference",
      subtitle: "180Hz Fundamental Warmth + 1.25kHz Formant Presence + 6.8kHz De-Esser",
      preamp: -2.4,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 50, gain: 1.2, q: 0.71 },
        { enabled: true, type: "peaking", freq: 185, gain: 1.6, q: 0.9 },
        { enabled: true, type: "peaking", freq: 450, gain: -0.6, q: 1.3 },
        { enabled: true, type: "peaking", freq: 1250, gain: 1.4, q: 1.1 },
        { enabled: true, type: "peaking", freq: 3400, gain: -1.6, q: 1.8 },
        { enabled: true, type: "peaking", freq: 6800, gain: -2.2, q: 3.0 },
        { enabled: true, type: "peaking", freq: 9200, gain: -0.6, q: 2.2 },
        { enabled: true, type: "highshelf", freq: 12500, gain: 1.4, q: 0.71 }
      ]
    },
    "std-bass": {
      id: "std-bass",
      category: "standard",
      name: "Standard - Sub-Bass & Dynamic Punch",
      subtitle: "55Hz Sub-Shelf + 95Hz Kick Impact + 230Hz Anti-Masking Cut (R&B / EDM)",
      preamp: -5.2,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 55, gain: 4.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 95, gain: 1.6, q: 1.25 },
        { enabled: true, type: "peaking", freq: 230, gain: -1.8, q: 1.35 },
        { enabled: true, type: "peaking", freq: 1200, gain: 0.4, q: 1.1 },
        { enabled: true, type: "peaking", freq: 3300, gain: -1.0, q: 1.6 },
        { enabled: true, type: "peaking", freq: 6000, gain: -1.4, q: 2.2 },
        { enabled: true, type: "peaking", freq: 8200, gain: -0.8, q: 2.4 },
        { enabled: true, type: "highshelf", freq: 11500, gain: 1.5, q: 0.71 }
      ]
    },
    "std-rock": {
      id: "std-rock",
      category: "standard",
      name: "Standard - Rock, Shoegaze & Alternative",
      subtitle: "105Hz Drum Punch + 240Hz Guitar Body + 3.5kHz/5.8kHz Anti-Fatigue",
      preamp: -3.5,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 55, gain: 2.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 105, gain: 1.6, q: 1.15 },
        { enabled: true, type: "peaking", freq: 240, gain: 1.2, q: 0.95 },
        { enabled: true, type: "peaking", freq: 1550, gain: 0.7, q: 1.15 },
        { enabled: true, type: "peaking", freq: 3400, gain: -1.8, q: 1.7 },
        { enabled: true, type: "peaking", freq: 5800, gain: -2.2, q: 2.4 },
        { enabled: true, type: "peaking", freq: 8200, gain: -1.4, q: 2.6 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 0.8, q: 0.71 }
      ]
    },
    "std-late-night": {
      id: "std-late-night",
      category: "standard",
      name: "Standard - Late-Night (ISO 226:2023 60-Phon)",
      subtitle: "Equal-Loudness Low-SPL Contour • Restores Sub/Air, Softens 3.4kHz Canal Peak",
      preamp: -3.6,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 65, gain: 3.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 180, gain: 0.8, q: 1.0 },
        { enabled: true, type: "peaking", freq: 1000, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 2400, gain: -1.0, q: 1.4 },
        { enabled: true, type: "peaking", freq: 3500, gain: -2.4, q: 1.5 },
        { enabled: true, type: "peaking", freq: 5800, gain: -1.6, q: 2.0 },
        { enabled: true, type: "peaking", freq: 7600, gain: -1.4, q: 2.3 },
        { enabled: true, type: "highshelf", freq: 12000, gain: 1.5, q: 0.71 }
      ]
    },
    "flat": {
      id: "flat",
      category: "standard",
      name: "Flat (0 dB Bit-Transparent Reference)",
      subtitle: "Zero EQ • Unity Gain Reference for Instant A/B Comparison",
      preamp: 0.0,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 50, gain: 0.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 120, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 240, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 1000, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 3000, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 5400, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 8000, gain: 0.0, q: 1.0 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 0.0, q: 0.71 }
      ]
    }
  };

  /**
   * CUSTOM SEED PRESETS (Simgot EG280 10mm DD + 6mm Annular Planar Hybrid Profiles)
   * Pre-loaded under Custom Presets so general listeners get universal Standard targets above,
   * while hardware-specific corrections for the EG280 hybrid topology live in the Custom bank.
   *
   * Acoustic basis for Simgot EG280 (32 Ohm, 119 dB/Vrms, 10mm DD + 6mm Planar):
   * - 150-300 Hz lean lower-midrange tuck ("zero bloat" gaming tuning) -> compensated at 210-240 Hz (Q=0.8-0.9)
   * - 6mm Annular Planar Tweeter transient band (2.5-8.5 kHz):
   *   * 3.0-3.2 kHz ear-canal pinna rise -> -1.4 to -1.8 dB (Q=1.6-1.7)
   *   * 5.2-5.5 kHz primary planar diaphragm resonance -> -2.5 to -3.2 dB (Q=2.2-2.5)
   *   * 7.8-8.2 kHz IEC 60318-4 coupler / cymbal peak -> -1.5 to -2.2 dB (Q=2.5-2.8)
   */
  const CUSTOM_SEED_PRESETS = {
    "eg280-shoegaze": {
      id: "eg280-shoegaze",
      category: "custom",
      isSeedCustom: true,
      name: "[Custom] EG280 - Shoegaze & Post-Rock",
      subtitle: "240Hz Guitar Wall + 5.4kHz/7.8kHz Planar Peak Notch (Whirr / Sadness / Inspirative)",
      preamp: -3.2,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 50, gain: 2.2, q: 0.71 },
        { enabled: true, type: "peaking", freq: 120, gain: 0.4, q: 0.9 },
        { enabled: true, type: "peaking", freq: 240, gain: 2.0, q: 0.85 },
        { enabled: true, type: "peaking", freq: 1000, gain: -0.3, q: 1.1 },
        { enabled: true, type: "peaking", freq: 3000, gain: -1.5, q: 1.6 },
        { enabled: true, type: "peaking", freq: 5400, gain: -3.2, q: 2.4 },
        { enabled: true, type: "peaking", freq: 7800, gain: -2.0, q: 2.8 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 0.8, q: 0.71 }
      ]
    },
    "eg280-heavyrock": {
      id: "eg280-heavyrock",
      category: "custom",
      isSeedCustom: true,
      name: "[Custom] EG280 - Heavy Alt & Post-Hardcore",
      subtitle: "100Hz Drum Punch + Rich Guitars + Planar Tame (Darkest Romance / Deftones)",
      preamp: -3.8,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 55, gain: 2.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 100, gain: 1.8, q: 1.0 },
        { enabled: true, type: "peaking", freq: 240, gain: 1.5, q: 0.9 },
        { enabled: true, type: "peaking", freq: 1600, gain: 0.6, q: 1.1 },
        { enabled: true, type: "peaking", freq: 3200, gain: -1.6, q: 1.7 },
        { enabled: true, type: "peaking", freq: 5200, gain: -3.0, q: 2.3 },
        { enabled: true, type: "peaking", freq: 8000, gain: -2.2, q: 2.6 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 0.4, q: 0.71 }
      ]
    },
    "eg280-radiohead": {
      id: "eg280-radiohead",
      category: "custom",
      isSeedCustom: true,
      name: "[Custom] EG280 - Radiohead & Dream/Acoustic",
      subtitle: "210Hz Lush Lower-Mids + Smooth Falsetto (Radiohead / bôa / Greasy Cafe)",
      preamp: -3.0,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 45, gain: 1.5, q: 0.71 },
        { enabled: true, type: "peaking", freq: 210, gain: 2.2, q: 0.8 },
        { enabled: true, type: "peaking", freq: 950, gain: 0.6, q: 1.1 },
        { enabled: true, type: "peaking", freq: 3200, gain: -1.4, q: 1.7 },
        { enabled: true, type: "peaking", freq: 5500, gain: -2.8, q: 2.5 },
        { enabled: true, type: "peaking", freq: 8000, gain: -1.8, q: 2.6 },
        { enabled: true, type: "highshelf", freq: 12500, gain: 0.5, q: 0.71 },
        { enabled: false, type: "peaking", freq: 16000, gain: 0.0, q: 1.0 }
      ]
    },
    "eg280-deepbass": {
      id: "eg280-deepbass",
      category: "custom",
      isSeedCustom: true,
      name: "[Custom] EG280 - Deep Bass (Pop / R&B / Chill)",
      subtitle: "10mm DD Sub-Bass Depth + Clean Vocals (Billie Eilish / Joji / The Neighbourhood)",
      preamp: -5.2,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 55, gain: 3.8, q: 0.71 },
        { enabled: true, type: "peaking", freq: 110, gain: 1.5, q: 1.1 },
        { enabled: true, type: "peaking", freq: 230, gain: 0.8, q: 1.0 },
        { enabled: true, type: "peaking", freq: 1200, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 3400, gain: -1.2, q: 1.5 },
        { enabled: true, type: "peaking", freq: 5500, gain: -2.5, q: 2.2 },
        { enabled: true, type: "peaking", freq: 8200, gain: -1.8, q: 2.5 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 1.0, q: 0.71 }
      ]
    },
    "eg280-balanced": {
      id: "eg280-balanced",
      category: "custom",
      isSeedCustom: true,
      name: "[Custom] EG280 - Balanced Neutral (IEC 60318-4 Fix)",
      subtitle: "Fills 220Hz Lean Tuck + Tames 3.1kHz/5.5kHz/8kHz 6mm Planar Elevation",
      preamp: -2.0,
      limiter: true,
      bands: [
        { enabled: true, type: "lowshelf", freq: 45, gain: 0.0, q: 0.71 },
        { enabled: true, type: "peaking", freq: 120, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 220, gain: 1.5, q: 0.9 },
        { enabled: true, type: "peaking", freq: 1000, gain: 0.0, q: 1.0 },
        { enabled: true, type: "peaking", freq: 3100, gain: -1.8, q: 1.7 },
        { enabled: true, type: "peaking", freq: 5500, gain: -3.0, q: 2.4 },
        { enabled: true, type: "peaking", freq: 8000, gain: -1.5, q: 2.5 },
        { enabled: true, type: "highshelf", freq: 13000, gain: 0.5, q: 0.71 }
      ]
    }
  };

  // Alias FACTORY_PRESETS to STANDARD_PRESETS for clean backward compatibility
  const FACTORY_PRESETS = STANDARD_PRESETS;

  /**
   * ISO 226:2003 / 2023 Equal-Loudness Low-Volume Comfort Compensation:
   * - +2.0 dB LowShelf @ 75 Hz: compensates for steep 60-phon bass sensitivity drop
   * - -2.0 dB Peaking @ 3500 Hz (Q=1.4): relieves the ear-canal quarter-wave resonance sensitivity peak
   * - +0.8 dB HighShelf @ 11500 Hz: preserves low-SPL high-frequency air micro-details
   */
  const COMFORT_BANDS = [
    { enabled: true, type: "lowshelf", freq: 75, gain: 2.0, q: 0.71 },
    { enabled: true, type: "peaking", freq: 3500, gain: -2.0, q: 1.4 },
    { enabled: true, type: "highshelf", freq: 11500, gain: 0.8, q: 0.71 }
  ];

  /**
   * Deep Work / Coding Focus Mode (Salamé & Baddeley 1989 Irrelevant Speech Effect compensation):
   * - -2.2 dB Peaking @ 1850 Hz (Q=1.05): recesses lead vocal / speech consonant intelligibility band (1-3.2 kHz)
   *   so lyrics melt into the instrumental wall without disrupting verbal working memory during coding/data work.
   * - +1.0 dB LowShelf @ 65 Hz (Q=0.71): adds warm ambient low-end anchor.
   */
  const FOCUS_BANDS = [
    { enabled: true, type: "lowshelf", freq: 65, gain: 1.0, q: 0.71 },
    { enabled: true, type: "peaking", freq: 1850, gain: -2.2, q: 1.05 }
  ];

  // Ordered intentionally: Acoustic/Unplugged overrides -> Shoegaze/Post-Rock -> Heavy Alt -> Dream/Indie -> Pop/Bass
  // Maps each genre rule to BOTH a Custom (EG280) preset and a Standard (Universal) preset
  const AUTO_DJ_RULES = [
    {
      customPresetId: "eg280-radiohead",
      standardPresetId: "std-vocal",
      keywords: [
        "acoustic",
        "unplugged",
        "audiotree",
        "tiny desk",
        "live session",
        "slowed + reverb"
      ]
    },
    {
      customPresetId: "eg280-shoegaze",
      standardPresetId: "std-rock",
      keywords: [
        "sadness",
        "whirr",
        "airiel",
        "tokyo shoegazer",
        "deafcult",
        "death of heather",
        "yuragi",
        "wisp",
        "seventeen years old",
        "berlin wall",
        "inspirative",
        "desktop error",
        "abstraction xl",
        "moondivve",
        "night tingle",
        "moving and cut",
        "moving & cut",
        "under the big bright yellow sun",
        "sunlight ascending",
        "image center",
        "ziriphon fireking",
        "saikeib",
        "12bh",
        "goji-sanpun",
        "vavava",
        "flawed mangoes",
        "ethel cain",
        "my bloody valentine",
        "slowdive",
        "cocteau twins",
        "mogwai",
        "explosions in the sky",
        "mono",
        "godspeed you",
        "low",
        "shoegaze",
        "blackgaze",
        "post-rock",
        "dream pop",
        "ambient"
      ]
    },
    {
      customPresetId: "eg280-heavyrock",
      standardPresetId: "std-rock",
      keywords: [
        "the darkest romance",
        "deftones",
        "smashing pumpkins",
        "monomania",
        "silly fools",
        "wila",
        "bomb at track",
        "lomosonic",
        "linkin park",
        "nothing but thieves",
        "oasis",
        "slur",
        "solitude is bliss",
        "bodyslam",
        "bring me the horizon",
        "architects",
        "spiritbox",
        "muse",
        "foo fighters",
        "nirvana",
        "alice in chains",
        "soundgarden",
        "tool",
        "korn",
        "slipknot",
        "system of a down",
        "metal",
        "post-hardcore",
        "hard rock"
      ]
    },
    {
      customPresetId: "eg280-radiohead",
      standardPresetId: "std-vocal",
      keywords: [
        "radiohead",
        "the smile",
        "bôa",
        "boa",
        "air",
        "alone in kyoto",
        "mitski",
        "damien rice",
        "pinegrove",
        "mac demarco",
        "dr. dog",
        "the black skirts",
        "nada surf",
        "she & him",
        "the veils",
        "greasy cafe",
        "mamao",
        "pru",
        "ornaree",
        "barbies",
        "cornboi",
        "yellow butter cult",
        "ymy",
        "sok",
        "dumb.rong",
        "the public mansion",
        "day tripper",
        "freehand",
        "ayla's",
        "buddhist holiday",
        "tofu (th)",
        "เสมือนฝัน",
        "mr' พระจันทร์",
        "tah and friends",
        "blue's bar",
        "vega",
        "little john",
        "sitta",
        "anatomy rabbit",
        "rehash",
        "redoor",
        "velika",
        "cafetorium",
        "solomon",
        "ponn.",
        "โจรลอยนวล",
        "25hours",
        "the 1975",
        "cavetown",
        "gigi perez",
        "yourmood",
        "sqweez",
        "มนัสวีร์",
        "สุขอรุณ",
        "goose",
        "live in oslo",
        "bon iver",
        "phoebe bridgers",
        "clairo",
        "men i trust",
        "cigarettes after sex",
        "beach house",
        "lana del rey",
        "norah jones",
        "john mayer"
      ]
    },
    {
      customPresetId: "eg280-deepbass",
      standardPresetId: "std-bass",
      keywords: [
        "billie eilish",
        "joji",
        "the neighbourhood",
        "sombr",
        "malcolm todd",
        "chezile",
        "timethai",
        "juice wrld",
        "pami",
        "worrx",
        "bangkokciaga",
        "gwak tae poong",
        "zeedox",
        "sukid458",
        "guncharlie",
        "cup of joe",
        "daniel",
        "bangkok scene",
        "3v07",
        "nathaniel constantin",
        "rouse",
        "the weeknd",
        "travis scott",
        "kendrick lamar",
        "drake",
        "sza",
        "frank ocean",
        "metro boomin",
        "post malone",
        "daft punk",
        "fred again",
        "skrillex",
        "hip-hop",
        "r&b",
        "synthwave",
        "phonk"
      ]
    }
  ];

  function isEg280CustomMode(activePresetId = "") {
    return String(activePresetId).startsWith("eg280-");
  }

  function resolveAutoPreset(title = "", artist = "", activePresetId = "") {
    const haystack = `${title} ${artist}`.toLowerCase();
    if (!haystack.trim()) return null;
    const useEg280 = isEg280CustomMode(activePresetId);
    for (const rule of AUTO_DJ_RULES) {
      for (const kw of rule.keywords) {
        if (haystack.includes(kw)) {
          return useEg280 ? rule.customPresetId : rule.standardPresetId;
        }
      }
    }
    return null;
  }

  function clonePreset(preset) {
    return JSON.parse(JSON.stringify(preset));
  }

  function mergeSeedCustomPresets(existingCustom = {}) {
    return {
      ...clonePreset(CUSTOM_SEED_PRESETS),
      ...(existingCustom || {})
    };
  }

  function createDefaultState() {
    const initial = clonePreset(STANDARD_PRESETS["std-harman"]);
    return {
      bypass: false,
      autoDj: false,
      crossfeed: false,
      comfort: false,
      focus: false,
      leveler: false,
      activePresetId: initial.id,
      preamp: initial.preamp,
      limiter: initial.limiter,
      bands: initial.bands,
      customPresets: clonePreset(CUSTOM_SEED_PRESETS),
      channelMemory: {}
    };
  }

  /**
   * Parse either JSON profile or Equalizer APO / Squiglink / AutoEQ .txt format.
   */
  function parseImportedProfile(rawText) {
    const trimmed = (rawText || "").trim();
    if (!trimmed) throw new Error("Input is empty");

    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed.bands) || parsed.bands.length === 0) {
        throw new Error("JSON missing bands array");
      }
      return {
        preamp: typeof parsed.preamp === "number" ? parsed.preamp : null,
        limiter: typeof parsed.limiter === "boolean" ? parsed.limiter : null,
        bands: parsed.bands.slice(0, 8).map((b) => ({
          enabled: b.enabled !== false,
          type: ["lowshelf", "peaking", "highshelf"].includes(b.type) ? b.type : "peaking",
          freq: Math.max(20, Math.min(20000, Number(b.freq) || 1000)),
          gain: Math.max(-15, Math.min(15, Number(b.gain) || 0)),
          q: Math.max(0.2, Math.min(12, Number(b.q) || 1.0))
        }))
      };
    }

    let preamp = null;
    const filters = [];
    const lines = trimmed.split(/\r?\n/);

    for (const line of lines) {
      const clean = line.trim();
      if (!clean || clean.startsWith("#")) continue;

      const preampMatch = clean.match(/^Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*dB/i);
      if (preampMatch) {
        preamp = Math.max(-12, Math.min(6, parseFloat(preampMatch[1])));
        continue;
      }

      const filterMatch = clean.match(
        /^Filter(?:\s+\d+)?:\s*(ON|OFF)\s+(PK|PEQ|LSC|LS|HSC|HS)\s+Fc\s+(\d+(?:\.\d+)?)\s*Hz\s+Gain\s+([+-]?\d+(?:\.\d+)?)\s*dB(?:\s+Q\s+(\d+(?:\.\d+)?))?/i
      );
      if (filterMatch) {
        const enabled = filterMatch[1].toUpperCase() === "ON";
        const code = filterMatch[2].toUpperCase();
        const type =
          code === "LSC" || code === "LS"
            ? "lowshelf"
            : code === "HSC" || code === "HS"
            ? "highshelf"
            : "peaking";
        const freq = Math.max(20, Math.min(20000, parseFloat(filterMatch[3])));
        const gain = Math.max(-15, Math.min(15, parseFloat(filterMatch[4])));
        const q = filterMatch[5] ? Math.max(0.2, Math.min(12, parseFloat(filterMatch[5]))) : 0.71;
        filters.push({ enabled, type, freq, gain, q });
      }
    }

    if (filters.length === 0) {
      throw new Error("No valid JSON or Equalizer APO / Squiglink Filter lines found");
    }

    let selected = filters;
    if (selected.length > 8) {
      selected = [...filters]
        .sort((a, b) => (b.enabled ? Math.abs(b.gain) : -1) - (a.enabled ? Math.abs(a.gain) : -1))
        .slice(0, 8)
        .sort((a, b) => a.freq - b.freq);
    }

    return { preamp, limiter: true, bands: selected };
  }

  /**
   * Exact W3C Web Audio API / RBJ Audio EQ Cookbook Biquad Transfer Function Coefficients
   * Matches Chromium Blink Biquad.cpp implementation (peaking uses classic Q; shelves use S=1 / Q=1/sqrt(2)).
   */
  function getBiquadCoefficients(type, freq, gainDb, q, sampleRate = 48000) {
    const clampedFreq = Math.max(10, Math.min(freq, sampleRate * 0.49));
    const w0 = (2 * Math.PI * clampedFreq) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const A = Math.pow(10, gainDb / 40);
    const safeQ = Math.max(0.1, q || 1.0);

    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

    if (type === "peaking") {
      const alpha = sinW0 / (2 * safeQ);
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
    } else if (type === "lowshelf") {
      const alpha = (sinW0 / 2) * Math.SQRT2;
      const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha);
      b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 = A * ((A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha);
      a0 = (A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha;
      a1 = -2 * ((A - 1) + (A + 1) * cosW0);
      a2 = (A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha;
    } else if (type === "highshelf") {
      const alpha = (sinW0 / 2) * Math.SQRT2;
      const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 = A * ((A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha);
      a0 = (A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha;
      a1 = 2 * ((A - 1) - (A + 1) * cosW0);
      a2 = (A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha;
    }

    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0
    };
  }

  function evaluateMagnitudeDb(bands, freq, sampleRate = 48000, comfort = false, focus = false) {
    const w = (2 * Math.PI * freq) / sampleRate;
    const cos1 = Math.cos(w);
    const sin1 = Math.sin(w);
    const cos2 = Math.cos(2 * w);
    const sin2 = Math.sin(2 * w);

    let allBands = bands || [];
    if (comfort) allBands = [...allBands, ...COMFORT_BANDS];
    if (focus) allBands = [...allBands, ...FOCUS_BANDS];
    let totalMagSq = 1.0;

    for (const band of allBands) {
      if (!band || !band.enabled || Math.abs(band.gain) < 0.001) continue;
      const c = getBiquadCoefficients(band.type, band.freq, band.gain, band.q, sampleRate);

      const numRe = c.b0 + c.b1 * cos1 + c.b2 * cos2;
      const numIm = -c.b1 * sin1 - c.b2 * sin2;
      const denRe = 1 + c.a1 * cos1 + c.a2 * cos2;
      const denIm = -c.a1 * sin1 - c.a2 * sin2;

      const numSq = numRe * numRe + numIm * numIm;
      const denSq = denRe * denRe + denIm * denIm;
      if (denSq > 0) {
        totalMagSq *= numSq / denSq;
      }
    }

    return 10 * Math.log10(Math.max(1e-12, totalMagSq));
  }

  /**
   * Computes exact composite peak gain across 20 Hz - 20 kHz for cascaded biquad filters,
   * accounting for overlapping filter summation, ISO 226 Comfort bands, and Deep Work Focus bands.
   */
  function computePeakGainDb(bands, sampleRate = 48000, comfort = false, focus = false) {
    let peakDb = -Infinity;
    const minF = 20;
    const maxF = 20000;
    const steps = 256;

    for (let i = 0; i <= steps; i++) {
      const f = minF * Math.pow(maxF / minF, i / steps);
      const db = evaluateMagnitudeDb(bands, f, sampleRate, comfort, focus);
      if (db > peakDb) peakDb = db;
    }

    let allBands = bands || [];
    if (comfort) allBands = [...allBands, ...COMFORT_BANDS];
    if (focus) allBands = [...allBands, ...FOCUS_BANDS];
    for (const b of allBands) {
      if (b && b.enabled && b.freq >= 20 && b.freq <= 20000) {
        const db = evaluateMagnitudeDb(bands, b.freq, sampleRate, comfort, focus);
        if (db > peakDb) peakDb = db;
      }
    }

    return Number.isFinite(peakDb) ? peakDb : 0.0;
  }

  /**
   * Adaptive Listener Feedback Learning Step:
   * Adjusts target biquad bands by a bounded damped step (0.3 dB) based on real-time listening observations:
   * - "sharp_treble": tames 4.5-8.5 kHz sibilance / planar tweeter peaks (-0.3 dB)
   * - "vocal_glare": tames 2.5-3.8 kHz ear-canal pinna harshness (-0.3 dB)
   * - "thin_mids": warms 180-280 Hz lower-mid fundamental body (+0.3 dB)
   * - "muddy_bass": cleans 100-250 Hz upper-bass masking (-0.3 dB)
   */
  function applyEarFeedbackStep(bands, issueType) {
    const next = clonePreset(bands || []);
    for (const b of next) {
      if (!b.enabled) continue;
      const f = Number(b.freq) || 1000;
      if (issueType === "sharp_treble" && f >= 4500 && f <= 8500) {
        b.gain = Math.round(Math.max(-12, b.gain - 0.3) * 10) / 10;
      } else if (issueType === "vocal_glare" && f >= 2500 && f < 4500) {
        b.gain = Math.round(Math.max(-12, b.gain - 0.3) * 10) / 10;
      } else if (issueType === "thin_mids" && f >= 170 && f <= 300) {
        b.gain = Math.round(Math.min(12, b.gain + 0.3) * 10) / 10;
      } else if (issueType === "muddy_bass" && f >= 95 && f <= 250) {
        b.gain = Math.round(Math.max(-12, b.gain - 0.3) * 10) / 10;
      }
    }
    return next;
  }

  globalThis.EG280_PEQ = {
    STANDARD_PRESETS,
    CUSTOM_SEED_PRESETS,
    FACTORY_PRESETS,
    COMFORT_BANDS,
    FOCUS_BANDS,
    AUTO_DJ_RULES,
    isEg280CustomMode,
    resolveAutoPreset,
    parseImportedProfile,
    clonePreset,
    mergeSeedCustomPresets,
    createDefaultState,
    getBiquadCoefficients,
    evaluateMagnitudeDb,
    computePeakGainDb,
    applyEarFeedbackStep
  };
})();
