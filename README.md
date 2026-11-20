# Aether PEQ

8-band parametric equalizer, constant-power BS2B crossfeed, ISO 226:2023 loudness contour, and true-peak limiter for YouTube Music and YouTube (Manifest V3 Chrome Extension).

Most browser equalizers use fixed graphic bands (`31 Hz, 62 Hz, 125 Hz...`) and naive filter cascades that clip on bass-heavy masters or smear transients with narrow-Q phase shift. Aether PEQ runs a phase-coherent 64-bit Web Audio IIR pipeline where every preset is verified against four objective acoustic constraints:

1. **Composite True-Peak Headroom (ITU-R BS.1770-4)**: Cascaded biquad filters sum in the complex plane, so overlapping low-shelf and peaking filters often exceed any individual band's gain setting. Auto-Preamp evaluates the composite transfer function across 256 logarithmic frequency points ($20\text{ Hz} - 20\text{ kHz}$) to keep net peak ceiling below $-0.2\text{ dBFS}$.
2. **Group Delay Audibility Bound (Blauert & Laws, 1978)**: High-Q filters introduce narrow-band group delay spikes ($\tau_g(\omega) = -d\phi/d\omega$) that blur drum transients and plucked strings. All 12 factory and hardware profiles constrain midrange/treble group delay to $< 0.06\text{ ms}$ (more than 25x below the $1.6\text{ ms}$ human audibility threshold above $1\text{ kHz}$).
3. **Constant-Power Head-Shadow Crossfeed (Bauer 1961 / Linkwitz 1971 / BS2B)**: Naive stereo crossfeed bleeds low frequencies across channels without compensating the direct path, inflating mono bass by $+1.65\text{ dB}$. Aether PEQ pairs a $700\text{ Hz}$ low-pass + $260\text{ }\mu\text{s}$ interaural delay ($r = 8.75\text{ cm}$ head radius at $\pm 30^\circ$) with a $+1.724\text{ dB}$ high-shelf on the direct channels, maintaining $0.0000\text{ dB}$ flat mono response from $20\text{ Hz}$ to $20\text{ kHz}$.
4. **Zero-Comb-Filtering Bypass**: Chromium's `DynamicsCompressorNode` has a fixed $6.0\text{ ms}$ internal lookahead buffer ($288\text{ samples}$ at $48\text{ kHz}$). Crossfading a parallel $0\text{ ms}$ dry wire against a $6\text{ ms}$ wet pipeline creates deep comb-filter notches at $83.3\text{ Hz}$ and $250\text{ Hz}$. Aether PEQ routes audio through a single time-aligned pipeline and ramps filter gains smoothly in-place ($\tau = 15\text{ ms}$) on bypass.

---

## Architecture & Preset Banks

The preset library separates universal acoustic targets from hardware-specific hybrid IEM corrections:

### 1. Standard Acoustic Targets (Universal Headphones / IEMs / Monitors)

| Profile ID | Target Basis | Max Boost | Preamp | Net Ceiling | Max Group Delay ($1-10\text{ kHz}$) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `std-harman` | Olive & Welti (AES 2013-2019) Consumer Preference | $+2.78\text{ dB}$ | $-3.2\text{ dB}$ | $-0.42\text{ dBFS}$ | $0.026\text{ ms}$ |
| `std-diffuse` | ISO 11904-1 / B&K 5128 Diffuse Field ($-0.8\text{ dB/oct}$ tilt) | $+1.97\text{ dB}$ | $-2.4\text{ dB}$ | $-0.43\text{ dBFS}$ | $0.020\text{ ms}$ |
| `std-vocal` | $185\text{ Hz}$ Fundamental + $1.25\text{ kHz}$ Formant + $6.8\text{ kHz}$ De-Esser | $+1.56\text{ dB}$ | $-2.4\text{ dB}$ | $-0.84\text{ dBFS}$ | $0.052\text{ ms}$ |
| `std-bass` | $55\text{ Hz}$ Sub-Shelf + $95\text{ Hz}$ Punch + $230\text{ Hz}$ Anti-Masking Cut | $+3.97\text{ dB}$ | $-5.2\text{ dB}$ | $-1.23\text{ dBFS}$ | $0.020\text{ ms}$ |
| `std-rock` | $105\text{ Hz}$ Kick + $240\text{ Hz}$ Guitar Body + $3.4/5.8\text{ kHz}$ Anti-Glare | $+2.04\text{ dB}$ | $-3.5\text{ dB}$ | $-1.46\text{ dBFS}$ | $0.033\text{ ms}$ |
| `std-late-night` | ISO 226:2023 ($60\text{ phon}$ vs $80\text{ phon}$ Low-SPL Differential) | $+2.98\text{ dB}$ | $-3.6\text{ dB}$ | $-0.62\text{ dBFS}$ | $0.035\text{ ms}$ |
| `flat` | $0.0\text{ dB}$ Bit-Transparent Unity Reference | $+0.00\text{ dB}$ | $+0.0\text{ dB}$ | $+0.00\text{ dBFS}$ | $0.000\text{ ms}$ |

### 2. Custom Hardware Profiles: Simgot EG280 (10mm DD + 6mm Annular Planar)

The Simgot EG280 uses a 10mm dynamic driver for lows/mids and a 6mm annular planar magnetic tweeter for the $2.5 - 8.5\text{ kHz}$ transient band. Out of the box, its gaming-oriented tuning keeps $150 - 300\text{ Hz}$ intentionally lean while emphasizing $3.1\text{ kHz}$ (ear-canal pinna rise), $5.4\text{ kHz}$ (primary planar diaphragm resonance), and $8.0\text{ kHz}$ (IEC 60318-4 coupler/cymbal peak).

Running the raw EG280 response against Sean Olive's predicted preference equation ($P_{\text{score}} = 114.49 - 12.62 \cdot \text{SD}_{\text{error}} - 15.52 \cdot |\text{AS}_{\text{error}}|$) yields a baseline score of **$72.9 / 100$** ($\text{SD}_{\text{error}} = 1.36\text{ dB}$). The five seeded custom profiles correct the $210 - 240\text{ Hz}$ tuck and notch the planar resonances:

| Profile ID | Target Genre / Application | $\text{SD}_{\text{error}}$ | Olive Score | $220\text{ Hz}$ | $5.4\text{ kHz}$ | $8.0\text{ kHz}$ | Max Group Delay |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `eg280-balanced` | IEC 60318-4 Reference Correction | $0.15\text{ dB}$ | $100.0 / 100$ | $+1.50\text{ dB}$ | $-3.53\text{ dB}$ | $-2.12\text{ dB}$ | $0.047\text{ ms}$ |
| `eg280-shoegaze` | Shoegaze & Post-Rock Guitar Walls | $0.21\text{ dB}$ | $100.0 / 100$ | $+2.12\text{ dB}$ | $-3.77\text{ dB}$ | $-2.53\text{ dB}$ | $0.051\text{ ms}$ |
| `eg280-radiohead` | Art-Rock, Acoustic Live & Falsetto | $0.14\text{ dB}$ | $100.0 / 100$ | $+2.22\text{ dB}$ | $-3.30\text{ dB}$ | $-2.32\text{ dB}$ | $0.046\text{ ms}$ |
| `eg280-heavyrock` | Post-Hardcore & Alternative Metal | $0.27\text{ dB}$ | $100.0 / 100$ | $+1.92\text{ dB}$ | $-3.50\text{ dB}$ | $-2.72\text{ dB}$ | $0.047\text{ ms}$ |
| `eg280-deepbass` | Sub-Bass R&B / Electronic | $0.38\text{ dB}$ | $100.0 / 100$ | $+1.21\text{ dB}$ | $-3.08\text{ dB}$ | $-2.33\text{ dB}$ | $0.036\text{ ms}$ |

---

## Psychoacoustic Processing & Ear Calibration Lab

- **Deep Work Focus Mode (`FOCUS` / `Alt+F`)**: Based on the Irrelevant Speech Effect (Salame & Baddeley, 1989). Applies a $-2.2\text{ dB}$ peaking cut at $1,850\text{ Hz}$ ($Q=1.05$) across the human consonant intelligibility band ($1.0 - 3.2\text{ kHz}$) plus a $+1.0\text{ dB}$ low-shelf at $65\text{ Hz}$. Vocals step back behind the instrumentation so lyrics do not compete with verbal working memory while coding or reading.
- **Smart Short-Term RMS Leveler (`LEVEL` / `Alt+L`)**: Samples time-domain RMS every $250\text{ ms}$ (ignoring silence below $-48\text{ dBFS}$) and rides a dedicated pre-filter gain stage within $\pm 4.0\text{ dB}$ ($\tau = 220\text{ ms}$). Normalizes quiet live sessions against loud commercial masters on YouTube without crushing dynamic transients.
- **Double-Blind A/B Test & Adaptive Ear Tuning (`EAR LAB`)**:
  - **Double-Blind X/Y**: Randomly assigns `SAMPLE X` and `SAMPLE Y` between the active EQ curve and a $0\text{ dB}$ flat bypass so you can verify whether an adjustment actually improves the track without visual confirmation bias.
  - **Damped Symptom Adaptation**: Four symptom triggers (`-SHARP 5-8k`, `-GLARE 3k`, `+BODY 220Hz`, `-MUD 150Hz`) apply bounded $\pm 0.3\text{ dB}$ steps to the responsible critical bands and recompute true-peak headroom automatically.
- **Auto-DJ + Per-Channel EQ Memory**: Automatically switches presets by artist/genre metadata (routing within the Standard bank or Custom EG280 bank depending on your active mode) and remembers your manual preset selection for individual YouTube channels.

---

## Installation (Chrome / Edge / Brave)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this repository root folder (`popup/` is pre-compiled).
3. Open YouTube Music or YouTube. Use `Alt+B` (Bypass), `Alt+F` (Focus Mode), `Alt+L` (Smart Leveler), or `Alt+X` (BS2B Crossfeed) directly on the page.

---

## Running the Acoustic Test Bench & Rebuilding the UI

```bash
# Run mathematical transfer-function, group-delay, and Olive score verification
python research/acoustic_lab.py
python verify_dsp.py

# Rebuild the React + Tailwind popup bundle into ./popup
cd ui
npm install
npm run build
```

## License

MIT License. See [LICENSE](LICENSE).
