//! Treasure Trash — a second implementation of the rules, speaking the conformance protocol.
//!
//!   cargo build --release && node tools/conform.mjs --engine engine/target/release/tt-engine
//!
//! `src/rules.js` is the engine of record and this is not a replacement for it. It exists to be
//! CHECKED against it: `tools/conform.mjs` puts every shipped room and a seeded batch of
//! generated ones through both, at whole-room grain and at one-board-one-direction grain, and
//! the port is sanctioned only for as long as that check runs green. See CLAUDE.md → One engine
//! and the entry in `SANCTIONED` in `tools/verify.mjs`.
//!
//! The protocol is written out in `tools/conform-ref.mjs`. Two obligations it states that are
//! easy to get wrong from this side, and both are met here:
//!
//!   * REPLY PER REQUEST, FLUSHING EACH. Accumulating replies before flushing deadlocks the
//!     first client that sends one request and waits for it. Throughput is the client's to
//!     arrange by keeping several in flight; this side must never make batching a condition of
//!     answering.
//!   * SAY SO RATHER THAN ANSWER WRONGLY. `answer` is not implemented yet, so it replies
//!     `unsupported` and the harness reports the skip loudly. It still runs the whole step-grain
//!     sweep, which is the part that pins the rules.

mod board;
mod json;
mod rules;
mod solver;

use rules::Outcome;
use std::io::{BufRead, Write};

fn main() {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("tt-engine: stdin: {e}");
                return;
            }
        };
        if line.trim().is_empty() {
            continue;
        }
        out.write_all(reply(&line).as_bytes()).expect("stdout closed");
        out.write_all(b"\n").expect("stdout closed");
        out.flush().expect("stdout closed");
    }
}

/// One request in, one reply line out. A failure anywhere becomes `error`, which the harness
/// counts as a disagreement — never a silent pass.
fn reply(line: &str) -> String {
    let req = match json::parse(line) {
        Ok(v) => v,
        Err(e) => return error_reply(0.0, &e),
    };
    let id = req.get("id").and_then(json::Json::as_f64).unwrap_or(0.0);
    match respond(&req) {
        Ok(body) => format!("{{\"id\":{},{}}}", fmt_id(id), body),
        Err(e) => error_reply(id, &e),
    }
}

fn error_reply(id: f64, message: &str) -> String {
    let mut out = String::new();
    json::escape(message, &mut out);
    format!("{{\"id\":{},\"error\":{}}}", fmt_id(id), out)
}

/// Ids are integers on the wire; a float spelling of one would still pair, but it reads wrong in
/// a transcript somebody is debugging from.
fn fmt_id(id: f64) -> String {
    if id.fract() == 0.0 && id.abs() < 9e15 {
        format!("{}", id as i64)
    } else {
        format!("{id}")
    }
}

/// The reply body, without the `id` — the fields the harness compares.
fn respond(req: &json::Json) -> Result<String, String> {
    match req.get("op").and_then(json::Json::as_str) {
        Some("step") => {
            let s = read_board(req)?;
            let dir = req
                .get("dir")
                .and_then(json::Json::as_str)
                .and_then(|d| d.as_bytes().first().copied())
                .ok_or("step wants a `dir`")?;
            match rules::explain(&s, dir)? {
                Outcome::No { reason } => {
                    let mut r = String::new();
                    json::escape(reason, &mut r);
                    Ok(format!("\"ok\":false,\"reason\":{r}"))
                }
                Outcome::Ok { kind, next } => {
                    let mut body = String::from("\"ok\":true,\"kind\":\"");
                    body.push_str(kind.name());
                    body.push_str("\",\"grid\":");
                    json::rows_or_null(Some(&board::to_grid(&next)?), &mut body);
                    body.push_str(",\"cart\":");
                    json::rows_or_null(board::to_cart(&next)?.as_ref(), &mut body);
                    body.push_str(",\"water\":");
                    json::rows_or_null(board::to_water(&next).as_ref(), &mut body);
                    body.push_str(",\"hold\":");
                    json::rows_or_null(board::to_hold(&next).as_ref(), &mut body);
                    Ok(body)
                }
            }
        }
        Some(op @ ("answer" | "measure")) => {
            let s = read_board(req)?;
            // Unbounded when unasked, same as the JS: a caller that has not thought about the
            // bound gets the exact answer or an out-of-memory crash, never a quiet lie.
            let max = req
                .opt("maxStates")
                .and_then(json::Json::as_f64)
                .map_or(usize::MAX, |n| n as usize);
            let r = solver::analyze(&s, max)?;
            let par = r.par.map_or("null".to_string(), |p| p.to_string());
            let coarse = format!(
                "\"par\":{par},\"solves\":{},\"traps\":{},\"reachable\":{},\"exitRefusals\":{}",
                r.solves, r.traps, r.reachable, r.exit_refusals
            );
            if op == "answer" {
                return Ok(coarse);
            }
            Ok(format!(
                "{coarse},\"silentTraps\":{},\"onPath\":{},\"bitten\":{},\
                 \"firstOnPath\":{},\"lead\":{},\"tail\":{}",
                r.silent_traps,
                r.on_path,
                r.bitten,
                r.first_on_path.map_or("null".to_string(), |f| f.to_string()),
                r.lead,
                r.tail
            ))
        }
        _ => Ok("\"unsupported\":true".into()),
    }
}

fn read_board(req: &json::Json) -> Result<board::State, String> {
    let grid = req
        .opt("grid")
        .and_then(json::Json::as_rows)
        .ok_or("no `grid`")?;
    let cart = req.opt("cart").and_then(json::Json::as_rows);
    let water = req.opt("water").and_then(json::Json::as_rows);
    let hold = req.opt("hold").and_then(json::Json::as_rows);
    board::to_state(&grid, cart.as_ref(), water.as_ref(), hold.as_ref())
}
