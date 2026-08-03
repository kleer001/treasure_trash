#!/usr/bin/env python3
"""Mechanical pass for humanized-copy: readability, rhythm, and machine tells.

Reports numbers so a rewrite argues from evidence instead of taste. Exits 1 when
a hard threshold fails, so it can gate a commit.

Ban lists are not in this file -- they live in `banned.md` beside it, parsed by
section header. Editing that markdown retunes the linter with no code change
(the house markdown-as-ruleset pattern; see book_loom/scripts/prefilter.py).

What this measures that a ban-list linter cannot: reading grade, sentence-length
spread, nominalization load, tricolon habit, and repeated sentence openings.

Usage:
  ./check.py path/to/copy.md                     # whole file, markdown stripped
  ./check.py --fenced path/to/copy.md            # only ``` blocks, each its own doc
  ./check.py --budget 200 path/to/copy.md        # fail over a word budget
"""
import re
import statistics
import sys
from pathlib import Path

BANNED = Path(__file__).parent / "banned.md"

# A verb wearing a noun costume. Four letters before the suffix, so "action"
# survives and "implementation" does not.
NOMINALIZATION = re.compile(
    r"\b\w{4,}(?:tion|ment|ness|ity|ance|ence|ization|isation)s?\b", re.I
)

# "A, B, and C" -- the tricolon. One is rhetoric; four in a page is a machine.
TRICOLON = re.compile(r"\b[\w'-]+, [\w'-]+,? and [\w'-]+\b")

# A bullet carries one claim. Past this it has grown an explanatory paragraph and
# stopped being scannable, which is the whole reason the list exists.
BULLET_MAX = 25

VOWELS = "aeiouy"


def parse_banned(path):
    """Section-parse the rulebook into (words, warnings, structural, hedges)."""
    buckets = {"word bans": [], "word warnings": [], "structural bans": [],
               "hedges": [], "exceptions": []}
    current = None
    for line in path.read_text(encoding="utf-8").splitlines():
        header = re.match(r"^##\s+(.*?)\s*$", line)
        if header:
            current = header.group(1).lower()
            continue
        if current not in buckets or not line.strip() or line.startswith(("<!--", ">", "`")):
            continue
        rule = re.match(r"^-\s*`([^`]+)`", line)
        if rule:
            buckets[current].append(rule.group(1))
        elif current == "exceptions":
            allowed = re.match(r"^-\s*([\w-]+)\s+—", line)
            if allowed:
                buckets["exceptions"].append(allowed.group(1).lower())
        elif not line.startswith(("-", "#")):
            buckets[current] += [w.strip() for w in line.split(",") if w.strip()]
    spared = set(buckets["exceptions"])
    keep = lambda ws: [w for w in ws if w.lower() not in spared]
    return (keep(buckets["word bans"]), keep(buckets["word warnings"]),
            buckets["structural bans"], buckets["hedges"])


def syllables(word):
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    count, prev_vowel = 0, False
    for ch in word:
        is_vowel = ch in VOWELS
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith("e") and not word.endswith(("le", "ee")) and count > 1:
        count -= 1
    return max(1, count)


def strip_markdown(raw):
    raw = re.sub(r"^\s*[-*+]\s+", "", raw, flags=re.M)      # list bullets
    # Headings end a sentence. Without the full stop a title runs into the
    # paragraph under it and measures as one long sentence that nobody wrote.
    raw = re.sub(r"^#{1,6}\s+(.*?)([.!?:]?)\s*$",
                 lambda m: m.group(1) + (m.group(2) or "."), raw, flags=re.M)
    raw = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", raw)       # links -> text
    raw = re.sub(r"https?://\S+", "", raw)
    # Markdown files carry raw HTML for layout -- tables, <img>, <details>. Tags
    # are not sentences, and left in they measure as enormous ones.
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"[`*_>]", "", raw)


def drop_bullets(raw):
    """Strip list items and headings, leaving running prose. Rhythm is a property
    of prose: a scannable list is *meant* to be uniform, and a heading is a label,
    so measuring their cadence would punish exactly the shape a store page wants."""
    keep, in_item = [], False
    for line in raw.splitlines():
        if re.match(r"^#{1,6}\s+", line):
            in_item = False
            continue
        if re.match(r"^\s*[-*+]\s+\S", line):
            in_item = True
            continue
        if in_item and line.startswith(("  ", "\t")) and line.strip():
            continue
        in_item = False
        keep.append(line)
    return "\n".join(keep)


def load(path, fenced_only, prose_only=False):
    """The documents to measure. Fenced mode yields one per block: separate posts
    are allowed to repeat each other, and one post is not."""
    raw = Path(path).read_text(encoding="utf-8")
    prep = (lambda t: strip_markdown(drop_bullets(t))) if prose_only else strip_markdown
    if not fenced_only:
        return [prep(raw)]
    blocks = re.findall(r"^```[^\n]*\n(.*?)^```", raw, re.M | re.S)
    if not blocks:
        sys.exit(f"{path}: no fenced blocks found")
    return [prep(b) for b in blocks]


def sentences(text):
    # A line ending in a colon is a label introducing what follows ("Desktop:").
    # Without breaking there it swallows the next paragraph into one sentence.
    parts = re.split(r"(?<=[.!?])[\s\n]+|(?<=:)\n", text)
    return [s.strip() for s in parts if len(s.strip().split()) > 1]


def raw_words(docs):
    """Every word in the copy, including headlines and one-line blocks that the
    readability pass sets aside. Length is length."""
    return [w for d in docs for w in d.split()]


def report(label, hits, limit=12):
    if hits:
        print(f"\n  {label} ({len(hits)}):")
        for h in sorted(set(hits))[:limit]:
            print(f"    {h}")


def bullets(path, fenced):
    """Bullet lines with their wrapped continuations folded back in. A bullet is
    a claim, not a paragraph with a dot in front of it."""
    raw = Path(path).read_text(encoding="utf-8")
    if fenced:
        raw = "\n\n".join(re.findall(r"^```[^\n]*\n(.*?)^```", raw, re.M | re.S))
    out, current = [], None
    for line in raw.splitlines():
        if re.match(r"^\s*[-*+]\s+\S", line):
            if current:
                out.append(current)
            current = re.sub(r"^\s*[-*+]\s+", "", line)
        elif current is not None and line.startswith(("  ", "\t")) and line.strip():
            current += " " + line.strip()
        else:
            if current:
                out.append(current)
            current = None
    if current:
        out.append(current)
    return [strip_markdown(b).strip() for b in out]


def main():
    argv = [a for a in sys.argv[1:]]
    fenced = "--fenced" in argv
    budget = None
    if "--budget" in argv:
        i = argv.index("--budget")
        budget = int(argv[i + 1])
        del argv[i:i + 2]
    args = [a for a in argv if a != "--fenced"]
    if len(args) != 1:
        sys.exit(__doc__)
    path = args[0]
    docs = load(path, fenced)
    prose_docs = load(path, fenced, prose_only=True)
    word_bans, word_warns, structural, hedges = parse_banned(BANNED)

    text = "\n\n".join(docs)
    # Split per document: a block ending without a full stop -- a headline, a
    # caption -- would otherwise run into the next block and measure as one
    # enormous sentence.
    per_doc = [sentences(doc) for doc in prose_docs]
    # Readability is a claim about running prose. A one-sentence block is a
    # headline or a caption, which is meant to be short, and averaging it in
    # drags the grade under the floor for the wrong reason. Ban checks still
    # cover every block.
    prose = [d for d in per_doc if len(d) > 1]
    skipped = len(per_doc) - len(prose)
    sents = [s for d in prose for s in d]
    if not sents:
        sys.exit(f"{path}: no running prose to measure")
    # Too little prose to characterise a rhythm -- with a handful of sentences the
    # spread is noise, not cadence. Report it, don't gate on it.
    thin_prose = len(sents) < 8

    lengths = [len(s.split()) for s in sents]
    words = [w for s in sents for w in s.split()]
    syl = sum(syllables(w) for w in words)
    mean = statistics.mean(lengths)
    spread = statistics.pstdev(lengths) if len(lengths) > 1 else 0.0
    grade = 0.39 * mean + 11.8 * (syl / len(words)) - 15.59

    print(f"{path}{' (fenced blocks, each scored as its own post)' if fenced else ''}")
    print(f"  {len(sents)} sentences, {len(words)} words"
          f"{f', {len(prose)} blocks' if fenced else ''}"
          f"{f' ({skipped} one-line blocks measured for bans only)' if skipped else ''}")
    print(f"  Flesch-Kincaid grade   {grade:5.1f}   ceiling 9; under 6 wants varied length")
    print(f"  mean sentence length   {mean:5.1f}   target 12-18 words")
    print(f"  length spread (stdev)  {spread:5.1f}   want >= 6 -- flat rhythm reads as machine")
    print(f"  shortest / longest     {min(lengths)} / {max(lengths)} words")

    # Total length. Nobody reads a store page; they scan it and leave. See the
    # budgets in SKILL.md -- pass one with --budget to make it a hard gate.
    # In fenced mode the budget is per block: each block is its own post, and a
    # file of twenty posts is not a twenty-times-longer post.
    total = len(raw_words(docs))
    per_block = [len(d.split()) for d in docs]
    if fenced:
        print(f"  total words            {total:5d}   longest post {max(per_block)}"
              f"{f' / budget {budget}' if budget else ''}")
    else:
        print(f"  total words            {total:5d}   "
              f"{'budget ' + str(budget) if budget else 'no budget set'}")
    bul = bullets(path, fenced)
    long_bullets = [(len(b.split()), b) for b in bul if len(b.split()) > BULLET_MAX]
    if bul:
        avg = sum(len(b.split()) for b in bul) / len(bul)
        print(f"  {len(bul)} bullets, {avg:.0f} words each   ceiling {BULLET_MAX}")

    fails = []
    if budget:
        if fenced:
            for i, n in enumerate(per_block, 1):
                if n > budget:
                    fails.append(f"block {i}: {n} words against a {budget} budget "
                                 f"-- cut {n - budget}")
        elif total > budget:
            fails.append(f"{total} words against a {budget} budget -- cut {total - budget}")
    for n, b in long_bullets:
        fails.append(f"{n}-word bullet (ceiling {BULLET_MAX}): {b[:60]}...")
    # Grade 9 is a ceiling, not a band. A low score is only a problem when the
    # sentences are also all the same length -- that combination is the chop.
    # Plain short prose that still varies is the target, not a failure: much
    # published writing people admire scores under 6.
    if grade > 9:
        fails.append(f"grade {grade:.1f} -- too dense to read once")
    if thin_prose:
        print(f"\n  note: only {len(sents)} prose sentences (bullets aren't prose) "
              "-- rhythm not gated")
    elif spread < 6:
        fails.append(f"length spread {spread:.1f} -- the sentences are too alike")
    elif grade < 6:
        print(f"\n  note: grade {grade:.1f} is plain, and the spread carries it. "
              "Check that nothing reads clipped.")
    if not any(n <= 8 for n in lengths):
        fails.append("no sentence under 9 words -- nothing lands")
    for s, n in zip(sents, lengths):
        if n > 32:
            fails.append(f"{n}-word sentence: {s[:64]}...")

    low = text.lower()
    hits = [w for w in word_bans if re.search(rf"\b{re.escape(w)}\b", low)]
    if hits:
        fails += [f"banned word: {w}" for w in sorted(set(hits))]
    report("word warnings -- literal use only",
           [w for w in word_warns if re.search(rf"\b{re.escape(w)}\b", low)])
    struct = [m.group(0) for p in structural for m in re.finditer(p, low)]
    if struct:
        fails += [f"banned construction: {s}" for s in sorted(set(struct))]
    report("hedges -- commit or cut", [h for h in hedges if h in low])
    report("nominalizations -- is there a verb", NOMINALIZATION.findall(text))

    tri = TRICOLON.findall(text)
    if len(tri) > 1:
        report("tricolons -- vary the count", tri)

    # Per document: two posts may open the same way, one post may not.
    for i, doc in enumerate(docs, 1):
        opens = [" ".join(s.split()[:2]).lower() for s in sentences(doc)]
        repeats = sorted({o for o in opens if opens.count(o) > 1})
        report(f"repeated openings{f' in block {i}' if fenced else ''}", repeats)

    dashes = text.count("—") + text.count(" -- ")
    per100 = dashes / len(words) * 100
    if per100 > 1.5:
        print(f"\n  em-dashes: {dashes} ({per100:.1f} per 100 words) -- asides are doing "
              "work that sentences should do")

    if fails:
        print("\nFAIL")
        for f in fails:
            print(f"  {f}")
        return 1
    print("\nPASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
