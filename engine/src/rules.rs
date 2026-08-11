//! The rules, in Rust. A port of `src/rules.js`, which stays the engine of record.
//!
//! This file is not allowed to have an opinion. Where a branch here reads oddly, the reason is
//! that the branch in `src/rules.js` reads that way, and `tools/conform.mjs` compares the two
//! board by board and direction by direction. If the two ever part, the JS is right by
//! definition and this is the bug — that is what "engine of record" means.
//!
//! `blame` is deliberately absent: it is out of the protocol's contract, so it is computed only
//! as far as `reason_for` needs it and never reported. `explain`'s trace is absent for the same
//! reason — nothing on this side draws.

use crate::board::*;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Move,
    Push,
    Tear,
}

impl Kind {
    pub fn name(self) -> &'static str {
        match self {
            Kind::Move => "move",
            Kind::Push => "push",
            Kind::Tear => "tear",
        }
    }
}

pub enum Outcome {
    Ok { kind: Kind, next: State },
    No { reason: &'static str },
}

type Pt = (i32, i32);

// One shove table for the single-cell pushables.
struct Slide {
    slides: u8,
    drops: Option<u8>,
    pours: bool,
}

fn slides_of(o: u8) -> Option<Slide> {
    let s = |slides, drops, pours| Some(Slide { slides, drops, pours });
    match o {
        CAN_FULL => s(CAN_EMPTY, Some(BAG), false),
        STACK => s(CAN_FULL, Some(BAG), false),
        BIN => s(BIN_EMPTY, Some(TRASH), false),
        JUG => s(JUG_EMPTY, None, true),
        JUG_EMPTY => s(JUG_EMPTY, None, false),
        CAN_EMPTY => s(CAN_EMPTY, None, false),
        BIN_EMPTY => s(BIN_EMPTY, None, false),
        _ => None,
    }
}

/// The shove table for the pushables that owe something on landing, and only those.
fn sheds(o: u8) -> Option<Slide> {
    slides_of(o).filter(|t| t.drops.is_some() || t.pours)
}

// --- predicates ------------------------------------------------------------------------------

pub fn is_clear_floor(s: &State, x: i32, y: i32) -> bool {
    s.in_grid(x, y) && {
        let c = s.at(x, y);
        !c.wall && !c.water && c.o == NONE && !c.is_cart()
    }
}

pub fn is_occupiable(s: &State, x: i32, y: i32) -> bool {
    s.in_grid(x, y) && {
        let c = s.at(x, y);
        !c.wall && !c.exit && c.o == NONE && !c.is_cart()
    }
}

fn cart_at(s: &State, p: Pt) -> Option<u16> {
    if s.in_grid(p.0, p.1) && s.at(p.0, p.1).is_cart() {
        Some(s.at(p.0, p.1).cart)
    } else {
        None
    }
}

fn can_rest(s: &State, x: i32, y: i32) -> bool {
    is_occupiable(s, x, y) || cart_at(s, (x, y)).is_some()
}

fn can_pour(s: &State, x: i32, y: i32) -> bool {
    is_occupiable(s, x, y) && {
        let c = s.at(x, y);
        !c.water && !c.bridge
    }
}

/// `!is_cart` is load-bearing: a cart cell reports its cargo's code, so without it a cart
/// carrying a wheelie bin reads as a roller.
fn is_roller(c: &Cell) -> bool {
    !c.is_cart() && (c.o == WHEELIE || c.o == WHEELIE_EMPTY)
}

fn cart_can_enter(s: &State, x: i32, y: i32) -> bool {
    s.in_grid(x, y) && {
        let c = s.at(x, y);
        !c.wall && !c.exit && !c.is_cart() && c.o != FURNITURE
    }
}

/// The one place trash is laid down.
fn lay_trash(c: &mut Cell) {
    if c.water {
        c.water = false;
        c.bridge = true;
    } else {
        c.o = TRASH;
    }
}

/// The one place cargo is put down.
fn drop_o(c: &mut Cell, o: u8) {
    if o == TRASH {
        lay_trash(c);
    } else {
        c.o = o;
    }
}

/// The exit and open water each get their own refusal reason rather than the generic one.
fn reason_for(s: &State, blame: &[Pt], fallback: &'static str) -> &'static str {
    let is = |pred: fn(&Cell) -> bool| {
        blame
            .iter()
            .any(|&(x, y)| s.in_grid(x, y) && pred(s.at(x, y)))
    };
    if is(|c| c.exit) {
        "exit"
    } else if is(|c| c.water && c.o == NONE) {
        "water"
    } else {
        fallback
    }
}

pub fn fan(bx: i32, by: i32, dx: i32, dy: i32) -> [Pt; 5] {
    let (px, py) = (-dy, dx);
    [
        (bx + px, by + py),
        (bx - px, by - py),
        (bx + dx, by + dy),
        (bx + dx + px, by + dy + py),
        (bx + dx - px, by + dy - py),
    ]
}

// --- tipping ---------------------------------------------------------------------------------
// A container comes to rest in three places, and all three go through `tip_fits`/`tip_out`, so
// no caller can disagree with another about what a container owes on landing.

/// `at` is where the container lands, (dx,dy) the direction it was travelling.
fn tip_fits(s: &State, o: u8, at: Pt, dx: i32, dy: i32) -> bool {
    let Some(t) = sheds(o) else { return true };
    let (x, y) = (at.0 + dx, at.1 + dy);
    // He is the one occupant `is_occupiable` cannot see, and he is in the way.
    if s.rac == (x, y) {
        return false;
    }
    if t.pours {
        can_pour(s, x, y)
    } else {
        is_occupiable(s, x, y)
    }
}

fn tips_into(o: u8, at: Pt, dx: i32, dy: i32) -> Option<Pt> {
    sheds(o).map(|_| (at.0 + dx, at.1 + dy))
}

/// The one place a container sheds. `at` already holds it; this is the bill for landing.
fn tip_out(s: &mut State, o: u8, at: Pt, dx: i32, dy: i32) {
    let Some(t) = sheds(o) else { return };
    let (cx, cy) = (at.0 + dx, at.1 + dy);
    match t.drops {
        None => s.at_mut(cx, cy).water = true, // pours
        Some(drops) => drop_o(s.at_mut(cx, cy), drops),
    }
    if t.slides != o {
        s.at_mut(at.0, at.1).o = t.slides;
    }
}

// --- shoving into a cart ----------------------------------------------------------------------

struct Shove {
    file: Vec<Pt>,
    beyond: Pt,
    out: u8,
    dx: i32,
    dy: i32,
}

fn into_cart(s: &State, cid: u16, entry: Pt, dx: i32, dy: i32) -> Result<Shove, Vec<Pt>> {
    let mut file = Vec::new();
    let mut p = entry;
    while cart_at(s, p) == Some(cid) {
        file.push(p);
        p = (p.0 + dx, p.1 + dy);
    }
    let last = *file.last().expect("entry is a cell of this cart");
    let beyond = (last.0 + dx, last.1 + dy);
    let out = s.at(last.0, last.1).o;
    if out != NONE && !is_occupiable(s, beyond.0, beyond.1) {
        return Err(vec![beyond]);
    }
    if out != NONE && !tip_fits(s, out, beyond, dx, dy) {
        return Err(vec![tips_into(out, beyond, dx, dy).expect("out sheds")]);
    }
    Ok(Shove { file, beyond, out, dx, dy })
}

fn apply_into_cart(s: &State, next: &mut State, sh: &Shove, o: u8) {
    // Read from `s`: `next` is being overwritten cell by cell as the file shuffles along.
    for j in (1..sh.file.len()).rev() {
        let was = s.at(sh.file[j - 1].0, sh.file[j - 1].1).o;
        next.at_mut(sh.file[j].0, sh.file[j].1).o = was;
    }
    next.at_mut(sh.file[0].0, sh.file[0].1).o = o;
    if sh.out != NONE {
        drop_o(next.at_mut(sh.beyond.0, sh.beyond.1), sh.out);
        tip_out(next, sh.out, sh.beyond, sh.dx, sh.dy);
    }
}

// --- shoving a cart ----------------------------------------------------------------------------

/// Its cells are grouped into FILES running along the shove; a file is a lead cell plus the cells
/// behind it, and `loads[i][j]` is that file's cargo, lead-first.
fn shove_cart(s: &State, cid: u16, entry: Pt, dx: i32, dy: i32) -> Outcome {
    let along = |p: Pt, k: i32| (p.0 + k * dx, p.1 + k * dy);
    let is_own = |x: i32, y: i32| s.in_grid(x, y) && s.at(x, y).cart == cid;

    let files: Vec<Vec<Pt>> = s
        .cart_cells(cid)
        .into_iter()
        .filter(|&(x, y)| !is_own(x + dx, y + dy)) // lead cells
        .map(|lead| {
            let mut f = Vec::new();
            let mut p = lead;
            while is_own(p.0, p.1) {
                f.push(p);
                p = along(p, -1);
            }
            f // [lead, ..., trail]
        })
        .collect();
    let ahead_at = |k: i32| -> Vec<Pt> { files.iter().map(|f| along(f[0], k + 1)).collect() };

    // Two ways the first beat can be refused: nowhere to roll, or a load that would be pushed
    // out by the swallow with nowhere to shed. Past the first beat the same condition just stops
    // the cart, which is an ordinary way for a roll to end rather than a refusal.
    let first = ahead_at(0);
    let mut blame: Vec<Pt> = first
        .iter()
        .copied()
        .filter(|&(x, y)| !cart_can_enter(s, x, y))
        .collect();
    if blame.is_empty() {
        for (i, f) in files.iter().enumerate() {
            let back = *f.last().expect("a file has a trail");
            let out = s.at(back.0, back.1).o;
            if out == NONE || s.at(first[i].0, first[i].1).o == NONE {
                continue;
            }
            if !tip_fits(s, out, back, -dx, -dy) {
                blame.push(tips_into(out, back, -dx, -dy).expect("out sheds"));
            }
        }
    }
    if !blame.is_empty() {
        return Outcome::No { reason: reason_for(s, &blame, "canRoom") };
    }

    let mut next = s.clone();
    let mut loads: Vec<Vec<u8>> = files
        .iter()
        .map(|f| f.iter().map(|&(x, y)| s.at(x, y).o).collect())
        .collect();

    let mut n = 0i32;
    loop {
        let ahead = ahead_at(n);
        // The cell a swallow pushes the old load back onto is one the cart is vacating this
        // beat, so only the cell that load would shed into has to be free.
        let clear = ahead.iter().all(|&(x, y)| cart_can_enter(&next, x, y));
        let incoming: Vec<u8> = if clear {
            ahead.iter().map(|&(x, y)| next.at(x, y).o).collect()
        } else {
            vec![NONE; files.len()]
        };
        let rolling = clear
            && (0..files.len()).all(|i| {
                if incoming[i] == NONE {
                    return true;
                }
                let load = &loads[i];
                let out = load[load.len() - 1];
                out == NONE || tip_fits(&next, out, along(files[i][load.len() - 1], n), -dx, -dy)
            });
        let taken: Vec<u8> = if rolling { incoming } else { vec![NONE; files.len()] };
        let end = if rolling { n + 1 } else { n }; // where the cart stands once this step is over
        let mut spill: Vec<(Pt, u8)> = Vec::new();

        for i in 0..files.len() {
            if rolling && taken[i] == NONE {
                continue;
            }
            let depth = loads[i].len();
            let out = loads[i][depth - 1];
            let behind = along(files[i][depth - 1], end - 1);
            if !rolling
                && out != NONE
                && (!is_occupiable(&next, behind.0, behind.1)
                    || !tip_fits(&next, out, behind, -dx, -dy))
            {
                continue;
            }
            for j in (1..depth).rev() {
                loads[i][j] = loads[i][j - 1];
            }
            loads[i][0] = taken[i];
            if out != NONE {
                spill.push((behind, out));
            }
        }

        // repaint(end, n)
        for i in 0..files.len() {
            for j in 0..files[i].len() {
                let from = along(files[i][j], n);
                let c = next.at_mut(from.0, from.1);
                c.o = NONE;
                c.cart = NO_ID;
                let to = along(files[i][j], end);
                let cargo = loads[i][j];
                let d = next.at_mut(to.0, to.1);
                d.cart = cid;
                d.o = cargo;
            }
        }
        n = end;
        for (p, o) in spill {
            drop_o(next.at_mut(p.0, p.1), o);
            tip_out(&mut next, o, p, -dx, -dy);
        }
        if !rolling {
            break;
        }
    }

    next.rac = if is_clear_floor(&next, entry.0, entry.1) {
        entry
    } else {
        s.rac
    };
    Outcome::Ok { kind: Kind::Push, next }
}

// --- explain -------------------------------------------------------------------------------

/// What direction `dir` does from this board — without applying it. Every caller goes here.
pub fn explain(s: &State, dir: u8) -> Result<Outcome, String> {
    let (dx, dy) = match dir {
        b'l' => (-1, 0),
        b'u' => (0, -1),
        b'r' => (1, 0),
        b'd' => (0, 1),
        _ => return Err(format!("unknown direction: {}", dir as char)),
    };
    let (x, y) = s.rac;
    let (tx, ty) = (x + dx, y + dy);

    if !s.in_grid(tx, ty) {
        return Ok(Outcome::No { reason: "edge" });
    }
    let target = *s.at(tx, ty);
    if target.wall {
        return Ok(Outcome::No { reason: "wall" });
    }
    if target.water && !is_roller(&target) {
        return Ok(Outcome::No { reason: "water" });
    }
    // A cart cell carries its cargo in `o`, so cart-ness is read before the occupant is.
    if target.is_cart() {
        return Ok(shove_cart(s, target.cart, (tx, ty), dx, dy));
    }

    let o = target.o;

    if o == NONE {
        // Only the raccoon moves, and he rides on `rac` — so the board this lands on IS the board
        // it started from, and the new state shares it. Sound for the same reason it is sound in
        // the JS: every path below that writes to a board goes through `at_mut`, which copies a
        // shared one before writing, so a shared board is never the one being written.
        let mut next = s.clone();
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Move, next });
    }

    if o == TRASH {
        return Ok(Outcome::No { reason: "trash" });
    }

    if o == BAG {
        let blockers: Vec<Pt> = fan(tx, ty, dx, dy)
            .into_iter()
            .filter(|&(fx, fy)| !is_occupiable(s, fx, fy))
            .collect();
        if !blockers.is_empty() {
            return Ok(Outcome::No { reason: reason_for(s, &blockers, "fan") });
        }
        let mut next = s.clone();
        for (fx, fy) in fan(tx, ty, dx, dy) {
            lay_trash(next.at_mut(fx, fy));
        }
        next.at_mut(tx, ty).o = NONE;
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Tear, next });
    }

    if o == FURNITURE {
        let own = s.piece_cells(target.pid);
        let blame: Vec<Pt> = own
            .iter()
            .map(|&(ox, oy)| (ox + dx, oy + dy))
            .filter(|p| !own.contains(p) && !is_occupiable(s, p.0, p.1))
            .collect();
        if !blame.is_empty() {
            return Ok(Outcome::No { reason: reason_for(s, &blame, "canRoom") });
        }
        let mut next = s.clone();
        for &(ox, oy) in &own {
            let c = next.at_mut(ox, oy);
            c.o = NONE;
            c.pid = NO_ID;
        }
        for &(ox, oy) in &own {
            let c = next.at_mut(ox + dx, oy + dy);
            c.o = o;
            c.pid = target.pid;
        }
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    // One shape of shove for everything in the slide table, so the clearance test lives in one
    // place.
    if let Some(t) = slides_of(o) {
        let c1 = (tx + dx, ty + dy);
        let c2 = (tx + 2 * dx, ty + 2 * dy);
        let into = cart_at(s, c1);
        let tips = into.is_none() && (t.drops.is_some() || t.pours);
        let mut blame: Vec<Pt> = Vec::new();
        if !can_rest(s, c1.0, c1.1) {
            blame.push(c1);
        }
        if tips && !tip_fits(s, o, c1, dx, dy) {
            blame.push(c2);
        }
        let mut shove = None;
        if let (Some(cid), true) = (into, blame.is_empty()) {
            match into_cart(s, cid, c1, dx, dy) {
                Ok(sh) => shove = Some(sh),
                Err(b) => blame.extend(b),
            }
        }
        if !blame.is_empty() {
            return Ok(Outcome::No { reason: reason_for(s, &blame, "canRoom") });
        }
        let lands = if tips { t.slides } else { o };
        let mut next = s.clone();
        if tips {
            match t.drops {
                None => next.at_mut(c2.0, c2.1).water = true, // pours
                Some(drops) => drop_o(next.at_mut(c2.0, c2.1), drops),
            }
        }
        match &shove {
            Some(sh) => apply_into_cart(s, &mut next, sh, lands),
            None => next.at_mut(c1.0, c1.1).o = lands,
        }
        next.at_mut(tx, ty).o = NONE;
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    if is_roller(&target) {
        let (mut rx, mut ry) = (tx, ty);
        while is_occupiable(s, rx + dx, ry + dy) {
            rx += dx;
            ry += dy;
        }
        if (rx, ry) == (tx, ty) {
            let stop = [(tx + dx, ty + dy)];
            return Ok(Outcome::No { reason: reason_for(s, &stop, "canRoom") });
        }
        let mut next = s.clone();
        next.at_mut(tx, ty).o = NONE;
        next.at_mut(rx, ry).o = o;
        // Tested against the rolled board, not the original: on a one-cell roll this cell is the
        // bin's own start.
        let back = (o == WHEELIE).then(|| (rx - dx, ry - dy));
        if let Some(b) = back {
            if !is_occupiable(&next, b.0, b.1) {
                return Ok(Outcome::No { reason: reason_for(s, &[b], "canRoom") });
            }
            next.at_mut(rx, ry).o = WHEELIE_EMPTY;
            drop_o(next.at_mut(b.0, b.1), BAG);
        }
        next.rac = if is_clear_floor(&next, tx, ty) {
            (tx, ty)
        } else {
            s.rac
        };
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    Err(format!("unknown occupant {o} at {tx},{ty}"))
}
