"""Read a work.md: a TOML header between +++ lines, then the page text.

    +++
    title = "Bloomcast"
    sub = "A music visualiser that listens to the room"
    ...
    +++
    The first paragraph is the lead.

    ## A heading
    The rest is the page body.

The body is a small Markdown subset (headings, paragraphs, lists, bold, italic,
code, links). A body or lead that starts with "<" is HTML and is used exactly as
written. Standard library only, so the site keeps its no-dependencies rule.
"""
import html
import re
import tomllib

FENCE = "+++"


def split(text):
    """Return (header dict, body str) for a work.md."""
    lines = text.split("\n")
    if lines[0].strip() != FENCE:
        raise ValueError("work.md must start with a +++ line")
    end = next(i for i in range(1, len(lines)) if lines[i].strip() == FENCE)
    header = tomllib.loads("\n".join(lines[1:end]))
    body = "\n".join(lines[end + 1:])
    if body.startswith("\n"):
        body = body[1:]
    if body.endswith("\n"):
        body = body[:-1]
    return header, body


def inline(s):
    """Markdown inline marks to HTML. Text already holding tags is left alone."""
    if "<" in s:
        return s
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![*\w])\*([^*]+)\*(?!\w)", r"<i>\1</i>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', s)
    return s


def blocks(md):
    """Markdown block subset to HTML."""
    out = []
    for block in re.split(r"\n\s*\n", md.strip()):
        lines = block.split("\n")
        first = lines[0]
        if first.startswith("<"):
            out.append(block)
        elif first.startswith("## "):
            out.append(f"<h2>{inline(first[3:].strip())}</h2>")
            if len(lines) > 1:
                out.append(f"<p>{inline(' '.join(l.strip() for l in lines[1:]))}</p>")
        elif all(l.startswith(("- ", "* ")) or l.startswith("  ") for l in lines):
            items, cur = [], None
            for l in lines:
                if l.startswith(("- ", "* ")):
                    if cur is not None:
                        items.append(cur)
                    cur = l[2:].strip()
                else:
                    cur += " " + l.strip()
            items.append(cur)
            out.append("<ul>\n" + "\n".join(f"<li>{inline(i)}</li>" for i in items) + "\n</ul>")
        else:
            out.append(f"<p>{inline(' '.join(l.strip() for l in lines))}</p>")
    return "\n".join(out)


def page_parts(body):
    """Split a work.md body into (lead, prose), both as HTML."""
    # <!-- source: path:line --> notes are for checking facts; they are never published
    body = re.sub(r"[ \t]*<!--.*?-->", "", body, flags=re.S)
    lead, _, prose = body.partition("\n\n")
    lead_html = lead if lead.lstrip().startswith("<") else inline(lead.strip())
    prose_html = prose if prose.lstrip().startswith("<") or not prose.strip() else blocks(prose)
    return lead_html, prose_html


def card_frontmatter(text):
    """Flat `key: value` pairs from a vault card's --- frontmatter. Lists stay strings."""
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    out = {}
    for line in text[3:end].split("\n"):
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*$", line)
        if m:
            v = m.group(2)
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            out[m.group(1)] = v
    return out
