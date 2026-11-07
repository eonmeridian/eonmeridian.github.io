#!/usr/bin/env python3
"""Generate paper-palette SVG plates for projects that have no documentation image.

These are marks, not photographs: each is a deterministic diagram derived from the
project's slug, drawn in the site's own visual language.
"""
import math, hashlib, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "img"
W, H = 800, 600
INK, LINE, DIM = "#171715", "#7f7b73", "#514e48"


def rng(slug):
    h = hashlib.sha256(slug.encode()).digest()
    i = 0
    while True:
        yield h[i % len(h)] / 255.0
        i += 1
        if i % len(h) == 0:
            h = hashlib.sha256(h).digest()


def plate(slug, label, corner, kind):
    r = rng(slug)
    n = lambda a, b: a + (b - a) * next(r)
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" '
         f'aria-label="Generated diagram plate for {label}">']
    p.append(f'<g fill="none" stroke="{LINE}" stroke-width="1">')

    if kind == "orbit":            # concentric rings gathered by radial spokes
        cx, cy = 400, 300
        rings = sorted(n(46, 232) for _ in range(4))
        for rad in rings:
            p.append(f'<circle cx="{cx}" cy="{cy}" r="{rad:.0f}"/>')
        p.append(f'<circle cx="{cx}" cy="{cy}" r="255" stroke-dasharray="4 8"/>')
        nodes = [(cx, cy, 5)]
        for k in range(7):                       # spokes, each stopping at a ring
            a = 2 * math.pi * k / 7 + n(-.16, .16)
            rad = rings[k % len(rings)]
            x, y = cx + rad * math.cos(a), cy + rad * math.sin(a)
            p.append(f'<line x1="{cx + 30*math.cos(a):.0f}" y1="{cy + 30*math.sin(a):.0f}" '
                     f'x2="{x:.0f}" y2="{y:.0f}"/>')
            p.append(f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{cx + 255*math.cos(a):.0f}" '
                     f'y2="{cy + 255*math.sin(a):.0f}" stroke-dasharray="2 7"/>')
            nodes.append((x, y, 4))

    elif kind == "strata":         # horizontal beds with a core sample
        nodes = []
        for i in range(6):
            y = 110 + i * 72
            p.append(f'<line x1="{n(90,140):.0f}" y1="{y}" x2="{n(660,730):.0f}" y2="{y}"/>')
            x = n(180, 620)
            p.append(f'<rect x="{x:.0f}" y="{y-26:.0f}" width="{n(70,190):.0f}" height="26"/>')
            nodes.append((x, y, 3))
        bore = n(330, 470)
        p.append(f'<line x1="{bore:.0f}" y1="80" x2="{bore:.0f}" y2="530" stroke-dasharray="3 6"/>')

    elif kind == "lattice":        # graph of boxes and wires
        cols, nodes, edges = [130, 320, 510, 700], [], []
        prev = None
        for ci, cx in enumerate(cols):
            k = 3 if ci % 2 == 0 else 2
            span = 340 if k == 3 else 220
            cur = [(cx, 300 - span / 2 + j * (span / (k - 1))) for j in range(k)]
            for x, y in cur:
                p.append(f'<rect x="{x-46:.0f}" y="{y-19:.0f}" width="92" height="38" fill="#e6e2d7"/>')
                nodes.append((x, y, 3))
            if prev:
                # every node on both sides gets at least one wire, then a few extra
                pairs = {(i, i * len(cur) // len(prev)) for i in range(len(prev))}
                pairs |= {(j * len(prev) // len(cur), j) for j in range(len(cur))}
                pairs |= {(i, j) for i in range(len(prev)) for j in range(len(cur)) if next(r) > .72}
                for i, j in sorted(pairs):
                    a, b = prev[i], cur[j]
                    mx = (a[0] + b[0]) / 2
                    p.append(f'<path d="M{a[0]+46:.0f} {a[1]:.0f} C{mx:.0f} {a[1]:.0f} '
                             f'{mx:.0f} {b[1]:.0f} {b[0]-46:.0f} {b[1]:.0f}"/>')
            prev = cur

    elif kind == "wave":           # stacked traces, a score
        nodes = []
        for band in range(5):
            y0 = 120 + band * 86
            amp, per, per2, ph = n(18, 34), n(52, 96), n(17, 31), n(0, 6.3)
            pts = " ".join(f"{x},{y0 - amp*math.sin(x/per + ph) - amp*.34*math.sin(x/per2 + ph*2):.1f}"
                for x in range(90, 716, 6))
            p.append(f'<polyline points="{pts}"/>')
            p.append(f'<line x1="90" y1="{y0+34:.0f}" x2="715" y2="{y0+34:.0f}" stroke-dasharray="2 7"/>')
            nodes.append((n(150, 660), y0, 3))

    else:                          # "mesh": peer nodes and links
        pts, nodes = [], []
        for i in range(9):
            a = 2 * math.pi * i / 9 + next(r) * .3
            rad = n(140, 225)
            x, y = 400 + rad * math.cos(a), 300 + rad * .78 * math.sin(a)
            pts.append((x, y)); nodes.append((x, y, 4))
        for i, a in enumerate(pts):
            for b in pts[i+1:]:
                if next(r) > .62:
                    p.append(f'<line x1="{a[0]:.0f}" y1="{a[1]:.0f}" x2="{b[0]:.0f}" y2="{b[1]:.0f}"/>')
        p.append(f'<circle cx="400" cy="300" r="{n(240,262):.0f}" stroke-dasharray="4 8"/>')

    p.append("</g>")
    p.append(f'<g fill="{INK}">' + "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rr}"/>' for x, y, rr in nodes) + "</g>")
    p.append(f'<g font-family="Courier New, monospace" font-size="11" fill="{DIM}">'
             f'<text x="80" y="70">{label}</text>'
             f'<text x="{W-80}" y="{H-40}" text-anchor="end">{corner}</text></g>')
    p.append("</svg>")
    OUT.joinpath(f"plate-{slug}.svg").write_text("\n".join(p) + "\n")


PLATES = [
    ("sanctuary-cell-division", "ARCHIVE / GROUND / CITATION", "SANCTUARY 01", "orbit"),
    ("palimpsest",              "SECTION / REVISION / INDEX",  "WORKBENCH 01", "strata"),
    ("palimpsest-studio",       "KEY / TIMING / NOTE",         "WORKBENCH 03", "strata"),
    ("divinatory-os",           "SYMBOL / ADDRESS / LEDGER",   "KERNEL 01",    "lattice"),
    ("sounds-like",             "IMAGE / FIELD / SOUND",       "INSTRUMENT 01","wave"),
    ("monochord",               "SYMBOL / HOP / INTERVAL",     "INSTRUMENT 03","wave"),
    ("newmusic",                "MARKER / SPACE / BLIND SPOT", "INSTRUMENT 02","wave"),
    ("meridian",                "NOTE / MOUNT / VAULT",        "VAULT 01",     "strata"),
    ("research-manager",        "THREAD / AGENDA / DECISION",  "WORKBENCH 02", "lattice"),
    ("caer-stack",              "ARCHIVE / NODE / MESH",       "APPLIANCE 01", "mesh"),
    ("order-of-the-meridian", "VOW / STRAND / CONDUCTION", "CYCLE 01", "orbit"),
    ("ladder-for-constance",    "CLASS / ARCHIVE / MEMORIAL",  "PRINT 01",     "strata"),
    ("oracularity", "SIGN / READING / DECISION", "PRINT 02", "lattice"),
    ("surregional-sangha", "PRACTICE / TEACHING / COMMUNITY", "PRINT 03", "orbit"),
    ("three-circuits-for-breath", "INHALE / HOLD / EXHALE", "PRINT 04", "wave"),
    ("corpusmith", "FOLDER / PLAN / UNDO", "TOOL 01", "strata"),
    ("csv-to-applemusic", "TRACK / LIST / PLAYLIST", "TOOL 02", "wave"),
    ("daimon-agent", "TERMINAL / TAB / CONTAINER", "AGENT 01", "lattice"),
    ("daimon", "MIRROR / ORACLE / PRACTICE", "COMPANION 01", "orbit"),
    ("earshot", "VOICE / TEXT / ROOM", "STUDIO 01", "wave"),
    ("eon-inventory", "REPOSITORY / WORKTREE / CONTAINER", "TOOL 03", "strata"),
    ("epub-to-pdf", "BOOK / PAGE / PRINT", "TOOL 04", "strata"),
    ("haunted-geography", "PLACE / PLAQUE / MEMORY", "MAP 01", "mesh"),
    ("nixos-sync", "REPOSITORY / COPY / MACHINE", "TOOL 05", "mesh"),
    ("playing-together", "QUESTION / BOX / READING", "BOX 01", "orbit"),
    ("screenplay-formatter", "SCENE / LINE / PAGE", "TOOL 06", "strata"),
    ("the-aion-apparatus", "OBJECT / MAKER / ETHIC", "INSTRUMENT 04", "lattice"),
    ("the-oracle-lab", "SIGHTING / SYMBOL / SOURCE", "FIELD GUIDE 01", "orbit"),
    ("training", "DESCRIBE / BUILD / TEST", "COURSE 01", "lattice"),
    ("vetiver", "PAPER / BIAS / EVIDENCE", "EXAMINER 01", "lattice"),
    ("bardo",                   "PRACTICE / PATTERN / RECOGNITION", "BARDO 01","orbit"),
    ("agent-factory", "SPEC / PATTERN / AGENT", "AGENT 02", "lattice"),
    ("assay", "CLAIM / EVIDENCE / CITATION", "EXAMINER 02", "lattice"),
    ("awakening-agent", "SELF-MODEL / INQUIRY / REFLECTION", "AGENT 03", "orbit"),
    ("daimon-og", "DAIMON / DIALOGUE / COMMIT", "COMPANION 02", "orbit"),
    ("work-harness", "LEDGER / FRAME / INVOICE", "LEDGER 01", "strata"),
    ("coach", "TASKS / STEPS / REWARDS", "TOOL 07", "strata"),
    ("space-lab", "ROCKETS / ORBITS / HISTORY", "LAB 01", "orbit"),
    ("mattermost-stack", "CHAT / SERVER / BACKUPS", "APPLIANCE 02", "mesh"),
    ("vetiver-sources", "PAPERS / CITATIONS / RETRACTIONS", "EXAMINER 03", "lattice"),
    ("cryptoagent", "TREASURY / POOLS / GUARDRAILS", "LEDGER 02", "lattice"),
    ("grant-agent", "GRANTS / DEADLINES / APPROVALS", "LEDGER 03", "strata"),
    ("moneymachine", "JOURNAL / SHEET / RULES", "LEDGER 04", "strata"),
    ("prediction", "LEDGER / EVIDENCE / ODDS", "LEDGER 05", "wave"),
    ("spica", "SPREADS / CHAINS / BACKTEST", "TOOL 08", "wave"),
    ("commons-git", "GIT / TOKEN / TOOLS", "COMMONS 01", "mesh"),
    ("commons-governance", "RECORD / LABEL / RUBRIC", "COMMONS 02", "strata"),
    ("governance-service", "RECORD / WEBHOOK / RECONCILER", "COMMONS 03", "lattice"),
    ("invite-service", "LINK / FORM / ACCOUNT", "COMMONS 04", "mesh"),
    ("project-discovery", "PROJECTS / REGISTRY / OVERLAP", "COMMONS 05", "mesh"),
    ("compute-club", "COMPUTE / COMMONS / CREDITS", "COMMONS 06", "orbit"),
    ("persona-forge", "SHEET / DRAFT / PLATE", "PRESS 01", "strata"),
    ("recommender", "TASTE / CORPUS / EDGE", "INSTRUMENT 05", "mesh"),
    ("spoken-word", "VOICE / RECORDING / CLIP", "ARCHIVE 01", "wave"),
    ("fieldkit", "DATA / SAMPLE / APP", "COURSE 02", "lattice"),
    ("the-rev", "MINISTRY / RITE / CORPUS", "SANCTUARY 02", "orbit"),
    ("herbal-science", "HERB / PLATE / LIGHT", "BENCH 01", "strata"),
    ("language-technology-human", "LANGUAGE / WRITING / JUDGMENT", "COURSE 03", "lattice"),
    ("diagram-studio", "TEXT / MEMBRANE / PLATE", "PLATE 01", "orbit"),
    ("human-in-the-loop", "POLICY / ESCALATION / CARD", "AGENT 04", "lattice"),
    ("fetch-sandbox", "FETCH / ALLOWLIST / CAP", "SANDBOX 01", "mesh"),
    ("trend-oracle", "TREND / REPORT / VIDEO", "PRESS 02", "wave"),
    ("sacred-salesman", "PRACTICE / DECK / CLIP", "PRACTICE 01", "orbit"),
    ("enclave", "TEXT / VECTOR / ROUTE", "APPLIANCE 03", "mesh"),
    ("pdfseq", "PDF / ORDER / BOOKMARK", "TOOL 09", "strata"),
    ("videodownload", "VIDEO / AUDIO / ADDRESS", "TOOL 10", "wave"),
    ("vault", "LINK / TAG / NOTE", "VAULT 02", "mesh"),
    ("movies", "FRAME / SCORE / BELL", "RENDER 01", "wave"),
    ("briefs", "QUEUE / GATE / HANDOFF", "QUEUE 01", "strata"),

]

if __name__ == "__main__":
    for args in PLATES:
        plate(*args)
    print(f"wrote {len(PLATES)} plates")
