//! Exhaustive analysis, in Rust. A port of `src/solver.js`, which stays the engine of record.
//!
//! The rooms are tiny, so nothing here estimates: every reachable state is enumerated and
//! liveness is computed exactly. Same contract as the JS — the bound THROWS rather than
//! truncating, because a partial graph reports a wrong par and a wrong trap count and every
//! claim downstream is only worth anything because the graph is whole.
//!
//! What the protocol's `answer` carries is five numbers, and none of them depends on the order
//! the search reached things in. The canonical `:solve` DOES — it is a tie-break on discovery
//! order — and it is deliberately not in the contract, so it is not computed here. The states
//! are still held in a `Vec` in insertion order, indexed by a side table, which is what will
//! make adding it cost nothing later.

use crate::board::*;
use crate::rules::{explain, Kind, Outcome};
use std::collections::HashMap;

const DIR_ORDER: [u8; 4] = [b'u', b'd', b'l', b'r'];

/// Everything one enumeration knows. `answer` prints the five the protocol's coarse grain
/// carries; `measure` prints all of them. One walk of the graph either way — the extra fields
/// are linear passes over a graph the BFS has already paid for, which is the whole reason they
/// belong on this side of the pipe rather than being recomputed from a graph shipped over it.
pub struct Report {
    pub par: Option<i32>,
    pub solves: u64,
    pub traps: usize,
    pub silent_traps: usize,
    pub reachable: usize,
    pub exit_refusals: usize,
    pub on_path: f64,
    pub bitten: usize,
    pub first_on_path: Option<i32>,
    pub lead: i32,
    pub tail: i32,
}

struct Edge {
    kind: Kind,
    to: u32,
}

struct Node {
    state: State,
    depth: i32,
    edges: Vec<Edge>,
}

/// Scratch for `state_key_into`, one per enumeration and reused for every board it keys.
///
/// Keying is by far the hottest thing this file does — a third of the whole binary's
/// instructions, with the allocator taking another fifth serving it — and a board is keyed once
/// per EDGE, not once per state. Allocating fresh buffers per call made malloc the second
/// biggest cost in a program whose actual rules evaluation is three percent.
#[derive(Default)]
struct KeyBuf {
    /// The cells a key has to describe: every one that is not a wall.
    ///
    /// Nothing ever writes a wall. Every write goes through `at_mut` at a cell that passed
    /// `is_occupiable`, `can_pour` or cart membership, and all three exclude walls — so a wall
    /// reads the same in every state of one enumeration and saying so in each key says nothing.
    /// Boards here run to two fifths wall, and the bytes come off the building, the hashing and
    /// the comparing alike.
    live: Vec<u32>,
    key: Vec<u8>,
    pids: Vec<u8>,
    carts: Vec<u8>,
    pid_seen: Vec<u16>,
    cart_seen: Vec<u16>,
}

impl KeyBuf {
    fn new(s: &State) -> Self {
        KeyBuf {
            live: (0..s.cells.len() as u32).filter(|&i| !s.cells[i as usize].wall).collect(),
            ..Default::default()
        }
    }
}

/// Position of `id`'s first appearance, adding it if this is that appearance.
fn label(seen: &mut Vec<u16>, id: u16) -> u8 {
    match seen.iter().position(|&k| k == id) {
        Some(i) => i as u8,
        None => {
            seen.push(id);
            (seen.len() - 1) as u8
        }
    }
}

/// Canonical state key. Every lane `stateKey` carries is here, because dropping one is a SILENT
/// bug and the reasons are written out in `src/rules.js`.
///
/// The lane most easily got wrong is the multi-cell one: the ids do not determine the partition,
/// so they are relabelled BY FIRST APPEARANCE in raster order. Keep the raw ids instead and two
/// boards differing only in which couch is called which count as two states, which surfaces as a
/// `reachable` that is too high and a par that is right by luck.
///
/// What it does NOT carry is `stateKey`'s separators, and the difference is deliberate. This key
/// is the engine's own index and never crosses the wire, so what it owes the JS is injectivity
/// over the same boards, not the same spelling. Within one enumeration the grid's size is fixed
/// and pieces are neither created nor destroyed, so every key has identical length and identical
/// section offsets — position alone says which section a byte belongs to, and a delimiter would
/// only be telling us what we already know.
fn state_key_into(s: &State, b: &mut KeyBuf) {
    let KeyBuf { live, key, pids, carts, pid_seen, cart_seen } = b;
    key.clear();
    pids.clear();
    carts.clear();
    pid_seen.clear();
    cart_seen.clear();
    for &i in live.iter() {
        let c = &s.cells[i as usize];
        let terrain: u16 = if c.water { 1 } else if c.bridge { 2 } else { 0 };
        let cart = u16::from(c.is_cart());
        key.push((65 + (c.o as u16 * 3 + terrain) * 2 + cart) as u8);
        if c.pid != NO_ID {
            let n = label(pid_seen, c.pid);
            pids.push(65 + n);
        }
        if c.cart != NO_ID {
            let n = label(cart_seen, c.cart);
            carts.push(65 + n);
        }
    }
    key.extend_from_slice(pids);
    key.extend_from_slice(carts);
    // Raw bytes rather than decimal text: `format!` drags the whole formatting machinery in for
    // two small integers, and it measured at five percent of the binary doing so.
    key.extend_from_slice(&s.rac.0.to_le_bytes());
    key.extend_from_slice(&s.rac.1.to_le_bytes());
}

fn bags_left(s: &State) -> u32 {
    s.cells
        .iter()
        .map(|c| match c.o {
            BAG | CAN_FULL | WHEELIE | BIN => 1,
            STACK => 2,
            _ => 0,
        })
        .sum()
}

fn trash_held(s: &State) -> u32 {
    s.cells.iter().filter(|c| c.is_cart() && c.o == TRASH).count() as u32
}

fn is_won(s: &State) -> bool {
    bags_left(s) == 0 && trash_held(s) == 0 && s.at(s.rac.0, s.rac.1).exit
}

pub fn analyze(start: &State, max_states: usize) -> Result<Report, String> {
    let mut index: HashMap<Vec<u8>, u32> = HashMap::new();
    let mut nodes: Vec<Node> = Vec::new();
    let mut kb = KeyBuf::new(start);
    state_key_into(start, &mut kb);
    index.insert(kb.key.clone(), 0);
    nodes.push(Node { state: start.clone(), depth: 0, edges: Vec::new() });

    // How often the exit itself refuses an action is counted here rather than in a second
    // sweep: the BFS already visits every state and every direction, and has the reason in hand.
    let mut exit_refusals = 0usize;
    let mut frontier = vec![0u32];
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for &at in &frontier {
            let depth = nodes[at as usize].depth;
            // Collected first so the borrow of `nodes` ends before the graph grows. `explain`
            // hands back an owned board, so nothing here needs a copy of the one it came from.
            let mut got = Vec::with_capacity(4);
            for dir in DIR_ORDER {
                got.push(explain(&nodes[at as usize].state, dir)?);
            }
            for r in got {
                let (kind, ns) = match r {
                    Outcome::No { reason } => {
                        if reason == "exit" {
                            exit_refusals += 1;
                        }
                        continue;
                    }
                    Outcome::Ok { kind, next } => (kind, next),
                };
                // Keyed once, into a buffer that outlives the call, and COPIED only when the
                // board turns out to be new. Most edges lead somewhere already seen, so most
                // keyings now allocate nothing at all.
                state_key_into(&ns, &mut kb);
                let to = if let Some(&i) = index.get(kb.key.as_slice()) {
                    i
                } else {
                    if nodes.len() >= max_states {
                        return Err(format!("state graph exceeds {max_states} states"));
                    }
                    let i = nodes.len() as u32;
                    index.insert(kb.key.clone(), i);
                    nodes.push(Node { state: ns, depth: depth + 1, edges: Vec::new() });
                    next.push(i);
                    i
                };
                nodes[at as usize].edges.push(Edge { kind, to });
            }
        }
        frontier = next;
    }

    let wins: Vec<u32> = (0..nodes.len() as u32)
        .filter(|&i| is_won(&nodes[i as usize].state))
        .collect();

    // Liveness: reverse-reachability from every winning state.
    let mut reverse: Vec<Vec<u32>> = vec![Vec::new(); nodes.len()];
    for (i, n) in nodes.iter().enumerate() {
        for e in &n.edges {
            reverse[e.to as usize].push(i as u32);
        }
    }
    let mut live = vec![false; nodes.len()];
    let mut queue = wins.clone();
    for &w in &wins {
        live[w as usize] = true;
    }
    while let Some(k) = queue.pop() {
        for &p in &reverse[k as usize] {
            if !live[p as usize] {
                live[p as usize] = true;
                queue.push(p);
            }
        }
    }

    // A trap is a legal action that takes a live state to a dead one. Counted per EDGE, so two
    // directions from one board into the same dead board are two ways to lose, not one. A SILENT
    // trap is one whose action is a plain move: the room is lost and nothing on screen moved.
    let (mut traps, mut silent_traps) = (0usize, 0usize);
    for (i, n) in nodes.iter().enumerate() {
        if !live[i] {
            continue;
        }
        for e in n.edges.iter().filter(|e| !live[e.to as usize]) {
            traps += 1;
            if e.kind == Kind::Move {
                silent_traps += 1;
            }
        }
    }

    let par = wins.iter().map(|&w| nodes[w as usize].depth).min();
    let mut r = Report {
        par,
        solves: 0,
        traps,
        silent_traps,
        reachable: nodes.len(),
        exit_refusals,
        on_path: 0.0,
        bitten: 0,
        first_on_path: None,
        lead: 0,
        tail: 0,
    };
    let Some(par) = par else { return Ok(r) };
    r.solves = count_shortest(&nodes, &wins, par);

    let on_dag = shortest_dag(&nodes, &wins, par);
    let (bitten_at, worked) = walk_dag(&nodes, &on_dag, &live, par);
    r.bitten = bitten_at.iter().filter(|&&b| b).count();
    r.on_path = r.bitten as f64 / par as f64;
    r.first_on_path = bitten_at.iter().position(|&b| b).map(|i| i as i32);
    let (first_work, last_work, any) = worked;
    r.lead = if any { first_work } else { 0 };
    r.tail = par - last_work;
    Ok(r)
}

/// Every state on some shortest solve. Grown backwards from the winning states at par, so a
/// board is on it when it has an edge into one that already is, one depth further on.
fn shortest_dag(nodes: &[Node], wins: &[u32], par: i32) -> Vec<bool> {
    let mut on_dag = vec![false; nodes.len()];
    for &w in wins {
        if nodes[w as usize].depth == par {
            on_dag[w as usize] = true;
        }
    }
    let mut by_depth: Vec<Vec<u32>> = Vec::new();
    for (i, n) in nodes.iter().enumerate() {
        let d = n.depth as usize;
        if by_depth.len() <= d {
            by_depth.resize(d + 1, Vec::new());
        }
        by_depth[d].push(i as u32);
    }
    for d in (1..=par).rev() {
        let Some(layer) = by_depth.get(d as usize - 1) else { continue };
        for &k in layer {
            if nodes[k as usize]
                .edges
                .iter()
                .any(|e| on_dag[e.to as usize] && nodes[e.to as usize].depth == d)
            {
                on_dag[k as usize] = true;
            }
        }
    }
    on_dag
}

/// One pass over the shortest-solve DAG for the two things read off it.
///
///   BITE   which depths of the best line have a way to lose hanging off them. Where a trap
///          sits matters more than how many there are — a room can ship seventeen of them all
///          off branches optimal play never walks.
///   WORK   the first and last depth at which the best line does something to a piece. What is
///          outside them is dead travel: the walk in, and the walk to the door.
fn walk_dag(
    nodes: &[Node],
    on_dag: &[bool],
    live: &[bool],
    par: i32,
) -> (Vec<bool>, (i32, i32, bool)) {
    let mut bitten_at = vec![false; par as usize];
    let (mut first_work, mut last_work, mut any) = (par, 0, false);
    for (i, n) in nodes.iter().enumerate() {
        if !on_dag[i] {
            continue;
        }
        if n.depth < par && n.edges.iter().any(|e| !live[e.to as usize]) {
            bitten_at[n.depth as usize] = true;
        }
        for e in &n.edges {
            if e.kind != Kind::Move
                && on_dag[e.to as usize]
                && nodes[e.to as usize].depth == n.depth + 1
            {
                any = true;
                first_work = first_work.min(n.depth);
                last_work = last_work.max(n.depth + 1);
            }
        }
    }
    (bitten_at, (first_work, last_work, any))
}

/// How many distinct shortest action-sequences win. Counted over the shortest-path DAG rather
/// than enumerated, so a room with thousands of tied lines costs the same as one with a single
/// line. More than one means the room has solves nobody intended.
fn count_shortest(nodes: &[Node], wins: &[u32], par: i32) -> u64 {
    let mut by_depth: Vec<Vec<u32>> = Vec::new();
    for (i, n) in nodes.iter().enumerate() {
        let d = n.depth as usize;
        if by_depth.len() <= d {
            by_depth.resize(d + 1, Vec::new());
        }
        by_depth[d].push(i as u32);
    }
    let mut ways = vec![0u64; nodes.len()];
    ways[0] = 1;
    for d in 0..par as usize {
        let Some(layer) = by_depth.get(d) else { break };
        for &k in layer {
            let w = ways[k as usize];
            if w == 0 {
                continue;
            }
            for e in &nodes[k as usize].edges {
                if nodes[e.to as usize].depth == d as i32 + 1 {
                    ways[e.to as usize] += w;
                }
            }
        }
    }
    wins.iter()
        .filter(|&&w| nodes[w as usize].depth == par)
        .map(|&w| ways[w as usize])
        .sum()
}
