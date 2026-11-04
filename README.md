# Eon Meridian

> Old practices, new instruments. Ritual technologies for futures held in common: art, infrastructures and herbal practice at the intersections of memory, networks, value, care and the more-than-human.

Portfolio site for **Eon Meridian**, with the **Caerjar** landing page kept alongside it. Designed to live on GitHub Pages and grow into a place to publish code and writing.

Two visual languages live here: the portfolio is editorial (paper, monospace, serif headings, hairline rules); Caerjar is a Klein-blue blueprint (cream paper, technical coordinate diagram, survey marks).

## Structure

```
caerjar/
├── index.html            # Eon Meridian portfolio: hero, work cards, collaborations, about
├── caerjar.html          # Caerjar landing page (a vessel for care), self-contained
├── projects/<slug>/      # one page per work, 21 of them
│   └── index.html
├── assets/
│   ├── site.css          # shared stylesheet for the index and every work page
│   └── img/              # documentation images and generated plates
├── .nojekyll             # tell GitHub Pages to serve files as-is (no Jekyll processing)
├── .gitignore
└── README.md
```

No framework, no build, no dependencies: plain static HTML served as-is. Edit a file directly and
refresh. `caerjar.html` keeps its own inline CSS; the portfolio pages share `assets/site.css`,
because fifteen copies of one stylesheet is fifteen places to forget.

### Where the content comes from

Every project page is written from that project's own `README.md` / `direction.md` in `~/caerjar`:
status, test counts, invariants, venues and dates included. Nothing on those pages is invented, so
when a project's status changes, update the page from the source rather than from memory.

The works with no repository are sourced from elsewhere and cited on their pages:

| Work | Source |
|---|---|
| Evertunes | [opensea.io/evertunes-studio](https://opensea.io/evertunes-studio): collection text, story titles, traits |
| What the Tech | [visions2030.studio reel](https://www.instagram.com/reel/DTOUu3GExM4/): Ethical Imagination |
| Heddatron | [Wikipedia](https://en.wikipedia.org/wiki/Heddatron): cast, venue, robot credits |
| Peat and Repeat | [peatandrepeat.org](https://www.peatandrepeat.org/who) |
| Mugworts | [mugwortsherbalclinic.com](https://www.mugwortsherbalclinic.com/) |
| Kokowa | [WIRED, Apr 2017](https://www.wired.com/2017/04/want-kick-putin-virtual-world-kokowa/) |
| PAOM | [paom.com](https://paom.com/) |
| 13Bit Productions | [13bit.com](https://www.13bit.com/) |
| PGM Diagrams | `diagrammatic-immanence` and `machinic-hymns` in `~/caerjar` |

Venues, fellowships and residencies were supplied by the artist and are shown in each page's meta
block: HOPE and Ars Electronica (Sanctuary), Visions2030 (What the Tech), Sphinx (PGM Diagrams),
Recurse Center (both coins), Banff (Emu Butch), DWeb / HOPE / Black Sky Crete (Mugworts).

**Prayer Coin, Unpaid Labor Coin and Emu Butch still have drafted body copy**: the venue lines are
real, but the prose around them is written from the medium, not from the artist's account. Replace
it.

### Images

`assets/img/` holds two kinds of file:

- **Real documentation**: plates from `machinic-hymns`, string diagrams from
  `diagrammatic-immanence`, screenshots from `dream`, sample inputs from `SigilStudio`, the
  Evertunes stills, and `app-*.jpg` screenshots of the two apps that have live demos
  (Palimpsest, Sigil Studio) captured from eonmeridian.github.io.
- **Generated plates** (`plate-<slug>.svg`), for works with no documentation image. These are
  marks, not photographs: deterministic diagrams drawn in the site's own visual language, seeded
  from the slug. Two generators make them `tools/plates.py` in ink only, and
  `tools/colorplates.py`, which gives each work one or two spot colors taken from its own subject
  (brass for the coins, rubric red for the papyri, peat and moss for the edition house). Replace any
  of them with real documentation whenever you have it.
- **Fetched on demand** `bash tools/fetch-evertunes.sh` pulls four Westward Ho stills from the
  OpenSea CDN. `build.py` uses them automatically once they exist and falls back to the generated
  chapter plate when they don't, so the site is never broken by their absence.

### tools/

The HTML in `projects/` and `index.html` is committed static output and is served directly: there
is no build step in the deploy path. `tools/` holds the two scripts that produced it, so fifteen
pages stay consistent when the template or the content changes:

```bash
python3 tools/plates.py       # ink plates      → assets/img/plate-*.svg
python3 tools/colorplates.py  # color plates    → assets/img/plate-*.svg
bash    tools/fetch-evertunes.sh   # optional: real Westward Ho stills
python3 tools/build.py        # index.html and every projects/<slug>/index.html
```

Project copy lives in the `P` table in `tools/build.py`. Editing a generated page by hand works
until the next `build.py` run overwrites it: put the change in the table instead.

## Preview locally

```bash
bash tools/serve.sh          # opens http://localhost:8000
bash tools/serve.sh 9001     # a different port
```

Opening `index.html` with `file://` will **not** work: the `projects/<slug>/` links need a server
to resolve to their `index.html`. Always preview through `serve.sh`. Nothing about previewing
touches the live site; publishing is a separate `git commit && git push`.

After editing `tools/build.py`, run `python3 tools/build.py` and reload the page.

## Publish on GitHub Pages

1. Create the repo and push:
   ```bash
   gh repo create caerjar --public --source=. --remote=origin --push
   ```
   (or create the repo on github.com and `git remote add origin …` + `git push -u origin main`)

2. Enable Pages: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.

3. Your site goes live at `https://<user>.github.io/caerjar/`.
   For a custom domain (`caerjar.org`), add a `CNAME` file with the domain and configure DNS, then set it under Settings → Pages.

## Publishing code alongside the site

Drop projects in subfolders (e.g. `projects/<name>/`) and link them from the
Selected Work list in `index.html` (or the Current Vessels panel in
`caerjar.html`). Anything committed to the repo is served by Pages, so code,
write-ups, and demos can all live here.

## Credit

Portfolio layout adapted from an editorial mockup; the Caerjar page from a blue-blueprint mockup. Language and goals are Eon's and Caerjar's.

## House rules

Two constraints this site is held to. Check both before publishing.

1. **No real name.** The site is published as Eon Meridian only. Sources that name the artist
   otherwise (the Heddatron robot credits, the Visions2030 reel, PAOM's founding) are cited by
   organization: Botmatrix, Visions2030, "a sibling enterprise", never by personal name.
2. **No mention of AI.** No vendor names, no "AI", no "artificial intelligence" or "machine
   learning" anywhere in the published pages.
3. **No em-dashes.** Anywhere in the published pages or in `tools/`. A dash introducing a clause
   takes a comma, a dash introducing an appositive or gloss takes a colon, and a parenthetical pair
   takes parentheses. The six SVGs generated by the artist's own repos
   (`di-*.svg`, `meridian-*.svg`) are source artwork and are left exactly as they came.

```bash
# should print nothing
grep -rniE "meredith|finkelstein|\bA\.?I\.?\b|claude|anthropic|openai|artificial intelligence|machine learning" \
  --include="*.html" --include="*.css" --include="*.md" .
```

Note that `git log` messages are exempt by decision, not by oversight: the commit trailers were
left as they are.
