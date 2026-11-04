"""The site's house rules, checked on every page the build writes.

1. No em-dashes.
2. No mention of AI, vendors or machine learning.
3. No real name, and no vendor or library names. Those terms live in
   tools/.houserules-private (one per line, gitignored), because this file is
   published with the site.

`check(path, text)` returns a list of problems; build.py stops on any.
Run directly to check the built site: python3 tools/houserules.py
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

EM_DASH = chr(0x2014)
AI_CASED = re.compile(r"\bAI\b")
AI_TERMS = re.compile(
    r"\b(artificial intelligence|machine learning|language models?|LLMs?|neural net\w*)\b", re.I)

# Folders an app publishes into the site by itself (build.py APPS); their own repos own them.
APP_DIRS = {"correspondences"}


def private_terms():
    f = HERE / ".houserules-private"
    if not f.exists():
        return []
    return [t.strip() for t in f.read_text().splitlines() if t.strip() and not t.startswith("#")]


def check(name, text, terms=None):
    terms = private_terms() if terms is None else terms
    out = []
    for n, line in enumerate(text.split("\n"), 1):
        if EM_DASH in line:
            out.append(f"{name}:{n}: em-dash")
        if AI_CASED.search(line) or AI_TERMS.search(line):
            out.append(f"{name}:{n}: AI or vendor term: {line.strip()[:80]}")
        for t in terms:
            if t.lower() in line.lower():
                out.append(f"{name}:{n}: private term")
    return out


def check_site():
    pages = [ROOT / "index.html"] + sorted(
        p for p in (ROOT / "projects").glob("*/index.html") if p.parent.name not in APP_DIRS)
    problems = []
    for p in pages:
        problems += check(str(p.relative_to(ROOT)), p.read_text())
    return problems


if __name__ == "__main__":
    probs = check_site()
    if not private_terms():
        print("note: tools/.houserules-private is missing, so the real-name check is off", file=sys.stderr)
    print("\n".join(probs) if probs else "house rules: clean")
    sys.exit(1 if probs else 0)
