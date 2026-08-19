# research/

Market and competitor research on games in the wild: one raccoon-themed simulator and two
block-pusher exemplars, studied for what caused their attention and what it was worth.

Self-contained. These are notes about other people's games and the market they sit in — nothing
here describes, prescribes for, or constrains any project.

## What's here

| File | What it is |
|---|---|
| `marketing-playbooks.md` | Three playbooks side by side, and the channels the evidence names. **Start here.** |
| `trash-panda-dossier.md` | The raccoon simulator, with numbers: what it is, what it sold, its timeline, its press. |
| `review-teardown.md` | Every English Steam review of it, coded into themes, with quotes. |
| `case-trash-panda-marketing.md` | Channel-by-channel forensics on it: TV, blogs, Reddit, YouTube, events, collabs. |
| `case-stephens-sausage-roll.md` | The peer-endorsement playbook: no marketing, six words of store copy, ten years of sales. |
| `case-baba-is-you.md` | The free-build-plus-festivals playbook: give the idea away two years early. |
| `competitive-landscape.md` | The block-pusher shelf and the free browser-puzzle field, with numbers. |
| `the-gap.md` | What the three cases add up to: the unoccupied crossing, and what it is and is not worth. |
| `lone-voices.md` | Real, dated, unanswered posts from people asking for something. |
| `raw/` | The API dumps the numbers came from, so a later reader can re-derive them. |

## How it was gathered

Steam storefront and review APIs, SteamSpy, Steam news feeds and discussion boards, itch.io
pages, YouTube search by view count, Reddit search, Wikipedia, and press coverage. Raw JSON is
in `raw/`.

**Read date for all figures: 2026-08-18.** Every one of them moves — re-pull before quoting any
of them anywhere public.

Re-pull commands:

```sh
curl -s "https://store.steampowered.com/appreviews/1669320?json=1&filter=all&language=english&num_per_page=100&purchase_type=all" -o raw/trashpanda-reviews.json
curl -s "https://steamspy.com/api.php?request=appdetails&appid=1669320" -o raw/trashpanda-steamspy.json
curl -s "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=1669320&count=20&maxlength=600&format=json" -o raw/tp-news.json
```

Steam appids used here: **1669320** Trash Panda, **353540** Stephen's Sausage Roll,
**736260** Baba Is You.

## The one-paragraph version

*Trash Panda* (Jason Leaver, Steam, Nov 2023, $9.99) proved that the raccoon-in-the-garbage
fantasy pulls press on its own — a CTV segment made it viral as a prototype, and CBC, blogTO and
Daily Hive followed at launch, with no genre hook of any kind. It converted that attention into
40 reviews, a Mixed rating and an owner estimate under 20,000, and the reason is stated on its
own review page in one voice: there is nothing to *do*. It has had no update since June 2024 and
its board's questions go unanswered. Meanwhile the two block-pushers studied here got nothing
from press and everything from a small, dense genre community: *Stephen's Sausage Roll* shipped
with a six-word store description and two famous developers vouching for it, and is still
selling a decade later; *Baba Is You* gave its jam build away free for two years, won IGF awards
on it before release, and sold over a million. The fantasy is proven and currently unattended,
its audience has said out loud what it wanted, and none of the 2,297 sokoban-tagged games on
itch.io is wearing that costume.
