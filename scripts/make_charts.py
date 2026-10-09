#!/usr/bin/env python3
"""Regenerate the README charts from real telemetry.

Runs the ACTUAL `src/sim/world.ts` headlessly via `scripts/sim-telemetry.mjs`
(one deterministic 30 fps run, default seed 2401 for 1800 s), then plots the
per-second statistics the simulation records itself.

Requires:
  - Node and `npm ci` (esbuild ships with the Vite toolchain)
  - Python 3 with matplotlib and numpy (e.g. `pip install matplotlib numpy`)

Usage:
  python3 scripts/make_charts.py [out-dir] [telemetry.json]
  out-dir       defaults to docs/images (relative to the repository root)
  telemetry.json  defaults to `node scripts/sim-telemetry.mjs` run in a temp dir
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

def rgba(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "docs", "images"))
os.makedirs(OUT, exist_ok=True)

if len(sys.argv) > 2:
    TELEMETRY = os.path.abspath(sys.argv[2])
else:
    TELEMETRY = os.path.join(tempfile.mkdtemp(prefix="sonogenesis-charts-"), "telemetry.json")
    subprocess.run(
        ["node", os.path.join(REPO, "scripts", "sim-telemetry.mjs"), "2401", "1800", TELEMETRY],
        check=True,
    )

data = json.load(open(TELEMETRY))
s = data["stats"]
T = np.array([x["t"] for x in s])
POP = np.array([x["pop"] for x in s])
FOOD = np.array([x["food"] for x in s])
SPP = np.array([len(x["species"]) for x in s])
BIRTHS = np.array([x["births"] for x in s])
DEATHS = np.array([x["deaths"] for x in s])
CALLS = np.array([x["calls"] for x in s])
DIVERSITY = np.array([x["diversity"] for x in s])
MEANGEN = np.array([x["meanGen"] for x in s])
MEANFREQ = np.array([x["meanFreq"] for x in s])
CALLMIX = {t: np.array([x["callMix"].get(t, 0) for x in s]) for t in
           ["pulse", "social", "mating", "territory", "food", "distress"]}
ZONES = data["zones"]
ZS = np.array(data["series"]["zones"])  # n x 5
TZ = np.array(data["series"]["t"])  # per-second time axis for the zone series
EVENTS = [e for e in data["events"] if e.get("kind") in ("speciation", "extinction")]

# ---- style
BG = "#04080f"
PANEL = "#071019"
GRID = rgba("#78c8ff", 0.08)
TEXT = "#d8f6ff"
DIM = rgba("#cffafe", 0.55)
CYAN = "#7fd8ff"
MINT = "#a0ffc8"
AMBER = "#ffe27a"
PINK = "#ff8fd8"
CORAL = "#ff7a8a"
VIOLET = "#c78bff"
MONO = "DejaVu Sans Mono"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": PANEL, "savefig.facecolor": BG,
    "text.color": TEXT, "axes.edgecolor": rgba("#67e8f9", 0.25),
    "axes.labelcolor": TEXT, "xtick.color": DIM, "ytick.color": DIM,
    "font.family": MONO, "font.size": 9,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.7,
    "axes.spines.top": False, "axes.spines.right": False,
})


def rgba(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)

def style_ax(ax):
    for spine in ax.spines.values():
        spine.set_visible(True)
        spine.set_color(rgba("#67e8f9", 0.18))


def hsl(h, s, l):
    import colorsys
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, l, s)
    return (r, g, b)


def event_rug(ax, y=0):
    for e in EVENTS:
        col = "#ff6a7a" if e["kind"] == "extinction" else hsl(e.get("hue", 190), 0.8, 0.65)
        ax.axvline(e["t"], color=col, alpha=0.25, linewidth=0.8, ymin=0, ymax=0.06)


def header(fig, title, sub):
    fig.text(0.045, 0.965, title, fontsize=13, color=TEXT, weight="bold")
    fig.text(0.045, 0.905, sub, fontsize=8, color=DIM)


def seed_note(fig):
    fig.text(0.955, 0.02, f"seed {data['seed']} · t = 0–{int(T[-1])}s · 1× sim",
             fontsize=7, color=rgba("#cffafe", 0.35), ha="right")


# ---- 1. population
fig, ax = plt.subplots(figsize=(8.6, 4.0), dpi=200)
ax.fill_between(T, POP, color=CYAN, alpha=0.13)
ax.plot(T, POP, color=CYAN, linewidth=1.6, label="population")
ax.plot(T, SPP * 8, color=MINT, linewidth=1.4, label="living species ×8")
ax.set_xlabel("simulated time (s)")
ax.set_ylabel("")
ax.set_title("")
ax.set_xlim(0, T[-1])
ax.set_ylim(0, max(POP.max() * 1.15, SPP.max() * 8 * 1.25) + 6)
ax.text(T[-1] + 15, POP[-1] - 2, "population", color=CYAN, fontsize=8, va="center")
ax.text(T[-1] + 15, SPP[-1] * 8 - 2, "living species ×8", color=MINT, fontsize=8, va="center")
event_rug(ax)
style_ax(ax)
header(fig, "Population dynamics",
       "Founder lineages (8 species, 40 organisms) seed, diversify, and settle near the carrying cap. Faint ticks mark speciation (colored) and extinction (red) events.")
seed_note(fig)
fig.savefig(f"{OUT}/chart-population.png", bbox_inches="tight")
plt.close(fig)

# ---- 2. communication mix (stacked calls/s)
fig, ax = plt.subplots(figsize=(8.6, 4.0), dpi=200)
def movavg(a, w=20):
    k = np.ones(w) / w
    return np.convolve(a, k, mode="same")

mix = {t: movavg(v) for t, v in CALLMIX.items() if v.sum() > 0}
order = ["pulse", "social", "mating", "territory", "food", "distress"]
bottom = np.zeros_like(T)
colors = {"pulse": CYAN, "social": MINT, "mating": PINK, "territory": "#ff6a3d", "food": AMBER, "distress": "#ff3355"}
for t in order:
    if t not in mix:
        continue
    top = bottom + mix[t]
    ax.fill_between(T, bottom, top, color=colors[t], alpha=0.75, linewidth=0)
    bottom = top
ax.set_xlabel("simulated time (s)")
ax.set_ylabel("calls / s")
ax.set_xlim(0, T[-1])
handles = [plt.Rectangle((0, 0), 1, 1, color=colors[t]) for t in order if t in mix]
ax.legend(handles, [t.upper() for t in order if t in mix], loc="upper left", fontsize=7.5,
          framealpha=0.3, facecolor=BG, edgecolor="none", labelcolor=TEXT, ncol=3)
style_ax(ax)
ax.set_ylim(0, CALLS.max() * 1.18)
header(fig, "Vocal ecology",
       "Calls per second (20 s moving average), stacked by class. Pulse-coupled rhythm, courtship, territorial display and foraging signals emerge from genome-expressed call rates and habitat acoustics.")
seed_note(fig)
fig.savefig(f"{OUT}/chart-communication.png", bbox_inches="tight")
plt.close(fig)

# ---- 3. habitat occupancy
fig, ax = plt.subplots(figsize=(8.6, 4.0), dpi=200)
bottom = np.zeros_like(TZ)
zone_cols = []
for i, z in enumerate(ZONES):
    c = z["color2"]
    rgb = tuple(v for v in c)
    zone_cols.append(rgb)
    top = bottom + ZS[:, i]
    ax.fill_between(TZ, bottom, top, color=rgb, alpha=0.8, linewidth=0)
    bottom = top
ax.set_xlabel("simulated time (s)")
ax.set_ylabel("organisms")
ax.set_xlim(0, TZ[-1])
ax.set_ylim(0, ZS.sum(axis=1).max() * 1.22)
handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in zone_cols]
ax.legend(handles, [z["name"].replace("The ", "") for z in ZONES], loc="upper left", fontsize=7.5,
          framealpha=0.3, facecolor=BG, edgecolor="none", labelcolor=TEXT, ncol=5)
style_ax(ax)
header(fig, "Spatial ecology",
       "Population by habitat. Thermal preferences, nutrient plumes and acoustic windows push lineages into different zones; organisms transplant across boundaries as they drift.")
seed_note(fig)
fig.savefig(f"{OUT}/chart-habitats.png", bbox_inches="tight")
plt.close(fig)

# ---- 4. evolution: births/deaths + mean generation & diversity
fig, (a1, a2) = plt.subplots(1, 2, figsize=(8.6, 4.0), dpi=200, sharex=True)
a1.plot(T, BIRTHS, color=MINT, linewidth=1.3, label="births / s")
a1.plot(T, DEATHS, color=CORAL, linewidth=1.3, label="deaths / s")
a1.legend(loc="upper left", fontsize=8, framealpha=0.3, facecolor=BG, edgecolor="none", labelcolor=TEXT)
a1.set_ylabel("events / s")
a1.set_ylim(-1.2, BIRTHS.max() * 1.4)
style_ax(a1)
a2.plot(T, MEANGEN, color=VIOLET, linewidth=1.4, label="mean generation")
a2.set_ylim(0, MEANGEN.max() * 1.4)
a2.set_xlim(0, T[-1])
a2.set_ylabel("generation", color=VIOLET)
a2.tick_params(axis="y", colors=VIOLET)
a3 = a2.twinx()
a3.plot(T, DIVERSITY, color=CYAN, linewidth=1.3, linestyle="--", label="Shannon H")
a3.set_ylabel("Shannon H", color=CYAN)
a3.tick_params(axis="y", colors=CYAN)
for spine in a3.spines.values():
    spine.set_visible(True)
    spine.set_color(rgba("#7dd8ff", 0.25))
style_ax(a2)
header(fig, "Evolution in action",
       "Left: births and deaths per second. Right: mean generation (solid) and species-level Shannon diversity (dashed) — lineages diverge, speciate, and accumulate mutations.")
seed_note(fig)
fig.savefig(f"{OUT}/chart-evolution.png", bbox_inches="tight")
plt.close(fig)

# ---- 5. habitat profile strip (preset params per zone, seed order)
keys = [("resourceRate", "nutrient flux"), ("light", "light"), ("temperature", "temperature"),
        ("pressure", "pressure"), ("instability", "electrical static"), ("resonance", "resonance"),
        ("spectralCenter", "acoustic window"), ("tonality", "tonal clarity"), ("damping", "acoustic damping"),
        ("mutationMul", "radiation ×3")]
fig, axes = plt.subplots(1, len(ZONES), figsize=(14.4, 4.4), dpi=200)
fig.subplots_adjust(top=0.80)
for i, (z, ax) in enumerate(zip(ZONES, axes)):
    c = z["color2"]
    vals = [z[k] if k != "mutationMul" else z[k] / 3 for k, _ in keys]
    labels = [lab for _, lab in keys]
    y = np.arange(len(keys))[::-1]
    bars = ax.barh(y, vals, color=c, alpha=0.85, height=0.62)
    ax.set_yticks(y)
    ax.set_yticklabels(labels if i == 0 else [""] * len(labels), fontsize=7.5, color=TEXT)
    ax.set_xlim(0, 1.05)
    ax.set_title(z["name"].replace("The ", "").upper(), fontsize=10.5,
                 color=tuple(min(1.0, v + 0.3) for v in c), pad=10, weight="bold")
    for spine in ax.spines.values():
        spine.set_color(rgba("#67e8f9", 0.18))
    ax.tick_params(axis="x", colors=DIM, labelsize=7)
    ax.grid(axis="x", color=GRID, linewidth=0.7)
    ax.grid(axis="y", visible=False)
    for b, v in zip(bars, vals):
        ax.text(b.get_width() + 0.015, b.get_y() + b.get_height() / 2, f"{v:.2f}",
                va="center", fontsize=7, color=rgba("#d8f6ff", 0.8))
header(fig, "Five habitats, five acoustic worlds",
       "Per-zone parameters that shape selection (seed 2401 order, after seeded ±5% variation). Each zone favors different bodies, speeds and voices.")
fig.savefig(f"{OUT}/fig-habitats.png", bbox_inches="tight")
plt.close(fig)

print("charts written to", OUT)
