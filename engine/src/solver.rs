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
use crate::rules::{explain, Outcome};
use std::collections::HashMap;

const DIR_ORDER: [u8; 4] = [b'u', b'd', b'l', b'r'];

pub struct Answer {
    pub par: Option<i32>,
    pub solves: u64,
    pub traps: usize,
    pub reachable: usize,
    pub exit_refusals: usize,
}

struct Node {
    state: State,
    depth: i32,
    edges: Vec<u32>,
}

/// Canonical state key, byte for byte the string `stateKey` builds — every lane of it is here
/// because dropping one is a SILENT bug, and the reasons are written out in `src/rules.js`.
///
/// The labelling of the multi-cell pieces is the lane most easily got wrong: the ids do not
/// determine the partition, so they are relabelled BY FIRST APPEARANCE in raster order. Keep the
/// raw ids instead and two boards that differ only in which couch is called which count as two
/// states, which shows up as a `reachable` that is too high and a par that is right by luck.
fn state_key(s: &State) -> Vec<u8> {
    let mut kinds = Vec::with_capacity((s.rows * (s.cols + 1)) as usize);
    let (mut pids, mut carts) = (Vec::new(), Vec::new());
    let (mut pid_seen, mut cart_seen): (Vec<u16>, Vec<u16>) = (Vec::new(), Vec::new());
    let label = |seen: &mut Vec<u16>, id: u16| -> u8 {
        match seen.iter().position(|&k| k == id) {
            Some(i) => i as u8,
            None => {
                seen.push(id);
                (seen.len() - 1) as u8
            }
        }
    };
    for y in 0..s.rows {
        if y > 0 {
            kinds.push(b'/');
        }
        for x in 0..s.cols {
            let c = s.at(x, y);
            let terrain: u16 = if c.water { 1 } else if c.bridge { 2 } else { 0 };
            let cart = if c.is_cart() { 1 } else { 0 };
            kinds.push((65 + (c.o as u16 * 3 + terrain) * 2 + cart) as u8);
            if c.pid != NO_ID {
                pids.push(65 + label(&mut pid_seen, c.pid));
            }
            if c.cart != NO_ID {
                carts.push(65 + label(&mut cart_seen, c.cart));
            }
        }
    }
    let mut key = kinds;
    key.push(b'|');
    key.extend(pids);
    key.push(b'|');
    key.extend(carts);
    key.push(b'|');
    key.extend(format!("{},{}", s.rac.0, s.rac.1).into_bytes());
    key
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

pub fn analyze(start: &State, max_states: usize) -> Result<Answer, String> {
    let mut index: HashMap<Vec<u8>, u32> = HashMap::new();
    let mut nodes: Vec<Node> = Vec::new();
    index.insert(state_key(start), 0);
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
                let ns = match r {
                    Outcome::No { reason } => {
                        if reason == "exit" {
                            exit_refusals += 1;
                        }
                        continue;
                    }
                    Outcome::Ok { next, .. } => next,
                };
                // Keyed once. Hashing a board is a scan of every cell of it, so asking twice
                // to look up and then insert is a second full read of the same board.
                let k = state_key(&ns);
                let to = if let Some(&i) = index.get(&k) {
                    i
                } else {
                    if nodes.len() >= max_states {
                        return Err(format!("state graph exceeds {max_states} states"));
                    }
                    let i = nodes.len() as u32;
                    index.insert(k, i);
                    nodes.push(Node { state: ns, depth: depth + 1, edges: Vec::new() });
                    next.push(i);
                    i
                };
                nodes[at as usize].edges.push(to);
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
        for &to in &n.edges {
            reverse[to as usize].push(i as u32);
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
    // directions from one board into the same dead board are two ways to lose, not one.
    let mut traps = 0usize;
    for (i, n) in nodes.iter().enumerate() {
        if !live[i] {
            continue;
        }
        traps += n.edges.iter().filter(|&&to| !live[to as usize]).count();
    }

    let par = wins.iter().map(|&w| nodes[w as usize].depth).min();
    let solves = match par {
        None => 0,
        Some(m) => count_shortest(&nodes, &wins, m),
    };

    Ok(Answer { par, solves, traps, reachable: nodes.len(), exit_refusals })
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
            for &to in &nodes[k as usize].edges {
                if nodes[to as usize].depth == d as i32 + 1 {
                    ways[to as usize] += w;
                }
            }
        }
    }
    wins.iter()
        .filter(|&&w| nodes[w as usize].depth == par)
        .map(|&w| ways[w as usize])
        .sum()
}
