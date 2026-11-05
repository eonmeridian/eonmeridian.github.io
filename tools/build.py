#!/usr/bin/env python3
"""Generate the Eon Meridian portfolio: index page + one page per work.

Each page is rendered from a work.md: works/<slug>.md here, or work.md in the work's
own repo when its private vault card says `site: page`. Every fact comes from that
work's own files; nothing is invented. Output is plain static HTML, and the build
stops if any page breaks the house rules (tools/houserules.py).
"""
import pathlib, html, re, shutil, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import md, houserules

ROOT = pathlib.Path(__file__).resolve().parent.parent

MAST = """<header class="mast">
  <div>
    <a class="brand" href="{home}">EON MERIDIAN</a>
    <div class="roles">artist · writer · technologist · herbalist</div>
  </div>
  <nav class="nav">
    <a href="{home}#work">work</a>
    <a href="{home}#live">live</a>
    <a href="{home}#writing">writing</a>
    <a href="{home}#about">about</a>
    <a class="nav-out" href="https://substack.com/@33eon">substack ↗</a>
  </nav>
</header>"""

FOOT = """<footer class="footer">
  <span>Eon Meridian · <a href="https://substack.com/@33eon">Substack</a></span>
</footer>"""


def stamp(href):
    """href plus ?v=<content hash>, so a browser fetches the file again after it changes."""
    import hashlib
    f = ROOT / href.lstrip("./")
    return f"{href}?v={hashlib.sha1(f.read_bytes()).hexdigest()[:10]}" if f.exists() else href


def page(title, desc, body, home="index.html", css="assets/site.css",
         icon="assets/favicon.svg"):
    css = stamp(css)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{html.escape(desc, quote=True)}" />
<link rel="stylesheet" href="{css}" />
<link rel="icon" href="{icon}" type="image/svg+xml" />
</head>
<body>
<div class="site" id="top">
{MAST.format(home=home, base=home[:-len("index.html")])}
{body}
{FOOT}
</div>
</body>
</html>
"""


# ---------------------------------------------------------------- content ---
# img: (file, caption, dark?)  · links: (label, href or None for "not public")
# ------------------------------------------------------------------ works ---
# Every page comes from a work.md (see tools/md.py for the format):
#   - works/<slug>.md in this repo, for works with no repository, and
#   - <repo>/work.md for each private vault card (researcher/research/projects/*/index.md)
#     whose frontmatter says `site: page` and names `slug:` and `repo:`.
# A card that says anything other than page (private, nda, link-only) keeps its work off the
# site even when a works/<slug>.md exists. Status and direction stay in the cards, never here.
CARDS = ROOT.parent.parent / "researcher" / "research" / "projects"


def _cards():
    out = {}
    for f in sorted(CARDS.glob("*/index.md")):
        fm = md.card_frontmatter(f.read_text())
        if fm.get("slug"):
            fm["_card_dir"] = str(f.parent)
            out[fm["slug"]] = fm
    return out


def _work(path, slug, repo=None):
    head, body = md.split(path.read_text())
    lead, prose = md.page_parts(body)
    pr = {k: head[k] for k in ("title", "sub", "year", "medium", "venue", "blurb", "card") if k in head}
    pr["slug"] = slug
    pr["lead"], pr["prose"] = lead, prose
    pr.setdefault("blurb", re.split(r"(?<=[.!?])\s", re.sub(r"<[^>]+>", "", lead), maxsplit=1)[0])

    def img(src):
        # assets/... is already in this site; anything else is a path in the work's repo
        if src.startswith("assets/") or repo is None:
            return src
        dest = f"assets/img/{slug}-{pathlib.Path(src).name}"
        shutil.copyfile(repo / src, ROOT / dest)
        return dest

    if "card" in pr:
        pr["card"] = img(pr["card"])
    pr["imgs"] = [(img(i["src"]), i["caption"], i.get("dark", False)) for i in head.get("images", [])]
    # no documentation image: fall back to the work's generated plate, if one is registered
    plate = f"assets/img/plate-{slug}.svg"
    if not pr["imgs"] and (ROOT / plate).exists():
        pr["imgs"] = [(plate, pr.get("sub", pr["title"]), False)]
    pr["optional_imgs"] = [(i["src"], i["caption"], i.get("dark", False))
                           for i in head.get("optional_images", [])]
    pr["side"] = [(s["label"], s["value"]) for s in head.get("side", [])]
    pr["links"] = [(l["label"], l.get("url")) for l in head.get("links", [])]
    return pr


def load_works():
    cards = _cards()
    works = {}
    for f in sorted((ROOT / "works").glob("*.md")):
        slug = f.stem
        if cards.get(slug, {}).get("site", "page") == "page":
            works[slug] = _work(f, slug)
    for slug, fm in cards.items():
        if fm.get("site") != "page":
            continue
        # work.md lives in the repo; a work with no repo (a script in ~/bin) keeps it beside its card
        repo = pathlib.Path(fm.get("repo") or "none").expanduser()
        card_dir = pathlib.Path(fm["_card_dir"])
        if repo.is_dir() and (repo / "work.md").exists():
            works[slug] = _work(repo / "work.md", slug, repo)
        elif (card_dir / "work.md").exists():
            works[slug] = _work(card_dir / "work.md", slug, repo if repo.is_dir() else card_dir)
    return list(works.values())


P = load_works()

# The front page leads with six works and indexes the rest.
FEATURED = [
    "order-of-the-meridian", "caer-stack", "evertunes",
    "ethical-imagination", "botmatrix", "mugworts",
]

# Shown as a credentials line under the opening statement.
VENUE_STRIP = [
    "Ars Electronica", "Hackers On Planet Earth", "DWeb", "Recurse Center", "Banff Centre",
    "Visions2030", "HERE Arts Center", "Sphinx", "NEW INC", "New Museum",
]

SUBSTACK = "https://substack.com/@33eon"

# Works someone can open and use right now. Fly apps here stop when idle and start on a visit;
# never list one whose fly.toml keeps a machine running (hauntology, as of 2026-11-02).
LIVE = {
    "breath": "https://eonmeridian.github.io/breath/",
    "palimpsest": "https://eonmeridian.github.io/Palimpsest/",
    "sigil-studio": "https://eonmeridian.github.io/SigilStudio/",
    "bloomcast": "https://bloomcast.fly.dev/",
    "palimpsest-studio": "https://palimpsest-studio.fly.dev/",
}

# Writing and events, with their dates and venues on the index.
WRITING = ["ladder-for-constance", "lesbians-for-proust", "surregional-sangha"]

# The index filters by theme. Every work on the site belongs to exactly one.
THEMES = [
    ("ritual", "Ritual & divination", [
        "order-of-the-meridian", "six-rites", "sigil-studio", "divinatory-os", "breath", "dream",
        "bardo", "daimon", "playing-together", "the-oracle-lab", "geomancy", "pgm-diagrams",
        "prayer-coin"]),
    ("sound", "Sound & instruments", [
        "diagrammatic-immanence", "sounds-like", "monochord", "newmusic", "bloomcast",
        "palimpsest-studio", "earshot"]),
    ("writing", "Writing, film & performance", [
        "ladder-for-constance", "lesbians-for-proust", "surregional-sangha", "oracularity",
        "three-circuits-for-breath", "emu-butch", "botmatrix", "thirteen-bit",
        "evertunes", "drone-cinematographer"]),
    ("infra", "Infrastructure & research", [
        "caer-stack", "meridian", "palimpsest", "research-manager", "daimon-agent", "corpusmith",
        "vetiver", "the-aion-apparatus", "haunted-geography"]),
    ("care", "Care, commons & ventures", [
        "mugworts", "peat-and-repeat", "ethical-imagination", "kokowa", "paom",
        "unpaid-labor-coin"]),
    ("tools", "Small tools", [
        "eon-inventory", "epub-to-pdf", "nixos-sync", "screenplay-formatter", "training",
        "csv-to-applemusic"]),
]
THEME_OF = {s: (k, label) for k, label, slugs in THEMES for s in slugs}

# The dial's two fans, each read clockwise: the right from top to bottom, the left from bottom
# to top. The sides hold about the same number of works so the spokes can share one spacing.
DIAL = [["ritual", "sound", "care"], ["tools", "infra", "writing"]]
assert sorted(DIAL[0] + DIAL[1]) == sorted(k for k, _, _ in THEMES)

ORDER = [
    # the six featured works lead, so the index numbers run unbroken after them
    "order-of-the-meridian", "caer-stack", "evertunes", "ethical-imagination",
    "botmatrix", "mugworts",
    "ladder-for-constance", "lesbians-for-proust", "surregional-sangha", "oracularity",
    "three-circuits-for-breath", "six-rites",
    "peat-and-repeat", "pgm-diagrams", "prayer-coin", "unpaid-labor-coin", "emu-butch",
    "kokowa", "paom", "thirteen-bit", "diagrammatic-immanence", "palimpsest",
    "palimpsest-studio", "sigil-studio", "divinatory-os", "sounds-like", "monochord", "meridian", "dream",
    "breath", "bloomcast",
]
P.sort(key=lambda d: (ORDER.index(d["slug"]) if d["slug"] in ORDER else len(ORDER), d["title"]))
for _i, _d in enumerate(P, 1):
    _d["num"] = f"{_i:02d}"
BY_SLUG = {d["slug"]: d for d in P}

# Works whose page is an app published into projects/<slug>/ by the work's own repo.
# Listed on the index; build_project never writes these, so the app is left alone.
APPS = [
    # projects/correspondences/ is monochord's instrument, published there by the monochord repo.
    {"slug": "correspondences", "title": "monochord",
     "sub": "A correspondence graph you walk to play, in the browser",
     "thumb": "assets/img/monochord-correspondences.jpg"},
]

# Works from the index that have no material on disk yet: listed, not invented.
UNSOURCED = []

# ------------------------------------------------------------------ build ---
def flat_venue(pr):
    """The venue as one line, for a card or an index row."""
    return re.sub(r"\s*<br>\s*", " · ", pr.get("venue", "")).strip()


WHEEL_JS = (ROOT / "tools" / "wheel.js").read_text()


def build_index():
    """The front page is one drawing: a dial of every work, grouped by theme.

    On a wide screen the works fan out on two sides of the dial, one spoke each, every title
    reading left to right; each theme is an arc with its name as the first spoke. On a narrow
    screen every work sits around a ring that turns, the one at the top shown large in the
    middle, with a plain chapter list of all of them below. Live works carry their own way in, in both.
    """
    import math

    def thumb_of(pr):
        pics = [(s, c) for s, c, _ in pr["imgs"] + pr.get("optional_imgs", [])
                if not s.endswith(".svg") and (ROOT / s).exists()]
        if pics:
            return pics[0]
        t = pr.get("card") or pr["imgs"][0][0]
        return t, next((c for src, c, _ in pr["imgs"] if src == t), pr["sub"])

    missing = [d["slug"] for d in P if d["slug"] not in THEME_OF]
    if missing:
        sys.exit(f"no theme for: {', '.join(missing)} (add each to THEMES in tools/build.py)")

    by = BY_SLUG
    app_of = {"monochord": next(f"projects/{a['slug']}/" for a in APPS if a["slug"] == "correspondences")}
    esc = lambda s: html.escape(s, quote=True)
    chapters = {k: (label, [by[s] for s in slugs if s in by]) for k, label, slugs in THEMES}

    # ---- the wide dial: two fans of spokes, right and left, open at top and bottom so
    # no title turns more than about 60 degrees. Each theme's name takes the first spoke.
    VW, VH, CX, CY = 1000, 900, 500, 450
    SPAN = 124
    R_DOT, R_ARC = 270, 255
    R_T, R_TICK = 284, 487     # where a title starts, and the inner end of the outer ticks
    # A title too long to reach the ticks on one line takes two adjacent spokes, one line each.
    LONG = 22

    def lines_of(title):
        """A long title split at the space nearest its middle; a short one stays whole."""
        if len(title) < LONG or " " not in title:
            return [title]
        cut = min((j for j, ch in enumerate(title) if ch == " "), key=lambda j: abs(j - len(title) / 2))
        return [title[:cut], title[cut + 1:]]

    def pt(a, r, cx=CX, cy=CY):
        t = math.radians(a)
        return cx + r * math.sin(t), cy - r * math.cos(t)

    def arc(a0, a1, r, reverse=False, cx=CX, cy=CY):
        (x0, y0), (x1, y1) = pt(a0, r, cx, cy), pt(a1, r, cx, cy)
        large = 1 if a1 - a0 > 180 else 0
        if reverse:
            return f"M{x1:.1f} {y1:.1f} A{r} {r} 0 {large} 0 {x0:.1f} {y0:.1f}"
        return f"M{x0:.1f} {y0:.1f} A{r} {r} 0 {large} 1 {x1:.1f} {y1:.1f}"

    sides = [(90, DIAL[0]), (270, DIAL[1])]
    seqs = [[x for k in keys for x in [("h", k)] + [("w", pr) for pr in chapters[k][1]]]
            for _, keys in sides]
    slots = lambda kind, x: len(lines_of(x["title"])) if kind == "w" else 1
    n_slots = [sum(slots(*x) for x in seq) for seq in seqs]
    step = SPAN / max(n_slots)
    angle = {}
    svg_rings, svg_dots, svg_ticks = [], [], []
    for (mid, keys), seq, n in zip(sides, seqs, n_slots):
        start = mid - n * step / 2
        used = 0
        for kind, x in seq:
            k = slots(kind, x)
            # A two-line title keeps one spoke and one dot, at its first line; the second line
            # hangs into the slot it reserves (clockwise on the right, the other way when flipped).
            a = start + (used + (k / 2 if k == 1 else (.4 if mid < 180 else k - .4))) * step
            used += k
            angle[(kind, x if kind == "h" else x["slug"])] = a
            (xa, ya), (xb, yb) = pt(a, R_TICK), pt(a, R_TICK + 9)
            svg_ticks.append(f'<line x1="{xa:.1f}" y1="{ya:.1f}" x2="{xb:.1f}" y2="{yb:.1f}"/>')
        svg_rings.append(f'<path class="dash" d="{arc(start, start + n * step, R_TICK + 10)}"/>')
        for k in keys:
            ws = chapters[k][1]
            b0 = angle[("w", ws[0]["slug"])] - step * .35
            b1 = angle[("w", ws[-1]["slug"])] + step * .35
            svg_rings.append(f'<path d="{arc(b0, b1, R_ARC)}"/>')
            for e in (b0, b1):
                (xa, ya), (xb, yb) = pt(e, R_ARC - 7), pt(e, R_ARC + 7)
                svg_rings.append(f'<line x1="{xa:.1f}" y1="{ya:.1f}" x2="{xb:.1f}" y2="{yb:.1f}"/>')

    # the two lines of a long title sit one spoke apart where the titles start
    pitch = R_T * math.radians(step) / 10

    def spoke(a):
        """Rotation for a spoke at clock angle a; the left fan turns its titles to read outward."""
        return f'style="--r:{a - 90:.2f}deg"', " flip" if a > 180 else ""

    sections = []
    for key, label, _ in THEMES:
        works = chapters[key][1]
        rows = []
        for pr in works:
            a = angle[("w", pr["slug"])]
            x, y = pt(a, R_DOT)
            live = pr["slug"] in LIVE or pr["slug"] in app_of
            svg_dots.append(f'<circle class="{"lv" if live else "d"}" data-s="{pr["slug"]}" '
                            f'cx="{x:.1f}" cy="{y:.1f}" r="{5 if live else 3.2}"/>')
            st, flip = spoke(a)
            thumb, alt = thumb_of(pr)
            if pr["slug"] in LIVE:
                way = f'<a class="open" href="{LIVE[pr["slug"]]}" target="_blank" rel="noopener">open ↗</a>'
            elif pr["slug"] in app_of:
                way = f'<a class="open" href="{app_of[pr["slug"]]}">play ↗</a>'
            else:
                way = ""
            ev = ""
            if pr["slug"] in WRITING:
                venue = flat_venue(pr)
                ev = f'<span class="ev">{" · ".join(x for x in (pr["year"], venue or pr["sub"]) if x)}</span>'
            lines = lines_of(pr["title"])
            title = lines[0] + "".join(f' <span class="l2">{ln}</span>' for ln in lines[1:])
            rows.append(
                f'      <li class="w{flip}{" two" if len(lines) > 1 else ""}{" e" if ev else ""}" {st} '
                f'data-s="{pr["slug"]}" data-img="{thumb}" data-alt="{esc(alt)}">'
                f'<a href="projects/{pr["slug"]}/"><span class="t">{title}</span></a>{way}{ev}</li>')
        st, flip = spoke(angle[("h", key)])
        sections.append(f"""    <section class="ch" id="{key}">
      <h2 class="{flip.strip()}" {st}>{label} <span>{len(works)}</span></h2>
      <ol>
{chr(10).join(rows)}
      </ol>
    </section>""")

    chart = f"""<svg class="chart" viewBox="0 0 {VW} {VH}" aria-hidden="true">
      <g class="rings">
        <circle cx="{CX}" cy="{CY}" r="{R_DOT}"/>
        <g class="ticks">{''.join(svg_ticks)}</g>
        {''.join(svg_rings)}
      </g>
      <g class="dots">{''.join(svg_dots)}</g>
    </svg>"""

    # ---- the narrow dial: every work around a ring that turns. Drag it round (or scroll over
    # it); the work at the reading line on top shows large in the middle, and a tap opens it.
    # Each theme is an arc inside the ring of dots; a tap on its name turns the ring to it.
    WR_DOT, WR_T, WR_ARC, WFS = 150, 158, 138, 14
    wseq = [x for key in DIAL[0] + DIAL[1] for x in [("g", key)] + [("w", pr) for pr in chapters[key][1]]]
    wstep = 360 / len(wseq)
    first = next(i for i, (kind, _) in enumerate(wseq) if kind == "w")
    wang = lambda i: (i - first) * wstep

    def band(a0, a1, r0, r1):
        """A filled band of the ring: the touch area of one theme label."""
        (x0, y0), (x1, y1) = pt(a0, r1, 0, 0), pt(a1, r1, 0, 0)
        (x2, y2), (x3, y3) = pt(a1, r0, 0, 0), pt(a0, r0, 0, 0)
        large = 1 if a1 - a0 > 180 else 0
        return (f"M{x0:.1f} {y0:.1f} A{r1} {r1} 0 {large} 1 {x1:.1f} {y1:.1f} "
                f"L{x2:.1f} {y2:.1f} A{r0} {r0} 0 {large} 0 {x3:.1f} {y3:.1f}Z")

    wdots, wtexts, wthemes, wdefs = [], [], [], []
    witems = []
    for i, (kind, x) in enumerate(wseq):
        if kind != "w":
            continue
        a = wang(i)
        live_url = LIVE.get(x["slug"]) or app_of.get(x["slug"], "")
        way = "open" if x["slug"] in LIVE else "play" if x["slug"] in app_of else ""
        witems.append((x, live_url, way))
        ext = ' data-x="1"' if x["slug"] in LIVE else ""
        dx, dy = pt(a, WR_DOT, 0, 0)
        wdots.append(f'<circle class="{"lv" if way else "d"}" cx="{dx:.1f}" cy="{dy:.1f}" r="{4.6 if way else 3}"/>')
        wtexts.append(
            f'<text data-a="{a:.2f}" data-h="projects/{x["slug"]}/" data-y="{esc(x["year"])}" '
            f'data-th="{esc(THEME_OF[x["slug"]][1])}" data-o="{live_url}" data-ow="{way}"'
            f'{ext} x="{WR_T}" transform="rotate({a - 90:.2f})">'
            f'{html.escape(x["title"])}</text>')
    n_before = 0
    for key in DIAL[0] + DIAL[1]:
        label, ws = chapters[key]
        g = next(i for i, (kind, k) in enumerate(wseq) if kind == "g" and k == key)
        a_first, a_last = wang(g + 1), wang(g + len(ws))
        mid = (a_first + a_last) / 2
        half = (len(ws) + 1) * wstep / 2          # a label may use its theme's gap as well
        lines = [label]
        if len(label) > 12:
            cut = min((j for j, ch in enumerate(label) if ch == " "), key=lambda j: abs(j - len(label) / 2))
            lines = [label[:cut], label[cut + 1:]]
        parts = []
        for side, rs in (("up", [121, 107] if len(lines) > 1 else [113]),
                         ("dn", [111, 125] if len(lines) > 1 else [119])):
            for li, (text, r) in enumerate(zip(lines, rs)):
                pid = f"wl-{key}-{side}-{li}"
                wdefs.append(f'<path id="{pid}" d="{arc(mid - half, mid + half, r, side == "dn", 0, 0)}"/>')
                parts.append(f'<text class="{side}"><textPath href="#{pid}" startOffset="50%" '
                             f'text-anchor="middle">{html.escape(text)}</textPath></text>')
        wthemes.append(
            f'<g class="tg" data-a="{mid:.2f}" data-i="{n_before}">'
            f'<path class="hit" d="{band(a_first - wstep * .9, a_last + wstep * .5, 98, 156)}"/>'
            f'<path class="arc" d="{arc(a_first - wstep * .35, a_last + wstep * .35, WR_ARC, False, 0, 0)}"/>'
            f'{"".join(parts)}</g>')
        n_before += len(ws)
    w0, url0, way0 = witems[0]
    wheel = f"""<div class="wheel" id="wheel">
      <div class="turn" tabindex="0" role="slider" aria-label="Works, turned by theme" aria-valuemin="1"
           aria-valuemax="{len(witems)}" aria-valuenow="1" aria-valuetext="{esc(w0["title"])}">
        <svg class="spin" viewBox="-300 -300 600 600" aria-hidden="true">
          <defs>{''.join(wdefs)}</defs>
          <circle class="rim" r="{WR_DOT}"/>
          {''.join(wthemes)}
          <g class="wd">{''.join(wdots)}</g>
          <g class="wt">{''.join(wtexts)}</g>
        </svg>
        <svg class="bezel" viewBox="-300 -300 600 600" aria-hidden="true"><circle cy="-{WR_DOT}" r="9"/></svg>
      </div>
      <div class="read">
        <a class="rt" href="projects/{w0["slug"]}/">{html.escape(w0["title"])}</a>
        <p class="rm">{" · ".join(x for x in (w0["year"], THEME_OF[w0["slug"]][1]) if x)}</p>
        <a class="ro" href="{url0 or '#'}"{"" if way0 else " hidden"}>{way0} ↗</a>
      </div>
    </div>"""

    write_rows = []
    for slug in WRITING:
        pr = by[slug]
        venue = flat_venue(pr)
        write_rows.append(f'      <li><a href="projects/{slug}/">{pr["title"]}</a>'
                          f'<span>{" · ".join(x for x in (pr["year"], venue or pr["sub"]) if x)}</span></li>')

    body = f"""<script>document.documentElement.classList.add("js")</script>
<main class="sheet">

  <div class="dial" id="work" style="--lh:{pitch:.3f}cqw">
    <div class="centre">
      <h1>Eon Meridian</h1>
      <p class="roles-c">artist · writer · technologist · herbalist</p>
      <div class="slot">
        <p class="tag">Old practices, new instruments.<span class="tag-2">Ritual technologies for futures held in common, connecting carbon, silicon and forms of life yet to come.</span></p>
        <figure class="lens" aria-hidden="true"><img alt="" /></figure>
      </div>
      <a class="sub" href="{SUBSTACK}" target="_blank" rel="noopener">Read on Substack ↗</a>
    </div>
    {chart}
    {wheel}
    <nav class="contents" id="live" aria-label="All {len(P)} works by theme">
{chr(10).join(sections)}
    </nav>
  </div>

  <section class="note events" aria-label="Writing and events">
    <h2>Writing &amp; events</h2>
    <ul>
{chr(10).join(write_rows)}
    </ul>
  </section>

  <section class="note about" id="about">
    <h2>About</h2>
    <p>Art, infrastructures and herbal practice at the intersections of memory, networks, value, care
    and the more-than-human.</p>
    <p>Eon Meridian is an artist, writer, technologist and herbalist working across computation,
    medicinal plants, ritual, sound, diagrams and resilient infrastructure. This site is an evolving
    record of works, collaborations, institutions and experiments. Its sibling,
    <a href="https://www.caerjar.com">Caerjar</a>, is the vessel much of this work is built inside.</p>
    <p class="venues">Shown at {", ".join(VENUE_STRIP)}.</p>
    <p class="contact">Get in touch via Caerjar: <a href="mailto:hi@caerjar.com">hi@caerjar.com</a>
    <span class="place">New York</span></p>
  </section>

</main>
<script>
// The wide dial previews a work in its centre while a mouse rests on the title or the keyboard
// focuses it. Touch gets no preview: a tap goes straight to the work.
(function () {{
  var lens = document.querySelector(".lens"), img = lens.querySelector("img"),
      centre = document.querySelector(".centre"), wide = matchMedia("(min-width: 1280px)"), on = null;
  function dot(w, on) {{
    var c = document.querySelector('.chart circle[data-s="' + w.dataset.s + '"]');
    if (c) c.classList.toggle("on", on);
  }}
  function show(w) {{
    if (!wide.matches) return;
    if (on && on !== w) {{ on.classList.remove("on"); dot(on, false); }}
    on = w; w.classList.add("on"); dot(w, true);
    img.src = w.dataset.img; img.alt = w.dataset.alt;
    centre.classList.add("looking");
  }}
  function hide(w) {{
    w.classList.remove("on"); dot(w, false);
    if (on === w) {{ on = null; centre.classList.remove("looking"); }}
  }}
  document.querySelectorAll(".w").forEach(function (w) {{
    w.addEventListener("pointerenter", function (e) {{ if (e.pointerType === "mouse") show(w); }});
    w.addEventListener("pointerleave", function (e) {{ if (e.pointerType === "mouse") hide(w); }});
    w.addEventListener("focusin", function (e) {{ if (e.target.matches(":focus-visible")) show(w); }});
    w.addEventListener("focusout", function () {{ hide(w); }});
  }});
}})();
</script>""" + WHEEL_JS

    ROOT.joinpath("index.html").write_text(page("Eon Meridian: Selected Work",
        "Eon Meridian: artist, writer, technologist, herbalist. Old practices, new instruments: "
        "ritual technologies for futures held in common. Art, infrastructures and herbal practice at the intersections of memory, "
        "networks, value, care and the more-than-human.",
        body, home="index.html", css="assets/site.css"))


def build_project(i, pr):
    # an optional image joins the plate list only when the file is actually on disk
    for src, cap, dark in pr.get("optional_imgs", []):
        if (ROOT / src).exists():
            pr["imgs"].append((src, cap, dark))
    # photographs and screenshots first, diagrams after
    pr["imgs"].sort(key=lambda im: im[0].endswith(".svg"))
    figs = "\n".join(f"""    <figure>
      <div class="plate{' dark' if dark else ''}"><img src="../../{src}" alt="{html.escape(cap, quote=True)}" loading="lazy" /></div>
      <figcaption class="smallcaps">{cap}</figcaption>
    </figure>""" for src, cap, dark in pr["imgs"])

    # a work with no year shows none (no status words stand in for a date)
    meta = ([f"<b>{pr['year']}</b>"] if pr.get("year") else []) + [pr["medium"]]
    if pr.get("venue"):
        meta.append(pr["venue"])
    meta_html = "<br>".join(meta)

    sides = "\n".join(f'    <div class="side"><span class="smallcaps">{h}</span><br>{v}</div>'
        for h, v in pr["side"])

    links = "\n".join((f'    <a href="{href}"{" target=_blank rel=noopener" if href.startswith("http") else ""}>{lbl} ↗</a>'
         if href else f'    <span class="off">{lbl}</span>')
        for lbl, href in pr["links"])

    prev_p, next_p = P[i - 1] if i else None, P[i + 1] if i + 1 < len(P) else None
    prev_html = (f'<a href="../{prev_p["slug"]}/">← {prev_p["title"]}</a>' if prev_p
                 else '<a href="../../index.html#work">← index</a>')
    next_html = (f'<a href="../{next_p["slug"]}/">{next_p["title"]} →</a>' if next_p
                 else '<a href="../../index.html#work">index →</a>')

    body = f"""<main>

<section class="proj-head">
  <div>
    <div class="smallcaps">{pr['num']} / project</div>
    <h1>{pr['title']}</h1>
    <div class="smallcaps" style="margin-top:9px">{pr['sub']}</div>
  </div>
  <div class="proj-meta">{meta_html}</div>
</section>

<p class="lead">{pr['lead']}</p>
{f'<p class="open-app"><a href="{LIVE[pr["slug"]]}" target="_blank" rel="noopener">Open {pr["title"]} ↗</a></p>' if pr["slug"] in LIVE else ''}

{f'<div class="plates">{chr(10)}{figs}{chr(10)}</div>' if figs else ''}

<div class="proj-body">
  <div class="prose">
{pr['prose']}
  </div>
  <div>
{sides}
  </div>
</div>

<div class="links">
{links}
  <a href="../../index.html#work">All work</a>
</div>

<nav class="prevnext">
  <span>{prev_html}</span>
  <span>{next_html}</span>
</nav>

</main>"""

    d = ROOT / "projects" / pr["slug"]
    d.mkdir(parents=True, exist_ok=True)
    d.joinpath("index.html").write_text(page(f"{pr['title']}: Eon Meridian", pr["blurb"], body,
        home="../../index.html", css="../../assets/site.css",
        icon="../../assets/favicon.svg"))


if __name__ == "__main__":
    build_index()
    for i, pr in enumerate(P):
        build_project(i, pr)
    # A work that left the site (its card is no longer site: page) leaves no page behind.
    # Only folders holding nothing but a generated index.html are removed; app folders never.
    keep = {pr["slug"] for pr in P} | houserules.APP_DIRS
    for d in sorted((ROOT / "projects").iterdir()):
        if d.is_dir() and d.name not in keep and [f.name for f in d.iterdir()] == ["index.html"]:
            d.joinpath("index.html").unlink()
            d.rmdir()
            print(f"removed projects/{d.name}/ (no longer on the site)")
    print(f"index.html + {len(P)} project pages")
    problems = houserules.check_site()
    if problems:
        print("house rules broken:\n" + "\n".join(problems), file=sys.stderr)
        sys.exit(1)
