//! The board: occupant codes, reading a room in, writing one back out.
//!
//! `src/format.js` is what this answers to. It is not a translation of that file — the writer
//! there emits a whole `.tt` pack and reads directives; this only ever sees the three blocks the
//! conformance protocol carries. What must match exactly is the serialisation, because two
//! spellings of one board fail a comparison that is about the rules.

pub const NONE: u8 = 0;
pub const BAG: u8 = 1;
pub const CAN_FULL: u8 = 2;
pub const CAN_EMPTY: u8 = 3;
pub const TRASH: u8 = 4;
pub const BIN: u8 = 5;
pub const STACK: u8 = 6;
pub const WHEELIE: u8 = 7;
pub const WHEELIE_EMPTY: u8 = 8;
pub const JUG: u8 = 9;
pub const FURNITURE: u8 = 10;
pub const BIN_EMPTY: u8 = 11;
pub const JUG_EMPTY: u8 = 12;
pub const SPONGE: u8 = 13;
pub const CARDBOARD: u8 = 14;
pub const PANE: u8 = 15;
pub const TIRE_H: u8 = 16;
pub const TIRE_V: u8 = 17;
pub const BICYCLE: u8 = 18;
pub const RUG: u8 = 19;
pub const CHAIR: u8 = 20;
pub const BROOM: u8 = 21;
pub const CABC_U: u8 = 22;
pub const CABC_D: u8 = 23;
pub const CABC_L: u8 = 24;
pub const CABC_R: u8 = 25;
pub const CABO_U: u8 = 26;
pub const CABO_D: u8 = 27;
pub const CABO_L: u8 = 28;
pub const CABO_R: u8 = 29;
pub const DRAWER: u8 = 30;
pub const MAG_U: u8 = 31;
pub const MAG_D: u8 = 32;
pub const MAG_L: u8 = 33;
pub const MAG_R: u8 = 34;

/// Terrain, as `terrainOf` reads it: the MUTABLE lanes, and the two that a cell carries as
/// flags of their own. `TERRAINS` is the radix the key packs a cell with, so it is the count of
/// mutable values and not of lanes.
pub const DRY: u8 = 0;
pub const WATER: u8 = 1;
pub const BRIDGE: u8 = 2;
pub const GREASE: u8 = 3;
pub const TAR: u8 = 4;
pub const GLASS: u8 = 5;
pub const COVERED: u8 = 6;
pub const TERRAINS: u16 = 7;

pub const CART: u8 = 0;
pub const BARROW_H: u8 = 1;
pub const BARROW_V: u8 = 2;
pub const CART_KINDS: u16 = 4;

pub const NO_DIR: u8 = 0;

/// `pid`/`cart` are ids, and most cells have neither. A sentinel keeps `Cell` `Copy` and keeps
/// the absent case one comparison rather than a branch on an `Option` in every predicate.
pub const NO_ID: u16 = u16::MAX;

use std::rc::Rc;

pub const FURN_POOL: &[u8] = b"FGHKMN";
pub const CART_POOL: &[u8] = b"PQR";

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Cell {
    pub wall: bool,
    pub exit: bool,
    pub water: bool,
    pub bridge: bool,
    /// A STATIC lane, and out of the key for the reason `wall` is: it cannot differ between two
    /// states of one room.
    pub grate: bool,
    /// The other static lane. `NO_DIR`, or the direction byte it admits.
    pub oneway: u8,
    /// The mutable lanes past water and bridge, one exclusive value.
    pub ter: u8,
    pub o: u8,
    /// Which KIND of cart this cell belongs to. Beside the label in the key rather than in the
    /// cell's own byte, because it is a property of the cart and not of the cell.
    pub ck: u8,
    pub pid: u16,
    pub cart: u16,
    /// What this cell is hooked to. One link per piece, and the tow and the magnet's chain
    /// share the lane — they differ in behaviour, not in how they are recorded.
    pub lk: u16,
}

impl Cell {
    pub const FLOOR: Cell = Cell {
        wall: false,
        exit: false,
        water: false,
        bridge: false,
        grate: false,
        oneway: NO_DIR,
        ter: DRY,
        o: NONE,
        ck: CART,
        pid: NO_ID,
        cart: NO_ID,
        lk: NO_ID,
    };
    pub fn is_cart(&self) -> bool {
        self.cart != NO_ID
    }
    /// What `terrainOf` answers: the flags win over the `ter` lane, in that order.
    pub fn terrain(&self) -> u8 {
        if self.water {
            WATER
        } else if self.bridge {
            BRIDGE
        } else {
            self.ter
        }
    }
}

/// `cells` is shared, not owned. Cloning a State is a refcount bump, and the copy is made only
/// where something writes — `at_mut` is the one door in. That is what lets a plain move hand
/// back the board it started from instead of a copy of it: walking is most of what a state graph
/// is made of, and copying a cell per cell for a step that changes no cell was the JS engine's
/// largest single cost in allocation and then again in collection.
#[derive(Clone)]
pub struct State {
    pub cols: i32,
    pub rows: i32,
    pub cells: Rc<Vec<Cell>>,
    pub rac: (i32, i32),
}

impl State {
    #[inline]
    pub fn in_grid(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && x < self.cols && y < self.rows
    }
    #[inline]
    pub fn idx(&self, x: i32, y: i32) -> usize {
        (y * self.cols + x) as usize
    }
    #[inline]
    pub fn at(&self, x: i32, y: i32) -> &Cell {
        &self.cells[self.idx(x, y)]
    }
    /// The only way to write a cell, and therefore the only place a shared board is copied.
    #[inline]
    pub fn at_mut(&mut self, x: i32, y: i32) -> &mut Cell {
        let i = (y * self.cols + x) as usize;
        &mut Rc::make_mut(&mut self.cells)[i]
    }
    /// Cells of one multi-cell piece, raster order. Boards are tiny, so this scans rather than
    /// keeping an index — the same trade `pieceCells` makes.
    pub fn piece_cells(&self, pid: u16) -> Vec<(i32, i32)> {
        self.ids(|c| c.pid, pid)
    }
    pub fn cart_cells(&self, cid: u16) -> Vec<(i32, i32)> {
        self.ids(|c| c.cart, cid)
    }
    fn ids(&self, of: fn(&Cell) -> u16, want: u16) -> Vec<(i32, i32)> {
        let mut out = Vec::new();
        for y in 0..self.rows {
            for x in 0..self.cols {
                if of(self.at(x, y)) == want {
                    out.push((x, y));
                }
            }
        }
        out
    }
}

// ---------------------------------------------------------------- reading

fn read_glyph(ch: u8) -> Option<(Cell, bool)> {
    let mut c = Cell::FLOOR;
    let mut rac = false;
    match ch {
        b'#' => c.wall = true,
        b'-' | b' ' | b'.' => {}
        b'@' => rac = true,
        b'$' => c.o = BAG,
        b'C' => c.o = CAN_FULL,
        b'c' => c.o = CAN_EMPTY,
        b'x' => c.o = TRASH,
        b'S' => c.o = STACK,
        b'W' => c.o = WHEELIE,
        b'w' => c.o = WHEELIE_EMPTY,
        b'B' => c.o = BIN,
        b'b' => c.o = BIN_EMPTY,
        b'j' => c.o = JUG,
        b'i' => c.o = JUG_EMPTY,
        b'E' => c.exit = true,
        b'+' => {
            c.exit = true;
            rac = true;
        }
        _ if FURN_POOL.contains(&ch) => c.o = FURNITURE,
        _ => return None,
    }
    Some((c, rac))
}

/// A 4-connected run of the SAME mark is one piece; ids go out in raster order of each piece's
/// first cell, which is what makes the writer reproduce the lettering it was given.
fn label_blobs(
    cells: &mut [Cell],
    marks: &[u8],
    cols: i32,
    rows: i32,
    field: fn(&mut Cell) -> &mut u16,
    what: &str,
    wrong_size: impl Fn(usize) -> Option<String>,
) -> Result<(), String> {
    let mut next: u16 = 0;
    for y in 0..rows {
        for x in 0..cols {
            let i = (y * cols + x) as usize;
            if marks[i] == 0 || *field(&mut cells[i]) != NO_ID {
                continue;
            }
            let (pid, ch) = (next, marks[i]);
            next += 1;
            let mut stack = vec![(x, y)];
            let mut size = 0usize;
            while let Some((cx, cy)) = stack.pop() {
                if cx < 0 || cy < 0 || cx >= cols || cy >= rows {
                    continue;
                }
                let j = (cy * cols + cx) as usize;
                if marks[j] != ch || *field(&mut cells[j]) != NO_ID {
                    continue;
                }
                *field(&mut cells[j]) = pid;
                size += 1;
                stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)]);
            }
            if let Some(bad) = wrong_size(size) {
                return Err(format!(
                    "{what} '{}' at ({},{}) {bad}",
                    ch as char,
                    x + 1,
                    y + 1
                ));
            }
        }
    }
    Ok(())
}

/// Byte `x` of row `y`, or floor — short rows pad, exactly as the reader does.
fn byte_at(rows: &[String], y: i32, x: i32) -> u8 {
    rows.get(y as usize)
        .and_then(|r| r.as_bytes().get(x as usize))
        .copied()
        .unwrap_or(b'-')
}

pub fn to_state(
    grid: &[String],
    cart: Option<&Vec<String>>,
    water: Option<&Vec<String>>,
) -> Result<State, String> {
    let rows = grid.len() as i32;
    if rows == 0 {
        return Err("empty :grid".into());
    }
    let cols = grid.iter().map(|r| r.len()).max().unwrap_or(0) as i32;

    let mut cells = Vec::with_capacity((rows * cols) as usize);
    let mut furn_marks = Vec::with_capacity((rows * cols) as usize);
    let mut rac: Option<(i32, i32)> = None;
    let mut exits = 0;

    for y in 0..rows {
        for x in 0..cols {
            let ch = byte_at(grid, y, x);
            let (c, is_rac) = read_glyph(ch)
                .ok_or_else(|| format!("unknown glyph {:?} at ({},{})", ch as char, x + 1, y + 1))?;
            if is_rac {
                if rac.is_some() {
                    return Err("more than one raccoon".into());
                }
                rac = Some((x, y));
            }
            if c.exit {
                exits += 1;
            }
            // Which letter wrote this cell, so two flush couches stay two couches.
            furn_marks.push(if c.o == FURNITURE { ch } else { 0 });
            cells.push(c);
        }
    }
    let rac = rac.ok_or("no raccoon")?;
    if exits != 1 {
        return Err(format!("needs exactly one exit, found {exits}"));
    }
    label_blobs(
        &mut cells,
        &furn_marks,
        cols,
        rows,
        |c| &mut c.pid,
        "furniture",
        |n| (n < 2).then(|| "is a single cell; use a can, or give it a second cell".to_string()),
    )?;

    if let Some(water) = water {
        if water.len() as i32 > rows {
            return Err(format!(
                ":water has {} rows, :grid has {rows}",
                water.len()
            ));
        }
        for y in 0..rows {
            for x in 0..cols {
                let ch = byte_at(water, y, x);
                let wet = ch == b'~';
                if !wet && ch != b'=' {
                    if !matches!(ch, b'-' | b' ' | b'.') {
                        return Err(format!(
                            ":water takes '~', '=' or floor, got {:?} at ({},{})",
                            ch as char,
                            x + 1,
                            y + 1
                        ));
                    }
                    continue;
                }
                let c = &mut cells[(y * cols + x) as usize];
                if c.wall {
                    return Err(format!("({},{}) is both wall and water", x + 1, y + 1));
                }
                if c.exit {
                    return Err(format!("the exit cannot be water at ({},{})", x + 1, y + 1));
                }
                if wet {
                    c.water = true;
                } else {
                    c.bridge = true;
                }
            }
        }
        if cells[(rac.1 * cols + rac.0) as usize].water {
            return Err(format!(
                "the raccoon starts in open water at ({},{})",
                rac.0 + 1,
                rac.1 + 1
            ));
        }
    }

    if let Some(cart) = cart {
        if cart.len() as i32 > rows {
            return Err(format!(":cart has {} rows, :grid has {rows}", cart.len()));
        }
        let mut marks = vec![0u8; (rows * cols) as usize];
        for y in 0..rows {
            for x in 0..cols {
                let ch = byte_at(cart, y, x);
                if matches!(ch, b'-' | b' ' | b'.') {
                    continue;
                }
                if !CART_POOL.contains(&ch) {
                    return Err(format!(
                        ":cart takes PQR or floor, got {:?} at ({},{})",
                        ch as char,
                        x + 1,
                        y + 1
                    ));
                }
                let c = &cells[(y * cols + x) as usize];
                if c.wall {
                    return Err(format!("({},{}) is both wall and cart", x + 1, y + 1));
                }
                if c.exit {
                    return Err(format!(
                        "the exit cannot hold a cart at ({},{})",
                        x + 1,
                        y + 1
                    ));
                }
                if c.o == FURNITURE {
                    return Err(format!(
                        "a cart cannot hold furniture at ({},{})",
                        x + 1,
                        y + 1
                    ));
                }
                if rac == (x, y) {
                    return Err(format!(
                        "the raccoon cannot start in a cart at ({},{})",
                        x + 1,
                        y + 1
                    ));
                }
                marks[(y * cols + x) as usize] = ch;
            }
        }
        label_blobs(&mut cells, &marks, cols, rows, |c| &mut c.cart, "cart", |n| {
            (n != 2).then(|| {
                format!("covers {n} cell{}; a cart is exactly two", if n == 1 { "" } else { "s" })
            })
        })?;
    }

    Ok(State { cols, rows, cells: Rc::new(cells), rac })
}

// ---------------------------------------------------------------- writing

/// Letters handed out by first appearance in raster order, so a board's lettering is canonical.
fn pool_letters(s: &State, of: fn(&Cell) -> u16, pool: &[u8], what: &str) -> Result<Vec<(u16, u8)>, String> {
    let mut out: Vec<(u16, u8)> = Vec::new();
    for cell in s.cells.iter() {
        let id = of(cell);
        if id == NO_ID || out.iter().any(|(k, _)| *k == id) {
            continue;
        }
        if out.len() >= pool.len() {
            return Err(format!(
                "more than {} {what}: the glyph pool is {}",
                pool.len(),
                String::from_utf8_lossy(pool)
            ));
        }
        out.push((id, pool[out.len()]));
    }
    Ok(out)
}

fn letter_of(table: &[(u16, u8)], id: u16) -> u8 {
    table.iter().find(|(k, _)| *k == id).map(|(_, v)| *v).unwrap_or(b'?')
}

pub fn to_grid(s: &State) -> Result<Vec<String>, String> {
    let letters = pool_letters(s, |c| c.pid, FURN_POOL, "furniture pieces")?;
    let mut out = Vec::with_capacity(s.rows as usize);
    for y in 0..s.rows {
        let mut row = Vec::with_capacity(s.cols as usize);
        for x in 0..s.cols {
            let c = s.at(x, y);
            let is_rac = s.rac == (x, y);
            row.push(if c.wall {
                b'#'
            } else if !c.exit {
                if is_rac {
                    b'@'
                } else if c.o == FURNITURE {
                    letter_of(&letters, c.pid)
                } else {
                    match c.o {
                        NONE => b'-',
                        BAG => b'$',
                        CAN_FULL => b'C',
                        CAN_EMPTY => b'c',
                        TRASH => b'x',
                        STACK => b'S',
                        WHEELIE => b'W',
                        WHEELIE_EMPTY => b'w',
                        BIN => b'B',
                        BIN_EMPTY => b'b',
                        JUG => b'j',
                        JUG_EMPTY => b'i',
                        other => return Err(format!("no glyph for occupant {other}")),
                    }
                }
            } else if is_rac {
                b'+'
            } else if c.o == NONE {
                b'E'
            } else {
                // Unreachable by the rules — if we ever get here, a rule broke. Fail loudly.
                return Err(format!(
                    "occupant {} on an exit cell: the exit must never hold an object",
                    c.o
                ));
            });
        }
        out.push(String::from_utf8(row).map_err(|_| "non-UTF-8 grid row")?);
    }
    Ok(out)
}

pub fn to_cart(s: &State) -> Result<Option<Vec<String>>, String> {
    if !s.cells.iter().any(|c| c.cart != NO_ID) {
        return Ok(None);
    }
    let letters = pool_letters(s, |c| c.cart, CART_POOL, "carts")?;
    Ok(Some(mask(s, |c| {
        if c.cart == NO_ID {
            b'-'
        } else {
            letter_of(&letters, c.cart)
        }
    })))
}

/// Null only when the board never had a canal — a fully filled one still gets a mask.
pub fn to_water(s: &State) -> Option<Vec<String>> {
    if !s.cells.iter().any(|c| c.water || c.bridge) {
        return None;
    }
    Some(mask(s, |c| {
        if c.water {
            b'~'
        } else if c.bridge {
            b'='
        } else {
            b'-'
        }
    }))
}

fn mask(s: &State, of: impl Fn(&Cell) -> u8) -> Vec<String> {
    (0..s.rows)
        .map(|y| {
            let row: Vec<u8> = (0..s.cols).map(|x| of(s.at(x, y))).collect();
            String::from_utf8(row).expect("mask alphabet is ASCII")
        })
        .collect()
}
