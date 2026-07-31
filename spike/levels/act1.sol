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

:solution L4
:label  par
:moves  D!uuR!l
:note   Clear the low bag first, then walk onto the exit and fire the other one off it.

:solution L5
:label  par
:moves  luRU!dl
:note   Round to the exit, shove the bin right off your launch cell, then strike upward.

:solution L6
:label  par
:moves  UluuRdR!lddd
:note   Roll the bin up, go over the top, roll the emptied bin clear of the bag it dropped, then strike that bag sideways and walk down to the exit.



