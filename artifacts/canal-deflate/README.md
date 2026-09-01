# Cargo into the canal

Two recordings of one shove: a skateboard pinned against a wall tips its load backward into open
water, which keeps it. `before.gif` is the build at `fcdd061`, `after.gif` the build at `20f2d44`.

Both walk the board from `#-x##` to `#--##`. What differs is only how the removal is drawn: the
earlier build carried the spill across at full size and dropped the sprite on arrival, the later
one deflates it over the journey.

Captured from the served page through the game's own input handler, with the page's animation
clock replaced by one driven a frame at a time — a headless browser throttles animation frames
unevenly, so wall-clock capture cannot be compared between two builds.

Published page: https://claude.ai/code/artifact/1f43887d-0599-4733-9926-b680d21516ce
