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

// One shove table for the single-cell pushables. Read the entries, not a paraphrase.
struct Slide {
    slides: u8,
    drops: Option<u8>,
    pours: bool,
    soaks: bool,
    covers: bool,
}

const fn sl(slides: u8) -> Slide {
    Slide { slides, drops: None, pours: false, soaks: false, covers: false }
}

fn slides_of(o: u8) -> Option<Slide> {
    Some(match o {
        CAN_FULL => Slide { drops: Some(BAG), ..sl(CAN_EMPTY) },
        STACK => Slide { drops: Some(BAG), ..sl(CAN_FULL) },
        BIN => Slide { drops: Some(TRASH), ..sl(BIN_EMPTY) },
        JUG => Slide { pours: true, ..sl(JUG_EMPTY) },
        JUG_EMPTY => sl(JUG_EMPTY),
        CAN_EMPTY => sl(CAN_EMPTY),
        BIN_EMPTY => sl(BIN_EMPTY),
        TIRE_H => sl(TIRE_H),
        TIRE_V => sl(TIRE_V),
        MAG_U => sl(MAG_U),
        MAG_D => sl(MAG_D),
        MAG_L => sl(MAG_L),
        MAG_R => sl(MAG_R),
        SPONGE => Slide { soaks: true, ..sl(SPONGE) },
        CARDBOARD => Slide { covers: true, ..sl(CARDBOARD) },
        _ => return None,
    })
}

/// What a container reads as once it has landed and shed.
fn lands_as(o: u8) -> u8 {
    match sheds(o) {
        Some(t) => t.slides,
        None => o,
    }
}

/// The shove table for the pushables that owe something on landing, and only those.
fn sheds(o: u8) -> Option<Slide> {
    slides_of(o).filter(|t| t.drops.is_some() || t.pours)
}

// --- predicates ------------------------------------------------------------------------------

pub const MAGNET_REACH: i32 = 3;

fn dir_of(d: u8) -> (i32, i32) {
    match d {
        b'l' => (-1, 0),
        b'u' => (0, -1),
        b'r' => (1, 0),
        _ => (0, 1),
    }
}
const DIR_ORDER: [u8; 4] = [b'u', b'd', b'l', b'r'];

pub fn is_multi_cell_o(o: u8) -> bool {
    o == FURNITURE || o == BICYCLE || o == RUG
}

fn cabinet_face(o: u8) -> u8 {
    match o {
        CABC_U | CABO_U => b'u',
        CABC_D | CABO_D => b'd',
        CABC_L | CABO_L => b'l',
        _ => b'r',
    }
}
fn is_cabinet_closed(o: u8) -> bool {
    (CABC_U..=CABC_R).contains(&o)
}
fn is_cabinet_open(o: u8) -> bool {
    (CABO_U..=CABO_R).contains(&o)
}
fn cab_opens(o: u8) -> u8 {
    o + (CABO_U - CABC_U)
}
fn cab_shuts(o: u8) -> u8 {
    o - (CABO_U - CABC_U)
}

fn magnet_face(o: u8) -> u8 {
    match o {
        MAG_U => b'u',
        MAG_D => b'd',
        MAG_L => b'l',
        _ => b'r',
    }
}
fn is_magnet(o: u8) -> bool {
    (MAG_U..=MAG_R).contains(&o)
}

/// What a magnet takes hold of. The chair is in and the sponge is not.
fn is_metal(c: &Cell) -> bool {
    if c.is_cart() {
        return is_barrow(c.ck);
    }
    matches!(
        c.o,
        CAN_FULL
            | CAN_EMPTY
            | BIN
            | BIN_EMPTY
            | WHEELIE
            | WHEELIE_EMPTY
            | TIRE_H
            | TIRE_V
            | BICYCLE
            | CHAIR
            | CABC_U
            | CABC_D
            | CABC_L
            | CABC_R
            | CABO_U
            | CABO_D
            | CABO_L
            | CABO_R
            | DRAWER
            | MAG_U
            | MAG_D
            | MAG_L
            | MAG_R
    )
}

fn is_barrow(k: u8) -> bool {
    k == BARROW_H || k == BARROW_V
}
fn barrow_rolls_along(k: u8, dx: i32, _dy: i32) -> bool {
    if k == BARROW_H {
        dx != 0
    } else {
        dx == 0
    }
}

// --- terrain ---------------------------------------------------------------------------------

fn is_tar(c: &Cell) -> bool {
    c.ter == TAR
}
fn is_grease(c: &Cell) -> bool {
    c.ter == GREASE
}
fn is_glass(c: &Cell) -> bool {
    c.ter == GLASS
}
fn is_grate(c: &Cell) -> bool {
    c.grate
}

/// One-way cells bind the raccoon and objects alike, so the test needs the direction of travel
/// and cannot sit in `is_occupiable` with the rest.
fn may_enter(s: &State, x: i32, y: i32, dx: i32, dy: i32) -> bool {
    s.in_grid(x, y) && {
        let w = s.at(x, y).oneway;
        w == NO_DIR || dir_of(w) == (dx, dy)
    }
}

/// The one place water is laid down.
fn pour(c: &mut Cell) {
    if is_grate(c) {
        return;
    }
    if c.ter == GREASE || c.ter == TAR {
        c.ter = DRY;
    }
    c.water = true;
}

/// The one place water and grease are taken OFF a cell.
fn soak(c: &mut Cell) {
    if c.water {
        c.water = false;
    } else if c.ter == GREASE {
        c.ter = DRY;
    }
}

fn covers_over(c: &Cell) -> bool {
    c.water || c.ter == TAR || c.ter == GLASS
}
fn cover(c: &mut Cell) -> bool {
    if !covers_over(c) {
        return false;
    }
    c.water = false;
    c.ter = COVERED;
    true
}

// --- links -----------------------------------------------------------------------------------

fn link_cells(s: &State, lk: u16) -> Vec<Pt> {
    let mut out = Vec::new();
    for y in 0..s.rows {
        for x in 0..s.cols {
            if s.at(x, y).lk == lk {
                out.push((x, y));
            }
        }
    }
    out
}

/// An id no link on this board is using.
fn free_link(s: &State) -> u16 {
    let mut top: i32 = -1;
    for c in s.cells.iter() {
        if c.lk != NO_ID && c.lk as i32 > top {
            top = c.lk as i32;
        }
    }
    (top + 1) as u16
}

pub fn is_clear_floor(s: &State, x: i32, y: i32) -> bool {
    s.in_grid(x, y) && {
        let c = s.at(x, y);
        !c.wall && !c.water && !is_glass(c) && c.o == NONE && !c.is_cart()
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

/// Where a travelling thing may go on to. Tar is enterable and never left, so it ends travel
/// rather than forbidding it.
fn travels_into(s: &State, x: i32, y: i32, dx: i32, dy: i32) -> bool {
    is_occupiable(s, x, y) && may_enter(s, x, y, dx, dy)
}

/// A piece standing on tar is there for good, and a multi-cell one needs only a single foot in
/// it. `explain` asks before it asks anything else, so no branch can forget.
fn stuck_in_tar(s: &State, tx: i32, ty: i32) -> bool {
    let c = s.at(tx, ty);
    if is_tar(c) {
        return true;
    }
    if c.o == SPONGE && is_glass(c) {
        return true; // shards in the sponge; it does not come off
    }
    if is_multi_cell_o(c.o) {
        return s.piece_cells(c.pid).iter().any(|&(x, y)| is_tar(s.at(x, y)));
    }
    if c.is_cart() {
        return s.cart_cells(c.cart).iter().any(|&(x, y)| is_tar(s.at(x, y)));
    }
    false
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
    !c.is_cart()
        && matches!(c.o, WHEELIE | WHEELIE_EMPTY | TIRE_H | TIRE_V | CHAIR)
}

/// Whether a rolling KIND rolls THIS way. The question a shove asks is never "does this roll"
/// but "does this roll from here", and the answer decides which branch it takes.
fn rolls_along(c: &Cell, dx: i32, dy: i32) -> bool {
    is_roller(c)
        && match c.o {
            TIRE_H => dx != 0,
            TIRE_V => dy != 0,
            _ => true,
        }
}

/// A multi-cell piece's long axis, read off its own footprint.
fn long_axis_is_x(cells: &[Pt]) -> bool {
    let (mut minx, mut maxx, mut miny, mut maxy) = (i32::MAX, i32::MIN, i32::MAX, i32::MIN);
    for &(x, y) in cells {
        minx = minx.min(x);
        maxx = maxx.max(x);
        miny = miny.min(y);
        maxy = maxy.max(y);
    }
    maxx - minx >= maxy - miny
}

fn rolls_longways(o: u8) -> bool {
    o == BICYCLE || o == RUG
}

/// Whether the thing standing here rolls THIS way — one cell or many, the same question. A
/// multi-cell piece asks it of its own footprint; that is what lets a rug hand its motion to a
/// bicycle, and what stops it when the two lie across each other.
fn rolls_here(s: &State, x: i32, y: i32, dx: i32, dy: i32) -> bool {
    let c = s.at(x, y);
    if is_multi_cell_o(c.o) {
        return rolls_longways(c.o) && long_axis_is_x(&s.piece_cells(c.pid)) == (dx != 0);
    }
    rolls_along(c, dx, dy)
}

fn cart_can_enter(s: &State, x: i32, y: i32, dx: i32, dy: i32) -> bool {
    s.in_grid(x, y) && {
        let c = s.at(x, y);
        !c.wall && !c.exit && !c.is_cart() && !is_multi_cell_o(c.o) && may_enter(s, x, y, dx, dy)
    }
}

/// The one place trash is laid down.
fn lay_trash(c: &mut Cell) {
    if is_grate(c) {
        return; // straight through, and gone
    }
    if c.water {
        c.water = false;
        c.bridge = true;
    } else {
        c.o = TRASH;
    }
}

/// The one place cargo is put down. A grate takes what lands in it, and takes it for good.
fn drop_o(c: &mut Cell, o: u8) {
    if is_grate(c) {
        return;
    }
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
    } else if is(is_glass) {
        "glass"
    } else if is(is_tar) {
        "tar"
    } else if is(|c| c.oneway != NO_DIR) {
        "oneway"
    } else {
        fallback
    }
}

/// Which way a chair goes when the burst reaches it: directly away from the bag. A ray that
/// comes out diagonal takes the direction the burst itself is travelling, because a grid has
/// nowhere else to put it.
fn flee_from(bx: i32, by: i32, dx: i32, dy: i32, fx: i32, fy: i32) -> (i32, i32) {
    let (rx, ry) = ((fx - bx).signum(), (fy - by).signum());
    if rx != 0 && ry != 0 {
        (dx, dy)
    } else {
        (rx, ry)
    }
}

/// A chair in the fan is not a wall — it is something the burst MOVES, provided it has anywhere
/// to go. So the fan's legality turns on a cell beyond the fan.
fn chair_flees(s: &State, bx: i32, by: i32, dx: i32, dy: i32, fx: i32, fy: i32) -> Option<Pt> {
    let (ax, ay) = flee_from(bx, by, dx, dy, fx, fy);
    let to = (fx + ax, fy + ay);
    (is_occupiable(s, to.0, to.1) && may_enter(s, to.0, to.1, ax, ay)).then_some(to)
}

fn fan_blockers(s: &State, bx: i32, by: i32, dx: i32, dy: i32) -> Vec<Pt> {
    let mut blame = Vec::new();
    for (x, y) in fan(bx, by, dx, dy) {
        if is_occupiable(s, x, y) {
            continue;
        }
        if s.in_grid(x, y) && s.at(x, y).o == CHAIR {
            if chair_flees(s, bx, by, dx, dy, x, y).is_some() {
                continue;
            }
            let (ax, ay) = flee_from(bx, by, dx, dy, x, y);
            blame.push((x, y));
            blame.push((x + ax, y + ay));
            continue;
        }
        blame.push((x, y));
    }
    blame
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
    let kind = s.at(entry.0, entry.1).ck;
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
        .filter(|&(x, y)| !cart_can_enter(s, x, y, dx, dy))
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
        let clear = ahead.iter().all(|&(x, y)| cart_can_enter(&next, x, y, dx, dy))
            && !files.iter().any(|f| is_tar(next.at(along(f[0], n).0, along(f[0], n).1)));
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
            // A cart that stops rolling pushes its load out the back. A barrow does not: what it
            // scooped stays in it until it is tipped, which is the whole of what scooping buys.
            if !rolling && is_barrow(kind) {
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
                c.ck = CART;
                let to = along(files[i][j], end);
                let cargo = loads[i][j];
                let d = next.at_mut(to.0, to.1);
                d.cart = cid;
                // The kind travels with the cart. Without it a barrow becomes an ordinary cart
                // the moment it moves — and the key would then read two boards alike.
                d.ck = kind;
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

// --- carrying on ------------------------------------------------------------------------------

/// The cell of a piece furthest along the shove. Ties keep the first in raster order.
fn lead_of(own: &[Pt], dx: i32, dy: i32) -> Pt {
    own.iter()
        .copied()
        .reduce(|a, b| if a.0 * dx + a.1 * dy >= b.0 * dx + b.1 * dy { a } else { b })
        .expect("a piece has cells")
}

/// IMPACT, for whatever is standing there. A train stops; if what stopped it rolls this way, the
/// motion carries on into it, and into whatever THAT stops against. Every hand-off goes strictly
/// forward, so a cascade is a straight run on a finite board and cannot fail to end.
fn hand_off(next: &mut State, from: Pt, dx: i32, dy: i32) {
    let mut p = from;
    while next.in_grid(p.0, p.1) && rolls_here(next, p.0, p.1, dx, dy) {
        let c = *next.at(p.0, p.1);
        let own: Vec<Pt> = if is_multi_cell_o(c.o) { next.piece_cells(c.pid) } else { vec![p] };
        let blocked_at = |st: &State, j: i32| {
            own.iter().any(|&(x, y)| {
                let q = (x + j * dx, y + j * dy);
                !own.contains(&q) && !travels_into(st, q.0, q.1, dx, dy)
            })
        };
        let mut j = 0i32;
        while !blocked_at(next, j + 1) {
            j += 1;
            if own.iter().any(|&(x, y)| {
                let t = next.at(x + j * dx, y + j * dy);
                is_tar(t) || is_grate(t)
            }) {
                break;
            }
        }
        if j == 0 {
            break;
        }
        let was: Vec<(u8, u16)> = own.iter().map(|&(x, y)| (next.at(x, y).o, next.at(x, y).pid)).collect();
        for &(x, y) in &own {
            let t = next.at_mut(x, y);
            t.o = NONE;
            t.pid = NO_ID;
        }
        for (i, &(x, y)) in own.iter().enumerate() {
            let to = (x + j * dx, y + j * dy);
            if is_grate(next.at(to.0, to.1)) {
                continue;
            }
            let t = next.at_mut(to.0, to.1);
            t.o = was[i].0;
            t.pid = was[i].1;
        }
        // Ties keep the FIRST cell in raster order, which is what `reduce` does on the JS side.
        // A piece lying ACROSS the shove has every cell tied, and which one is called the lead
        // decides the cell the hand-off starts from — so the tie-break is a rule, not a detail.
        let lead = lead_of(&own, dx, dy);
        p = (lead.0 + (j + 1) * dx, lead.1 + (j + 1) * dy);
    }
}

/// Everything a magnet does, and it only ever does it on a shove — nothing on this board moves
/// unbidden. First the chain it already has follows or lets go, then it takes hold of whatever
/// is now in reach.
fn magnet_resolve(next: &mut State, mx: i32, my: i32, dx: i32, dy: i32) {
    let o = next.at(mx, my).o;
    let f = dir_of(magnet_face(o));
    let lk = next.at(mx, my).lk;

    if lk != NO_ID {
        let mut held: Vec<Pt> = link_cells(next, lk).into_iter().filter(|&p| p != (mx, my)).collect();

        // ACROSS the field, what is held keeps pace: it moves the way the magnet moved, or the
        // two simply come apart. ALONG the field there is nothing to keep pace with — the gap
        // closes instead, further down.
        if !held.is_empty() && (dx != 0 || dy != 0) && dx * f.0 + dy * f.1 == 0 {
            let (hx, hy) = held[0];
            let to = (hx + dx, hy + dy);
            if travels_into(next, to.0, to.1, dx, dy) {
                let was = *next.at(hx, hy);
                let c0 = next.at_mut(hx, hy);
                c0.o = NONE;
                c0.pid = NO_ID;
                c0.cart = NO_ID;
                c0.ck = CART;
                c0.lk = NO_ID;
                let c1 = next.at_mut(to.0, to.1);
                c1.o = was.o;
                c1.pid = was.pid;
                c1.cart = was.cart;
                c1.ck = was.ck;
                c1.lk = was.lk;
                held = vec![to];
            }
        }
        let on_line = !held.is_empty()
            && held.iter().all(|&(x, y)| {
                let k = (x - mx) * f.0 + (y - my) * f.1;
                k >= 1 && k <= MAGNET_REACH && x - mx == f.0 * k && y - my == f.1 * k
            });
        if !on_line {
            for (x, y) in link_cells(next, lk) {
                next.at_mut(x, y).lk = NO_ID;
            }
        } else {
            // It closes the gap by up to two, and stops when it is alongside.
            let (hx, hy) = held[0];
            let mut k = (hx - mx) * f.0 + (hy - my) * f.1;
            let mut moved = 0i32;
            while k > 1 && moved < 2 {
                let to = (hx - f.0 * (moved + 1), hy - f.1 * (moved + 1));
                if !travels_into(next, to.0, to.1, -f.0, -f.1) {
                    break;
                }
                moved += 1;
                k -= 1;
            }
            if moved > 0 {
                let was = *next.at(hx, hy);
                let c0 = next.at_mut(hx, hy);
                c0.o = NONE;
                c0.pid = NO_ID;
                c0.lk = NO_ID;
                let to = (hx - f.0 * moved, hy - f.1 * moved);
                let c1 = next.at_mut(to.0, to.1);
                c1.o = was.o;
                c1.pid = was.pid;
                c1.lk = was.lk;
            }
        }
    }

    // Capture. Walls stop the field; objects do not, so the first METAL along the line is taken
    // even with something standing in front of it — it simply closes as far as it can.
    if next.at(mx, my).lk != NO_ID {
        return;
    }
    for k in 1..=MAGNET_REACH {
        let p = (mx + f.0 * k, my + f.1 * k);
        if !next.in_grid(p.0, p.1) || next.at(p.0, p.1).wall {
            return;
        }
        let c = *next.at(p.0, p.1);
        if c.o == NONE && !c.is_cart() {
            continue;
        }
        if !is_metal(&c) {
            continue;
        }
        // One link per piece. A barrow already towing cannot also be captured — the second hold
        // would overwrite the first and leave what it was towing orphaned.
        if c.lk != NO_ID {
            return;
        }
        let mut moved = 0i32;
        while moved < k - 1 {
            let to = (p.0 - f.0 * (moved + 1), p.1 - f.1 * (moved + 1));
            if !travels_into(next, to.0, to.1, -f.0, -f.1) {
                break;
            }
            moved += 1;
        }
        let lk2 = free_link(next);
        if moved > 0 {
            let d = next.at_mut(p.0, p.1);
            d.o = NONE;
            d.pid = NO_ID;
            d.cart = NO_ID;
            d.ck = CART;
            let to = (p.0 - f.0 * moved, p.1 - f.1 * moved);
            let d = next.at_mut(to.0, to.1);
            d.o = c.o;
            d.pid = c.pid;
            d.cart = c.cart;
            d.ck = c.ck;
            d.lk = lk2;
        } else {
            next.at_mut(p.0, p.1).lk = lk2;
        }
        next.at_mut(mx, my).lk = lk2;
        return;
    }
}

/// The barrow has come to rest; if what stopped it is a piece too big to scoop, hook it.
fn hook_tow(next: &mut State, cid: u16, dx: i32, dy: i32) {
    let Some(&at) = next.cart_cells(cid).first() else { return };
    let ahead = (at.0 + dx, at.1 + dy);
    if !next.in_grid(ahead.0, ahead.1) {
        return;
    }
    let c = *next.at(ahead.0, ahead.1);
    if !is_multi_cell_o(c.o) || c.lk != NO_ID {
        return;
    }
    let lk = free_link(next);
    next.at_mut(at.0, at.1).lk = lk;
    for (x, y) in next.piece_cells(c.pid) {
        next.at_mut(x, y).lk = lk;
    }
}

/// A tow is rigid: barrow and load move together, or the shove is refused.
fn tow_move(s: &State, lk: u16, dx: i32, dy: i32) -> Outcome {
    let own = link_cells(s, lk);
    let blame: Vec<Pt> = own
        .iter()
        .map(|&(x, y)| (x + dx, y + dy))
        .filter(|q| !own.contains(q) && !travels_into(s, q.0, q.1, dx, dy))
        .collect();
    if !blame.is_empty() {
        return Outcome::No { reason: reason_for(s, &blame, "canRoom") };
    }
    let mut next = s.clone();
    let was: Vec<Cell> = own.iter().map(|&(x, y)| *s.at(x, y)).collect();
    for &(x, y) in &own {
        let c = next.at_mut(x, y);
        c.o = NONE;
        c.pid = NO_ID;
        c.cart = NO_ID;
        c.ck = CART;
        c.lk = NO_ID;
    }
    for (i, &(x, y)) in own.iter().enumerate() {
        let c = next.at_mut(x + dx, y + dy);
        c.o = was[i].o;
        c.pid = was[i].pid;
        c.cart = was[i].cart;
        c.ck = was[i].ck;
        c.lk = was[i].lk;
    }
    next.rac = (s.rac.0 + dx, s.rac.1 + dy);
    Outcome::Ok { kind: Kind::Push, next }
}

/// An open cabinet shoved anywhere but shut: body and drawer move together, one cell.
fn shove_cabinet(s: &State, body: Pt, draw: Pt, dx: i32, dy: i32) -> Outcome {
    let pair = [body, draw];
    let blame: Vec<Pt> = pair
        .iter()
        .map(|&(x, y)| (x + dx, y + dy))
        .filter(|q| !pair.contains(q) && !travels_into(s, q.0, q.1, dx, dy))
        .collect();
    if !blame.is_empty() {
        return Outcome::No { reason: reason_for(s, &blame, "canRoom") };
    }
    let mut next = s.clone();
    let was: Vec<u8> = pair.iter().map(|&(x, y)| s.at(x, y).o).collect();
    for &(x, y) in &pair {
        next.at_mut(x, y).o = NONE;
    }
    for (i, &(x, y)) in pair.iter().enumerate() {
        next.at_mut(x + dx, y + dy).o = was[i];
    }
    next.rac = (s.rac.0 + dx, s.rac.1 + dy);
    Outcome::Ok { kind: Kind::Push, next }
}

/// The body a drawer belongs to: the one neighbour whose facing points at it.
fn body_of_drawer(s: &State, at: Pt) -> Option<Pt> {
    for d in DIR_ORDER {
        let f = dir_of(d);
        let b = (at.0 - f.0, at.1 - f.1);
        if !s.in_grid(b.0, b.1) {
            continue;
        }
        let c = s.at(b.0, b.1);
        if is_cabinet_open(c.o) && cabinet_face(c.o) == d {
            return Some(b);
        }
    }
    None
}

fn drawer_of(s: &State, at: Pt) -> Pt {
    let f = dir_of(cabinet_face(s.at(at.0, at.1).o));
    (at.0 + f.0, at.1 + f.1)
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
    let no = |reason| Ok(Outcome::No { reason });
    let (x, y) = s.rac;
    let (tx, ty) = (x + dx, y + dy);

    if !s.in_grid(tx, ty) {
        return no("edge");
    }
    let target = *s.at(tx, ty);
    if target.wall {
        return no("wall");
    }
    if target.water && !is_roller(&target) {
        return no("water");
    }

    // Three gates ahead of every branch, so none of them can forget one. He may not stand on
    // broken glass, which also means he cannot shove what is standing on it; a one-way admits
    // only its own direction; and tar keeps what it has.
    if is_glass(&target) {
        return no("glass");
    }
    if !may_enter(s, tx, ty, dx, dy) {
        return no("oneway");
    }
    if (target.o != NONE || target.is_cart()) && stuck_in_tar(s, tx, ty) {
        return no("tar");
    }

    // A cart cell carries its cargo in `o`, so cart-ness is read before the occupant is.
    if target.is_cart() {
        let kind = target.ck;
        // Across its axis a barrow tips: it goes one cell and its load carries on one further,
        // which is the recycle bin's shape exactly — the dump is a shed, not a new mechanic.
        if is_barrow(kind) && !barrow_rolls_along(kind, dx, dy) {
            let to = (tx + dx, ty + dy);
            let out = (to.0 + dx, to.1 + dy);
            let load = target.o;
            if !travels_into(s, to.0, to.1, dx, dy) {
                return no(reason_for(s, &[to], "canRoom"));
            }
            if load != NONE && !travels_into(s, out.0, out.1, dx, dy) {
                return no(reason_for(s, &[out], "canRoom"));
            }
            if load != NONE && !tip_fits(s, load, out, dx, dy) {
                let t = tips_into(load, out, dx, dy).expect("load sheds");
                return no(reason_for(s, &[t], "canRoom"));
            }
            let mut next = s.clone();
            // Tipping lets go of whatever it was towing: the barrow turns out from under it.
            if target.lk != NO_ID {
                for (lx, ly) in link_cells(&next, target.lk) {
                    next.at_mut(lx, ly).lk = NO_ID;
                }
            }
            let c = next.at_mut(tx, ty);
            c.cart = NO_ID;
            c.ck = CART;
            c.o = NONE;
            let landed = next.at_mut(to.0, to.1);
            landed.cart = target.cart;
            landed.ck = kind;
            landed.o = NONE;
            if load != NONE {
                drop_o(next.at_mut(out.0, out.1), load);
                tip_out(&mut next, load, out, dx, dy);
            }
            next.rac = if is_clear_floor(&next, tx, ty) { (tx, ty) } else { s.rac };
            return Ok(Outcome::Ok { kind: Kind::Push, next });
        }
        // Already towing: the pair is rigid, so it moves as one thing or not at all.
        if target.lk != NO_ID {
            return Ok(tow_move(s, target.lk, dx, dy));
        }
        // Shoved straight at something too big to scoop, the barrow hooks on rather than
        // refusing. The shove is spent taking hold, which is the same beat a scoop costs.
        if is_barrow(kind) {
            let ahead = (tx + dx, ty + dy);
            if s.in_grid(ahead.0, ahead.1)
                && is_multi_cell_o(s.at(ahead.0, ahead.1).o)
                && s.at(ahead.0, ahead.1).lk == NO_ID
            {
                let mut next = s.clone();
                let lk = free_link(&next);
                next.at_mut(tx, ty).lk = lk;
                let pid = next.at(ahead.0, ahead.1).pid;
                for (px, py) in next.piece_cells(pid) {
                    next.at_mut(px, py).lk = lk;
                }
                return Ok(Outcome::Ok { kind: Kind::Push, next });
            }
        }
        let res = shove_cart(s, target.cart, (tx, ty), dx, dy);
        // A barrow that rolls up against something too big to scoop HOOKS it instead. One cell
        // cannot swallow a couch, and the barrow is the handle rather than the container.
        if let Outcome::Ok { kind: k, mut next } = res {
            if is_barrow(kind) {
                hook_tow(&mut next, target.cart, dx, dy);
            }
            return Ok(Outcome::Ok { kind: k, next });
        }
        return Ok(res);
    }

    let o = target.o;

    if o == NONE {
        // Only the raccoon moves, and he rides on `rac` — so the board this lands on IS the
        // board it started from, and the new state shares it.
        let mut next = s.clone();
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Move, next });
    }

    if o == TRASH {
        return no("trash");
    }

    if o == BAG {
        let blockers = fan_blockers(s, tx, ty, dx, dy);
        if !blockers.is_empty() {
            return no(reason_for(s, &blockers, "fan"));
        }
        let mut next = s.clone();
        // Chairs clear out before anything is laid down, so the trash lands on the cells they
        // left. This is the whole of what the chair changes: the fan stops being only a cost
        // and becomes something you can aim.
        for (fx, fy) in fan(tx, ty, dx, dy) {
            if !s.in_grid(fx, fy) || s.at(fx, fy).o != CHAIR {
                continue;
            }
            let to = chair_flees(s, tx, ty, dx, dy, fx, fy).expect("the fan passed");
            next.at_mut(fx, fy).o = NONE;
            if !is_grate(next.at(to.0, to.1)) {
                next.at_mut(to.0, to.1).o = CHAIR;
            }
        }
        for (fx, fy) in fan(tx, ty, dx, dy) {
            lay_trash(next.at_mut(fx, fy));
        }
        next.at_mut(tx, ty).o = NONE;
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Tear, next });
    }

    // A pane goes where a shove sends it only in the sense that it BREAKS there. It needs the
    // cell beyond free to break into — so it is protected by being boxed in, and broken by being
    // given room, which is the opposite of every other piece on the board.
    if o == PANE {
        let c1 = (tx + dx, ty + dy);
        if !is_occupiable(s, c1.0, c1.1) || !may_enter(s, c1.0, c1.1, dx, dy) || s.at(c1.0, c1.1).water
        {
            return no(reason_for(s, &[c1], "canRoom"));
        }
        let mut next = s.clone();
        next.at_mut(tx, ty).o = NONE;
        if !is_grate(next.at(c1.0, c1.1)) {
            next.at_mut(c1.0, c1.1).ter = GLASS;
        }
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    // Shoved from the far side, anything held drags its holder along behind it — a towed couch
    // takes its barrow, a chained can takes its magnet. That is the board pulling, not the
    // raccoon. The magnet itself is exempt: a shove on IT is an ordinary shove.
    if target.lk != NO_ID && !is_magnet(o) {
        return Ok(tow_move(s, target.lk, dx, dy));
    }

    if is_multi_cell_o(o) {
        let own = s.piece_cells(target.pid);
        let clear_at = |k: i32| -> Vec<Pt> {
            own.iter()
                .map(|&(ox, oy)| (ox + k * dx, oy + k * dy))
                .filter(|q| !own.contains(q) && !travels_into(s, q.0, q.1, dx, dy))
                .collect()
        };
        let blame = clear_at(1);
        if !blame.is_empty() {
            return no(reason_for(s, &blame, "canRoom"));
        }

        // Shoved along its length a rug rolls; shoved broadside it shifts one cell, like the
        // couch it otherwise is. Nothing stores the axis — it is whatever the footprint says.
        let mut k = 1i32;
        if rolls_longways(o) && long_axis_is_x(&own) == (dx != 0) {
            while clear_at(k + 1).is_empty() {
                k += 1;
                if own.iter().any(|&(ox, oy)| {
                    let c = s.at(ox + k * dx, oy + k * dy);
                    is_tar(c) || is_grate(c)
                }) {
                    break;
                }
            }
        }

        let mut next = s.clone();
        for &(ox, oy) in &own {
            let c = next.at_mut(ox, oy);
            c.o = NONE;
            c.pid = NO_ID;
        }
        // A grate takes the piece only when the whole of it fits inside one; a longer thing
        // spans it.
        let landed: Vec<Pt> = own.iter().map(|&(ox, oy)| (ox + k * dx, oy + k * dy)).collect();
        let swallowed = landed.iter().all(|&(lx, ly)| is_grate(next.at(lx, ly)));
        if !swallowed {
            for &(lx, ly) in &landed {
                let c = next.at_mut(lx, ly);
                c.o = o;
                c.pid = target.pid;
            }
        }
        // The same hand-off every roller gets: a rug that reaches a bicycle lying the same way
        // sets it going, and one lying across it is simply what the rug stops against.
        if rolls_longways(o) {
            let lead = lead_of(&own, dx, dy);
            hand_off(&mut next, (lead.0 + (k + 1) * dx, lead.1 + (k + 1) * dy), dx, dy);
        }
        next.rac = if is_clear_floor(&next, tx, ty) { (tx, ty) } else { s.rac };
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    if rolls_along(&target, dx, dy) {
        // Rollers already touching are one thing to shove, so the unit that moves is the whole
        // contiguous run — which also makes the run maximal, and that is what gives IMPACT a
        // meaning: the cell ahead of a maximal train never holds a roller until travel closes
        // a gap.
        let mut train: Vec<Pt> = Vec::new();
        let (mut px, mut py) = (tx, ty);
        while s.in_grid(px, py) && rolls_along(s.at(px, py), dx, dy) {
            train.push((px, py));
            px += dx;
            py += dy;
        }
        let lead = *train.last().expect("the target rolls");

        let mut k = 0i32;
        while travels_into(s, lead.0 + (k + 1) * dx, lead.1 + (k + 1) * dy, dx, dy) {
            k += 1;
            let c = s.at(lead.0 + k * dx, lead.1 + k * dy);
            if is_tar(c) || is_grate(c) {
                break; // entered, and then held or fallen through
            }
        }
        if k == 0 {
            let stop = [(lead.0 + dx, lead.1 + dy)];
            return no(reason_for(s, &stop, "canRoom"));
        }

        // The rearmost is the only one with a free cell behind it — every other has its
        // neighbour there — so it is the only one that can shed.
        let rear = train[0];
        let rear_is_wheelie = s.at(rear.0, rear.1).o == WHEELIE;
        let back = rear_is_wheelie.then(|| (rear.0 + (k - 1) * dx, rear.1 + (k - 1) * dy));

        let mut next = s.clone();
        for &(cx, cy) in &train {
            next.at_mut(cx, cy).o = NONE;
        }
        let mut swallowed = 0usize;
        for &(cx, cy) in &train {
            let to = (cx + k * dx, cy + k * dy);
            if is_grate(next.at(to.0, to.1)) {
                swallowed += 1;
                continue;
            }
            next.at_mut(to.0, to.1).o = s.at(cx, cy).o;
        }
        // Tested against the rolled board: on a one-cell roll this cell is the bin's own start.
        if let Some(b) = back {
            if swallowed == 0 && !is_occupiable(&next, b.0, b.1) {
                return no(reason_for(s, &[b], "canRoom"));
            }
        }
        if let Some(b) = back {
            if swallowed == 0 {
                next.at_mut(rear.0 + k * dx, rear.1 + k * dy).o = WHEELIE_EMPTY;
                drop_o(next.at_mut(b.0, b.1), BAG);
            }
        }

        hand_off(&mut next, (lead.0 + (k + 1) * dx, lead.1 + (k + 1) * dy), dx, dy);
        next.rac = if is_clear_floor(&next, tx, ty) { (tx, ty) } else { s.rac };
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    // A closed cabinet moves, and the same shove slides its drawer out. The drawer opening is
    // itself a PUSH — it shoves whatever is in the way one further cell — which is what makes
    // the cabinet a second aimed action: you shove north, and something goes east.
    if is_cabinet_closed(o) {
        let f = dir_of(cabinet_face(o));
        let body = (tx + dx, ty + dy);
        let draw = (body.0 + f.0, body.1 + f.1);
        if !travels_into(s, body.0, body.1, dx, dy) {
            return no(reason_for(s, &[body], "canRoom"));
        }
        // It cannot open onto the cell he is standing in, and he is the one occupant
        // `is_occupiable` cannot see.
        if draw == (tx, ty) {
            return no("canRoom");
        }
        let mut next = s.clone();
        if !travels_into(&next, draw.0, draw.1, f.0, f.1) {
            let past = (draw.0 + f.0, draw.1 + f.1);
            let in_way = next.in_grid(draw.0, draw.1).then(|| *next.at(draw.0, draw.1));
            let refuse = match in_way {
                None => true,
                Some(c) => {
                    c.o == NONE
                        || c.is_cart()
                        || is_multi_cell_o(c.o)
                        || !travels_into(&next, past.0, past.1, f.0, f.1)
                }
            };
            if refuse {
                return no(reason_for(s, &[draw], "canRoom"));
            }
            let shoved = in_way.expect("checked").o;
            next.at_mut(draw.0, draw.1).o = NONE;
            drop_o(next.at_mut(past.0, past.1), shoved);
        }
        next.at_mut(tx, ty).o = NONE;
        next.at_mut(body.0, body.1).o = cab_opens(o);
        next.at_mut(draw.0, draw.1).o = DRAWER;
        next.rac = (tx, ty);
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    // Shoved on the drawer toward the body, the shove is spent closing it: the cabinet does not
    // move, and the next shove moves the whole thing.
    if o == DRAWER {
        let body = body_of_drawer(s, (tx, ty))
            .ok_or_else(|| format!("a drawer at {tx},{ty} with no cabinet behind it"))?;
        let f = dir_of(cabinet_face(s.at(body.0, body.1).o));
        if (dx, dy) == (-f.0, -f.1) {
            let mut next = s.clone();
            next.at_mut(tx, ty).o = NONE;
            next.at_mut(body.0, body.1).o = cab_shuts(s.at(body.0, body.1).o);
            next.rac = (tx, ty);
            return Ok(Outcome::Ok { kind: Kind::Push, next });
        }
        return Ok(shove_cabinet(s, body, (tx, ty), dx, dy));
    }

    if is_cabinet_open(o) {
        return Ok(shove_cabinet(s, (tx, ty), drawer_of(s, (tx, ty)), dx, dy));
    }

    // The broom takes the whole contiguous line ahead of it, of any kinds, one cell — and on
    // grease it takes the line the length of the slick. It is the ONLY thing that moves a bag
    // without bursting it, which is what gives broken glass anything to do.
    if o == BROOM {
        let mut line: Vec<Pt> = Vec::new();
        let (mut px, mut py) = (tx, ty);
        while s.in_grid(px, py)
            && s.at(px, py).o != NONE
            && !s.at(px, py).is_cart()
            && !is_multi_cell_o(s.at(px, py).o)
        {
            line.push((px, py));
            px += dx;
            py += dy;
        }
        let head = *line.last().expect("the broom is on the line");
        let beyond = (head.0 + dx, head.1 + dy);
        if !travels_into(s, beyond.0, beyond.1, dx, dy) {
            return no(reason_for(s, &[beyond], "canRoom"));
        }
        if line.iter().any(|&(lx, ly)| stuck_in_tar(s, lx, ly)) {
            return no("tar");
        }

        // How far the line goes. Off grease that is one cell; on it, the broom carries the
        // whole train to the end of the slick.
        let mut k = 1i32;
        while is_grease(s.at(tx + k * dx, ty + k * dy))
            && travels_into(s, head.0 + (k + 1) * dx, head.1 + (k + 1) * dy, dx, dy)
        {
            k += 1;
            let c = s.at(head.0 + k * dx, head.1 + k * dy);
            if is_tar(c) || is_grate(c) {
                break;
            }
        }

        // A bag anywhere but the head refuses to be swept onto glass: it would tear with the
        // rest of the line packed round it, and there is nowhere for a fan to go.
        for (i, &(lx, ly)) in line.iter().enumerate() {
            if s.at(lx, ly).o != BAG || i == line.len() - 1 {
                continue;
            }
            let to = (lx + k * dx, ly + k * dy);
            if is_glass(s.at(to.0, to.1)) {
                return no("glass");
            }
        }

        let mut next = s.clone();
        for &(lx, ly) in &line {
            let c = next.at_mut(lx, ly);
            c.o = NONE;
            c.lk = NO_ID;
        }
        for &(lx, ly) in line.iter().rev() {
            let to = (lx + k * dx, ly + k * dy);
            let what = s.at(lx, ly).o;
            if is_grate(next.at(to.0, to.1)) {
                continue;
            }
            // A bag swept onto glass bursts where it lands, which only the head of a line can do.
            if what == BAG && is_glass(next.at(to.0, to.1)) {
                for (fx, fy) in fan(to.0, to.1, dx, dy) {
                    if !is_occupiable(&next, fx, fy) {
                        continue;
                    }
                    lay_trash(next.at_mut(fx, fy));
                }
                continue;
            }
            // Everything the cell was carrying travels with it, not just the occupant code. A
            // link left behind belongs to whatever is standing there now, which is a different
            // board.
            let lk = s.at(lx, ly).lk;
            let c = next.at_mut(to.0, to.1);
            c.o = what;
            c.lk = lk;
        }
        // Only the head has a free cell beyond it; every other has its neighbour there, so the
        // shed rule needs no statement of its own.
        let head_to = (head.0 + k * dx, head.1 + k * dy);
        let head_was = s.at(head.0, head.1).o;
        if sheds(head_was).is_some()
            && next.at(head_to.0, head_to.1).o == head_was
            && tip_fits(&next, head_was, head_to, dx, dy)
        {
            tip_out(&mut next, head_was, head_to, dx, dy);
        }
        next.rac = if is_clear_floor(&next, tx, ty) { (tx, ty) } else { s.rac };
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    // One shape of shove for everything in the slide table, so the clearance test lives in one
    // place.
    if let Some(t) = slides_of(o) {
        let c1 = (tx + dx, ty + dy);
        let into = cart_at(s, c1);
        let mut blame: Vec<Pt> = Vec::new();
        if !can_rest(s, c1.0, c1.1) || !may_enter(s, c1.0, c1.1, dx, dy) {
            blame.push(c1);
        }

        // Where it actually stops. Off grease that is the cell it was shoved to; on grease it
        // keeps going, and every bill — the tip, the cart it lands in, the grate that takes it —
        // is settled where it comes to rest rather than where it was pushed.
        let mut at = c1;
        if into.is_none() && blame.is_empty() && !t.soaks {
            while is_grease(s.at(at.0, at.1)) && travels_into(s, at.0 + dx, at.1 + dy, dx, dy) {
                at = (at.0 + dx, at.1 + dy);
                if is_tar(s.at(at.0, at.1)) || is_grate(s.at(at.0, at.1)) {
                    break;
                }
            }
        }
        let gone = into.is_none() && blame.is_empty() && is_grate(s.at(at.0, at.1));
        let c2 = (at.0 + dx, at.1 + dy);
        let tips = into.is_none() && !gone && (t.drops.is_some() || t.pours);

        if tips && !tip_fits(s, o, at, dx, dy) {
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
            return no(reason_for(s, &blame, "canRoom"));
        }
        let lands = if tips { t.slides } else { o };
        let mut next = s.clone();
        if tips {
            match t.drops {
                None => pour(next.at_mut(c2.0, c2.1)),
                Some(drops) => drop_o(next.at_mut(c2.0, c2.1), drops),
            }
        }
        match &shove {
            Some(sh) => apply_into_cart(s, &mut next, sh, lands),
            None if t.soaks => {
                soak(next.at_mut(at.0, at.1));
                drop_o(next.at_mut(at.0, at.1), lands);
            }
            // Spent making the cell walkable. It still MOVES — the sheet slides onto the hazard
            // and goes down with it.
            None if t.covers && cover(next.at_mut(at.0, at.1)) => {}
            None => drop_o(next.at_mut(at.0, at.1), lands),
        }
        let lk = next.at(tx, ty).lk;
        next.at_mut(tx, ty).o = NONE;
        next.at_mut(tx, ty).lk = NO_ID;
        // The magnet is an ordinary slider; what it does happens after it lands, and it lands
        // wherever the dispatch above put it — a cart slot is a place to land like any other.
        // Asking the board where it ended up is also how a grate that took it on the way says
        // so: there is then no field to resolve, and nothing holds what it was holding.
        if is_magnet(o) {
            let rest = match &shove {
                Some(sh) => sh.file[0],
                None => at,
            };
            if next.at(rest.0, rest.1).o == o {
                next.at_mut(rest.0, rest.1).lk = lk;
                magnet_resolve(&mut next, rest.0, rest.1, dx, dy);
            } else if lk != NO_ID {
                for (lx, ly) in link_cells(&next, lk) {
                    next.at_mut(lx, ly).lk = NO_ID;
                }
            }
        }
        next.rac = if is_clear_floor(&next, tx, ty) { (tx, ty) } else { s.rac };
        return Ok(Outcome::Ok { kind: Kind::Push, next });
    }

    Err(format!("unknown occupant {o} at {tx},{ty}"))
}
