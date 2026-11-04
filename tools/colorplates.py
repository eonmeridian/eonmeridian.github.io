#!/usr/bin/env python3
"""Color plates for the works that have no photographic documentation.

Same register as tools/plates.py: technical drawing on the site's paper ground, but
each work gets one or two spot colors drawn from its own subject. Deterministic: the
geometry is seeded from the slug, so a plate does not drift between runs.

These are marks, not photographs. Replace any of them with real documentation when it exists.
"""
import math, hashlib, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "img"
W, H = 800, 600
PAPER, INK, LINE, DIM = "#f3f0e8", "#171715", "#7f7b73", "#514e48"


def rng(slug):
    h = hashlib.sha256(slug.encode()).digest()
    i = 0
    while True:
        yield h[i % len(h)] / 255.0
        i += 1
        if i % len(h) == 0:
            h = hashlib.sha256(h).digest()


def plate(slug, label, corner, kind, spot, spot2=None):
    r = rng(slug)
    n = lambda a, b: a + (b - a) * next(r)
    spot2 = spot2 or spot
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" '
         f'aria-label="Diagram plate for {label}">',
         f'<rect width="{W}" height="{H}" fill="{PAPER}"/>']

    if kind == "coin":
        # obverse and reverse, struck: milled edge, legend ring, relief hatching
        for cx, tick in ((262, 96), (538, 72)):
            p.append(f'<circle cx="{cx}" cy="300" r="132" fill="{spot}" fill-opacity=".10" '
                     f'stroke="{spot}" stroke-width="1.5"/>')
            p.append(f'<circle cx="{cx}" cy="300" r="112" fill="none" stroke="{spot}" '
                     f'stroke-width="1" stroke-opacity=".7"/>')
            p.append(f'<circle cx="{cx}" cy="300" r="60" fill="none" stroke="{INK}" stroke-width="1"/>')
            for k in range(tick):                      # milled edge
                a = 2 * math.pi * k / tick
                p.append(f'<line x1="{cx+132*math.cos(a):.1f}" y1="{300+132*math.sin(a):.1f}" '
                         f'x2="{cx+140*math.cos(a):.1f}" y2="{300+140*math.sin(a):.1f}" '
                         f'stroke="{spot}" stroke-width="1" stroke-opacity=".55"/>')
            for k in range(16):                        # relief, struck off-centre
                a = 2 * math.pi * k / 16 + n(-.1, .1)
                r0 = n(62, 74)
                p.append(f'<line x1="{cx+r0*math.cos(a):.1f}" y1="{300+r0*math.sin(a):.1f}" '
                         f'x2="{cx+n(96,110)*math.cos(a):.1f}" y2="{300+n(96,110)*math.sin(a):.1f}" '
                         f'stroke="{INK}" stroke-width="1" stroke-opacity=".5"/>')
            p.append(f'<circle cx="{cx}" cy="300" r="4" fill="{INK}"/>')
        p.append(f'<line x1="400" y1="132" x2="400" y2="468" stroke="{LINE}" stroke-dasharray="3 7"/>')
        p.append(f'<g font-family="Courier New, monospace" font-size="10" fill="{DIM}">'
                 f'<text x="262" y="470" text-anchor="middle">OBVERSE</text>'
                 f'<text x="538" y="470" text-anchor="middle">REVERSE</text></g>')

    elif kind == "column":
        # a papyrus column: ruled lines, rubricated openings, a lacuna
        x0, x1 = 150, 470
        for i in range(26):
            y = 108 + i * 15
            w = x1 - n(0, 46) if i % 7 == 6 else x1
            col = spot if i % 7 == 0 else INK
            op = ".85" if i % 7 == 0 else ".42"
            p.append(f'<line x1="{x0}" y1="{y}" x2="{w:.0f}" y2="{y}" stroke="{col}" '
                     f'stroke-width="{2.4 if i%7==0 else 1.6}" stroke-opacity="{op}"/>')
        p.append(f'<rect x="292" y="243" width="74" height="62" fill="{PAPER}" '
                 f'stroke="{LINE}" stroke-dasharray="3 4"/>')       # lacuna
        p.append(f'<text x="329" y="279" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">LACUNA</text>')
        for i, lbl in enumerate(("INVOCATION", "MATERIA", "PRAXIS", "LOGOS")):
            y = 130 + i * 105
            p.append(f'<line x1="510" y1="{y}" x2="560" y2="{y}" stroke="{spot}" stroke-width="1"/>')
            p.append(f'<text x="568" y="{y+4}" font-family="Courier New, monospace" font-size="11" '
                     f'fill="{INK}">{lbl}</text>')

    elif kind == "chapters":
        # 9 chapters x 11 stories; chapter one struck, the rest still unreleased
        for c in range(9):
            for s in range(11):
                x, y = 150 + s * 46, 130 + c * 38
                live = c == 0
                p.append(f'<rect x="{x}" y="{y}" width="34" height="26" '
                         f'fill="{spot if live else "none"}" fill-opacity="{.72 if live else 0}" '
                         f'stroke="{spot if live else LINE}" stroke-width="1"/>')
            p.append(f'<text x="132" y="{148+c*38}" text-anchor="end" '
                     f'font-family="Courier New, monospace" font-size="10" fill="{DIM}">{c+1}</text>')
        p.append(f'<line x1="150" y1="{130+38}" x2="656" y2="{130+38}" stroke="{spot2}" stroke-width="1.5"/>')
        p.append(f'<text x="150" y="500" font-family="Courier New, monospace" font-size="11" '
                 f'fill="{DIM}">11 OF 99 RELEASED · CHAPTER ONE LIVE</text>')

    elif kind == "codex":
        # gathered signatures seen from the spine, with a text block
        for i in range(7):
            x = 150 + i * 26
            p.append(f'<path d="M{x} 150 C{x-16} 300 {x-16} 300 {x} 450" fill="none" '
                     f'stroke="{spot}" stroke-width="1.4" stroke-opacity=".8"/>')
        p.append(f'<rect x="360" y="150" width="290" height="300" fill="none" stroke="{INK}"/>')
        for i in range(19):
            y = 172 + i * 15
            w = n(150, 268) if i in (0, 18) else 268
            p.append(f'<line x1="378" y1="{y}" x2="{378+w:.0f}" y2="{y}" stroke="{INK}" '
                     f'stroke-width="1.6" stroke-opacity=".34"/>')
        p.append(f'<line x1="378" y1="163" x2="500" y2="163" stroke="{spot}" stroke-width="2.4"/>')
        p.append(f'<text x="650" y="470" text-anchor="end" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">SEVEN GATHERINGS · ONE TEXT BLOCK</text>')

    elif kind == "contract":
        # authorship chain: claim, witnesses, seal
        xs = [160, 330, 500]
        for i, x in enumerate(xs):
            p.append(f'<rect x="{x}" y="180" width="118" height="52" fill="none" stroke="{INK}"/>')
            if i:
                p.append(f'<line x1="{xs[i-1]+118}" y1="206" x2="{x}" y2="206" stroke="{spot}" stroke-width="1.5"/>')
                p.append(f'<circle cx="{(xs[i-1]+118+x)/2:.0f}" cy="206" r="3" fill="{spot}"/>')
        for i, x in enumerate(xs):
            for k in range(3):
                bx = x + 12 + k * 38
                p.append(f'<line x1="{x+59}" y1="232" x2="{bx}" y2="318" stroke="{LINE}" stroke-width="1"/>')
                p.append(f'<rect x="{bx-14}" y="318" width="28" height="20" fill="none" stroke="{LINE}"/>')
        p.append(f'<line x1="618" y1="206" x2="654" y2="206" stroke="{spot}" stroke-width="1.5"/>')
        p.append(f'<circle cx="694" cy="206" r="40" fill="{spot2}" fill-opacity=".12" '
                 f'stroke="{spot2}" stroke-width="1.5"/>')
        for k in range(28):
            a = 2 * math.pi * k / 28
            p.append(f'<line x1="{694+40*math.cos(a):.1f}" y1="{206+40*math.sin(a):.1f}" '
                     f'x2="{694+47*math.cos(a):.1f}" y2="{206+47*math.sin(a):.1f}" '
                     f'stroke="{spot2}" stroke-width="1" stroke-opacity=".6"/>')
        p.append(f'<text x="694" y="210" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{INK}">SEAL</text>')
        p.append(f'<g font-family="Courier New, monospace" font-size="10" fill="{DIM}">'
                 f'<text x="219" y="172" text-anchor="middle">IDEA</text>'
                 f'<text x="389" y="172" text-anchor="middle">CODE</text>'
                 f'<text x="559" y="172" text-anchor="middle">RECORD</text>'
                 f'<text x="150" y="378">WITNESSES</text></g>')

    elif kind == "core":
        # a peat core: beds of colour, register marks, depth scale
        top, depth = 120, 340
        cuts = sorted(n(.06, .96) for _ in range(7))
        prev = 0.0
        for i, c in enumerate(cuts + [1.0]):
            y0, y1 = top + depth * prev, top + depth * c
            col = spot if i % 2 == 0 else spot2
            p.append(f'<rect x="230" y="{y0:.1f}" width="240" height="{y1-y0:.1f}" fill="{col}" '
                     f'fill-opacity="{.14 + .09*(i%3):.2f}" stroke="{col}" stroke-width="1"/>')
            p.append(f'<line x1="200" y1="{y0:.1f}" x2="230" y2="{y0:.1f}" stroke="{INK}" stroke-width="1"/>')
            p.append(f'<text x="194" y="{y0+4:.1f}" text-anchor="end" font-family="Courier New, monospace" '
                     f'font-size="10" fill="{DIM}">{int(prev*100)}</text>')
            prev = c
        for k, x in enumerate((520, 570, 620)):        # print register marks
            p.append(f'<g stroke="{(spot,spot2,INK)[k]}" stroke-width="1" fill="none">'
                     f'<circle cx="{x}" cy="200" r="13"/><line x1="{x-20}" y1="200" x2="{x+20}" y2="200"/>'
                     f'<line x1="{x}" y1="180" x2="{x}" y2="220"/></g>')
        p.append(f'<text x="520" y="252" font-family="Courier New, monospace" font-size="10" '
                 f'fill="{DIM}">REGISTRATION</text>')
        p.append(f'<text x="230" y="492" font-family="Courier New, monospace" font-size="10" '
                 f'fill="{DIM}">CORE · CM BELOW SURFACE</text>')

    elif kind == "materia":
        # a materia medica sheet: leaf silhouettes over a dosage grid
        for i in range(4):
            cx, cy = 190 + i * 150, 250
            p.append(f'<path d="M{cx} {cy-92} C{cx+52} {cy-42} {cx+46} {cy+40} {cx} {cy+86} '
                     f'C{cx-46} {cy+40} {cx-52} {cy-42} {cx} {cy-92} Z" fill="{spot}" '
                     f'fill-opacity="{.10+.05*i:.2f}" stroke="{spot}" stroke-width="1.2"/>')
            p.append(f'<line x1="{cx}" y1="{cy-92}" x2="{cx}" y2="{cy+86}" stroke="{spot}" stroke-width="1"/>')
            for k in range(1, 7):                      # veins
                y = cy - 92 + k * 25
                sp = 16 + 20 * math.sin(k / 6 * math.pi)
                p.append(f'<line x1="{cx}" y1="{y}" x2="{cx-sp:.0f}" y2="{y+13}" stroke="{spot}" '
                         f'stroke-width="1" stroke-opacity=".55"/>')
                p.append(f'<line x1="{cx}" y1="{y}" x2="{cx+sp:.0f}" y2="{y+13}" stroke="{spot}" '
                         f'stroke-width="1" stroke-opacity=".55"/>')
        for i in range(5):
            y = 370 + i * 26
            p.append(f'<line x1="150" y1="{y}" x2="656" y2="{y}" stroke="{LINE}" stroke-width="1"/>')
        for x in (150, 302, 454, 606, 656):
            p.append(f'<line x1="{x}" y1="370" x2="{x}" y2="474" stroke="{LINE}" stroke-width="1"/>')
        p.append(f'<g font-family="Courier New, monospace" font-size="10" fill="{DIM}">'
                 f'<text x="158" y="364">PART</text><text x="310" y="364">PREPARATION</text>'
                 f'<text x="462" y="364">DOSE</text><text x="614" y="364">NOTE</text></g>')


    elif kind == "stage":
        # a plan of the stage: proscenium, five robot marks, cable runs to a control desk
        p.append(f'<rect x="150" y="140" width="420" height="290" fill="none" stroke="{INK}"/>')
        p.append(f'<line x1="150" y1="392" x2="570" y2="392" stroke="{LINE}" stroke-dasharray="4 6"/>')
        marks = [(232, 214), (350, 190), (470, 226), (286, 320), (438, 336)]
        for i, (x, y) in enumerate(marks):
            p.append(f'<circle cx="{x}" cy="{y}" r="19" fill="{spot}" fill-opacity=".14" '
                     f'stroke="{spot}" stroke-width="1.4"/>')
            p.append(f'<circle cx="{x}" cy="{y}" r="3.5" fill="{INK}"/>')
            p.append(f'<path d="M{x} {y+19} C{x} {y+70} {640} {y+40} {640} 300" fill="none" '
                     f'stroke="{spot2}" stroke-width="1" stroke-opacity=".55"/>')
            p.append(f'<text x="{x}" y="{y-26}" text-anchor="middle" '
                     f'font-family="Courier New, monospace" font-size="10" fill="{DIM}">R{i+1}</text>')
        p.append(f'<rect x="612" y="272" width="56" height="56" fill="none" stroke="{INK}"/>')
        p.append(f'<text x="640" y="350" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">CONTROL</text>')
        p.append(f'<text x="360" y="452" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">HOUSE</text>')

    elif kind == "strip":
        # a film strip: sprockets, frames, one frame pulled out and enlarged
        y0 = 168
        p.append(f'<rect x="130" y="{y0}" width="330" height="128" fill="none" stroke="{INK}"/>')
        for k in range(12):
            for yy in (y0 + 7, y0 + 110):
                p.append(f'<rect x="{136+k*27}" y="{yy}" width="14" height="11" fill="{INK}" '
                         f'fill-opacity=".5"/>')
        for k in range(4):
            p.append(f'<rect x="{140+k*79}" y="{y0+27}" width="70" height="74" fill="{spot}" '
                     f'fill-opacity="{.10+.06*k:.2f}" stroke="{spot}" stroke-width="1"/>')
        p.append(f'<path d="M219 {y0+101} L520 400 M289 {y0+101} L700 400" stroke="{LINE}" '
                 f'stroke-width="1" fill="none" stroke-dasharray="3 5"/>')
        p.append(f'<rect x="520" y="290" width="180" height="110" fill="{spot2}" fill-opacity=".12" '
                 f'stroke="{spot2}" stroke-width="1.4"/>')
        p.append(f'<text x="610" y="424" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">ONE FRAME, HELD</text>')

    elif kind == "world":
        # a ground plane in perspective with placed objects and a viewer cone
        hz = 236
        p.append(f'<line x1="120" y1="{hz}" x2="680" y2="{hz}" stroke="{LINE}"/>')
        for k in range(13):                     # receding grid
            x = 120 + k * 46.7
            p.append(f'<line x1="{x:.0f}" y1="452" x2="{400+(x-400)*.14:.0f}" y2="{hz}" '
                     f'stroke="{spot}" stroke-width="1" stroke-opacity=".42"/>')
        d = 0.0
        for k in range(7):
            d += (1 - d) * 0.30
            y = hz + (452 - hz) * (1 - d)
            p.append(f'<line x1="120" y1="{y:.0f}" x2="680" y2="{y:.0f}" stroke="{spot}" '
                     f'stroke-width="1" stroke-opacity=".42"/>')
        for x, y, w in ((250, 400, 46), (392, 356, 34), (516, 386, 40), (330, 300, 22), (588, 320, 26)):
            p.append(f'<rect x="{x}" y="{y-w}" width="{w}" height="{w}" fill="{spot2}" '
                     f'fill-opacity=".16" stroke="{spot2}" stroke-width="1.2"/>')
        p.append(f'<path d="M400 496 L214 300 L586 300 Z" fill="none" stroke="{INK}" '
                 f'stroke-dasharray="4 6"/>')
        p.append(f'<circle cx="400" cy="496" r="5" fill="{INK}"/>')
        p.append(f'<text x="400" y="522" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">VIEWER</text>')


    elif kind == "halftone":
        # a tonal field built out of glyph density: light cells sparse, dark cells packed
        cols, rows, cw = 16, 11, 34
        x0, y0 = 128, 118
        for gy in range(rows):
            for gx in range(cols):
                # a soft diagonal gradient with a lit corner, so it reads as an image
                t_ = (gx / cols) * .55 + (1 - gy / rows) * .45
                t_ = max(0.0, min(1.0, t_ + n(-.09, .09)))
                cx, cy = x0 + gx * cw, y0 + gy * cw
                k = int(round(t_ * 4))
                if k == 0:
                    continue
                for j in range(k):
                    for i in range(k):
                        p.append(f'<circle cx="{cx + (i+.5)*cw/k:.1f}" cy="{cy + (j+.5)*cw/k:.1f}" '
                                 f'r="{1.0 + 1.9*t_:.2f}" fill="{spot}" '
                                 f'fill-opacity="{.25 + .5*t_:.2f}"/>')
        p.append(f'<rect x="{x0}" y="{y0}" width="{cols*cw}" height="{rows*cw}" fill="none" '
                 f'stroke="{LINE}"/>')
        nodes = []
        p.append(f'<text x="{x0}" y="{y0+rows*cw+22}" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">ONE GLYPH PER CELL · DENSITY = TONE</text>')

    elif kind == "silhouette":
        # a side elevation: platforms in shadow, one light source, a small figure
        p.append(f'<circle cx="612" cy="150" r="34" fill="{spot2}" fill-opacity=".22" '
                 f'stroke="{spot2}" stroke-width="1"/>')
        for k in range(24):                       # rays
            a = 2 * math.pi * k / 24
            p.append(f'<line x1="{612+38*math.cos(a):.1f}" y1="{150+38*math.sin(a):.1f}" '
                     f'x2="{612+(58+18*(k%3))*math.cos(a):.1f}" '
                     f'y2="{150+(58+18*(k%3))*math.sin(a):.1f}" '
                     f'stroke="{spot2}" stroke-width="1" stroke-opacity=".45"/>')
        ledges = [(120, 430, 200), (250, 372, 140), (392, 402, 120), (150, 316, 96),
                  (470, 340, 150), (300, 268, 110)]
        for x, y, w in ledges:
            p.append(f'<rect x="{x}" y="{y}" width="{w}" height="11" fill="{spot}" '
                     f'fill-opacity=".82"/>')
        for x, w, h in ((110, 92, 120), (236, 74, 96), (348, 110, 150), (500, 84, 108),
                        (612, 96, 132)):
            p.append(f'<path d="M{x} 496 L{x} {496-h} Q{x+w/2} {496-h-26} {x+w} {496-h} '
                     f'L{x+w} 496 Z" fill="{INK}" fill-opacity=".78"/>')
        p.append(f'<rect x="333" y="242" width="9" height="20" fill="{INK}"/>')
        p.append(f'<circle cx="337.5" cy="234" r="5" fill="{INK}"/>')
        nodes = []
        p.append(f'<text x="120" y="524" font-family="Courier New, monospace" font-size="10" '
                 f'fill="{DIM}">YOU WIN WHEN YOU REALISE IT</text>')
    elif kind == "garment":        # a cut layout and the repeat that fills it
        panels = [(150, 150, 120, 190), (286, 150, 96, 130), (286, 296, 96, 44),
                  (150, 356, 120, 92), (398, 150, 74, 190)]
        for x, y, w, h in panels:
            p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" '
                     f'stroke="{INK}" stroke-width="1"/>')
            p.append(f'<rect x="{x+7}" y="{y+7}" width="{w-14}" height="{h-14}" fill="none" '
                     f'stroke="{LINE}" stroke-dasharray="3 4"/>')
        for gx in range(4):                     # the repeat, tiled
            for gy in range(4):
                cx, cy = 530 + gx * 44, 172 + gy * 44
                p.append(f'<rect x="{cx}" y="{cy}" width="40" height="40" fill="{spot}" '
                         f'fill-opacity="{.09 + .05*((gx+gy) % 3):.2f}" stroke="{spot}" stroke-width="1"/>')
                p.append(f'<circle cx="{cx+20}" cy="{cy+20}" r="{9 + 3*((gx*gy) % 3)}" fill="none" '
                         f'stroke="{spot2}" stroke-width="1" stroke-opacity=".7"/>')
        p.append(f'<text x="210" y="472" font-family="Courier New, monospace" font-size="10" '
                 f'fill="{DIM}">CUT</text>')
        p.append(f'<text x="590" y="368" text-anchor="middle" font-family="Courier New, monospace" '
                 f'font-size="10" fill="{DIM}">REPEAT · PRINTED TO ORDER</text>')

    else:  # "die": a chip floorplan with a signal read off it
        p.append(f'<rect x="150" y="110" width="330" height="290" fill="none" stroke="{INK}"/>')
        blocks = [(168, 128, 120, 84), (300, 128, 162, 52), (300, 192, 78, 96),
                  (390, 192, 72, 62), (168, 224, 120, 62), (168, 298, 294, 88), (390, 266, 72, 20)]
        for i, (x, y, w, h) in enumerate(blocks):
            p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{spot}" '
                     f'fill-opacity="{.08+.045*(i%4):.2f}" stroke="{spot}" stroke-width="1"/>')
        for k in range(14):                            # bond pads
            p.append(f'<rect x="{158+k*23}" y="404" width="12" height="9" fill="{INK}"/>')
        amp, y0 = 40, 250
        pts = " ".join(f"{x},{y0-amp*math.sin(x/33)-amp*.4*math.sin(x/11):.1f}"
                       for x in range(520, 681, 4))
        p.append(f'<polyline points="{pts}" fill="none" stroke="{spot2}" stroke-width="1.4"/>')
        p.append(f'<line x1="520" y1="{y0}" x2="680" y2="{y0}" stroke="{LINE}" stroke-dasharray="2 6"/>')
        p.append(f'<line x1="480" y1="250" x2="520" y2="250" stroke="{INK}" stroke-width="1"/>')
        p.append(f'<text x="520" y="330" font-family="Courier New, monospace" font-size="10" '
                 f'fill="{DIM}">READ OUT AS SOUND</text>')

    p.append(f'<g font-family="Courier New, monospace" font-size="11" fill="{DIM}">'
             f'<text x="80" y="70">{label}</text>'
             f'<text x="{W-80}" y="{H-40}" text-anchor="end">{corner}</text></g>')
    p.append("</svg>")
    OUT.joinpath(f"plate-{slug}.svg").write_text("\n".join(p) + "\n")


PLATES = [
    ("prayer-coin",       "PRAYER / STRIKE / VALUE",        "COIN 01",     "coin",     "#a8791f"),
    ("unpaid-labor-coin", "LABOR / HOUR / EXCHANGE",        "COIN 02",     "coin",     "#3f6b5f"),
    ("pgm-diagrams",      "PAPYRUS / RUBRIC / OPERATION",   "PGM 01",      "column",   "#a33327"),
    ("evertunes",         "CHAPTER / STORY / RELEASE",      "WESTWARD HO", "chapters", "#b8862f", "#4a6f88"),
    ("emu-butch",         "GATHERING / BLOCK / RUNNING HEAD","BOOK 01",    "codex",    "#2f4a7a"),
    ("ethical-imagination","IDEA / CODE / RECORD",          "CONTRACT 01", "contract", "#2f5d7a", "#a33327"),
    ("peat-and-repeat",   "BOG / BED / EDITION",            "CORE 01",     "core",     "#6b4f2a", "#4f6b3a"),
    ("mugworts",          "PLANT / PART / DOSE",            "MATERIA 01",  "materia",  "#5c6b3a"),
    ("heddatron",         "STAGE / ROBOT / CUE",            "PLOT 01",     "stage",    "#a33327", "#4a6f88"),
    ("thirteen-bit",      "FRAME / CUT / RELEASE",          "STRIP 01",    "strip",    "#2f6b6b", "#a8791f"),
    ("kokowa",            "GROUND / OBJECT / VIEWER",       "WORLD 01",    "world",    "#4a4a8a", "#a3437a"),
    ("paom",              "PANEL / REPEAT / ORDER",         "GARMENT 01",  "garment",  "#a3437a", "#2f5d7a"),
    ("sigil-studio",      "IMAGE / GLYPH / TONE",           "HALFTONE 01", "halftone", "#4a4a46"),
    ("dream",             "PLATFORM / LIGHT / FIGURE",      "DREAM 01",    "silhouette","#1d5c66", "#c8912f"),
]

if __name__ == "__main__":
    for args in PLATES:
        plate(*args)
    print(f"wrote {len(PLATES)} color plates")
