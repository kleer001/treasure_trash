# Banned constructions — public copy

`check.py` parses this file. Rules live here as prose, not in code: editing a
bullet retunes the linter with no code change. Section headers are load-bearing —
`check.py` routes by them.

Seeded from the house fiction rulebook (`book_loom/reference/voice_template.md`) Part 1 (itself collated from
cross-repo research, `Wikipedia:Signs_of_AI_writing`, and `nanxstats/llm-cliches`),
narrowed to what applies to **public copy**: store pages, forum posts, captions,
release notes, emails.

Deliberately **not** carried over from that file: show-don't-tell violations,
body-as-emotion-meter tells, interiority dumps, emotion flooding, and the gothic
atmosphere palette. Those govern fiction. A store page has no interiority to dump.
Fiction drafts should use book_loom's list, which is longer and tuned for scenes.

When a word here is the right word, use it and say why. A blanket swap to a
"safe" synonym only trades one tell for another — pick the precise replacement
this sentence needs, not a global substitute.

## Word bans

Flagged as whole words, case-insensitive.

delve, tapestry, realm, embark, leverage, seamless, seamlessly, myriad
pivotal, intricate, intricacies, comprehensive, vibrant, holistic, paramount
transformative, groundbreaking, testament, underscore, underscores, robust
foster, fosters, harness, elevate, unlock, multifaceted, nuanced, synergy
meticulous, meticulously, bespoke, curated, unwavering, profound, profoundly
plethora, immersive, captivating, unparalleled, cutting-edge, revolutionary
game-changing, ethereal, liminal, palpable, evocative, visceral, enigmatic

## Word warnings

Fine in their literal sense, a tell when reached for as flavour. Review each hit.

landscape, navigate, journey, craft, crafted, dive, deep dive, resonate
compelling, engaging, powerful, unique, essential, crucial, vital, key
stunning, remarkable, incredible

## Structural bans

`check.py` matches each regex, case-insensitive. Format: `` `regex` `` — why.

- `\bit'?s not just \w+,? it'?s\b` — the signature AI connector
- `\bmore than just\b` — same construction, shorter
- `\bnot just\b` — the connector's root; check what it is doing
- `\bwhat could only be described as\b` — evasion; describe it
- `\bin today'?s [\w-]+ world\b` — opener that says nothing
- `\bwhen it comes to\b` — throat-clearing; start at the noun
- `\bit'?s important to note\b` — if it were, it would be in the sentence
- `\bat the end of the day\b` — filler
- `\ba testament to\b` — unearned weight
- `\bplays a (?:key|vital|crucial) role\b` — say what it does
- `\bstands as\b` — inflation; use "is"
- `\bserves as (?:a|the)\b` — inflation; use "is"
- `\bthe world of\b` — padding before a noun
- `\bwhether you'?re \w+ or\b` — the audience-flattering fork
- `\blook no further\b` — ad-copy tic
- `\bdesigned to \w+\b` — brochure voice; say what it does
- `\bthat said,` — hedge pivot
- `\bhowever, it'?s worth\b` — hedge pivot

## Exceptions

Words struck from the lists above for this project, each with the reason it is
load-bearing here. An exception is a decision on the record, not a way to keep a
word you like.

<!-- One line per exception: `- word — why it is load-bearing in this game.` -->

## Hedges

Commit or cut. Flagged as SOFT — one hedge in a paragraph is caution, four is a
voice that will not stand behind anything.

arguably, potentially, somewhat, relatively, fairly, quite possibly
may serve, can help, tends to, often considered, generally speaking
in many ways, to some extent, it could be argued
