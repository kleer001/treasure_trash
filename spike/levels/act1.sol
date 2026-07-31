:pack   Treasure Trash — Act 1 par solutions
:format 1
;
; LURD, extended:  lowercase = move   UPPERCASE = push   UPPERCASE+! = pounce-tear
; Each entry is replayed through the rules engine by verify.mjs — and every action's
; declared kind must match what the board actually does, so a stale solution fails
; loudly instead of quietly still "working".

:solution L0
:label  par
:moves  uu

:solution L1
:label  par
:moves  uU!dr

:solution L2
:label  par
:moves  UluRU!dl

:solution L3
:label  par
:moves  U!dD!ur
:note   Striking the bottom bag first also solves in 5 — the two orders converge.
