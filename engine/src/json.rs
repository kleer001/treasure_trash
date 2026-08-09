//! Just enough JSON for the conformance protocol: one object per line, six field types.

#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

impl Json {
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Obj(fields) => fields.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// `null` and a missing key read the same here — the protocol writes `"cart": null` and
    /// omitting the key entirely means the same thing.
    pub fn opt(&self, key: &str) -> Option<&Json> {
        match self.get(key) {
            None | Some(Json::Null) => None,
            some => some,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Num(n) => Some(*n),
            _ => None,
        }
    }

    /// The protocol's grids and masks: an array of strings, or nothing.
    pub fn as_rows(&self) -> Option<Vec<String>> {
        match self {
            Json::Arr(items) => items
                .iter()
                .map(|v| v.as_str().map(str::to_owned))
                .collect(),
            _ => None,
        }
    }
}

pub fn parse(text: &str) -> Result<Json, String> {
    let bytes = text.as_bytes();
    let mut at = 0usize;
    let value = parse_value(bytes, &mut at)?;
    skip_space(bytes, &mut at);
    if at != bytes.len() {
        return Err(format!("trailing input at byte {at}"));
    }
    Ok(value)
}

fn skip_space(b: &[u8], at: &mut usize) {
    while *at < b.len() && matches!(b[*at], b' ' | b'\t' | b'\r' | b'\n') {
        *at += 1;
    }
}

fn expect(b: &[u8], at: &mut usize, ch: u8) -> Result<(), String> {
    skip_space(b, at);
    if *at < b.len() && b[*at] == ch {
        *at += 1;
        Ok(())
    } else {
        Err(format!("expected '{}' at byte {}", ch as char, at))
    }
}

fn parse_value(b: &[u8], at: &mut usize) -> Result<Json, String> {
    skip_space(b, at);
    match b.get(*at) {
        None => Err("unexpected end of input".into()),
        Some(b'{') => parse_obj(b, at),
        Some(b'[') => parse_arr(b, at),
        Some(b'"') => Ok(Json::Str(parse_str(b, at)?)),
        Some(b't') => lit(b, at, "true", Json::Bool(true)),
        Some(b'f') => lit(b, at, "false", Json::Bool(false)),
        Some(b'n') => lit(b, at, "null", Json::Null),
        Some(_) => parse_num(b, at),
    }
}

fn lit(b: &[u8], at: &mut usize, word: &str, out: Json) -> Result<Json, String> {
    if b[*at..].starts_with(word.as_bytes()) {
        *at += word.len();
        Ok(out)
    } else {
        Err(format!("bad literal at byte {at}"))
    }
}

fn parse_obj(b: &[u8], at: &mut usize) -> Result<Json, String> {
    *at += 1; // '{'
    let mut fields = Vec::new();
    skip_space(b, at);
    if b.get(*at) == Some(&b'}') {
        *at += 1;
        return Ok(Json::Obj(fields));
    }
    loop {
        skip_space(b, at);
        let key = parse_str(b, at)?;
        expect(b, at, b':')?;
        fields.push((key, parse_value(b, at)?));
        skip_space(b, at);
        match b.get(*at) {
            Some(b',') => *at += 1,
            Some(b'}') => {
                *at += 1;
                return Ok(Json::Obj(fields));
            }
            _ => return Err(format!("expected ',' or '}}' at byte {at}")),
        }
    }
}

fn parse_arr(b: &[u8], at: &mut usize) -> Result<Json, String> {
    *at += 1; // '['
    let mut items = Vec::new();
    skip_space(b, at);
    if b.get(*at) == Some(&b']') {
        *at += 1;
        return Ok(Json::Arr(items));
    }
    loop {
        items.push(parse_value(b, at)?);
        skip_space(b, at);
        match b.get(*at) {
            Some(b',') => *at += 1,
            Some(b']') => {
                *at += 1;
                return Ok(Json::Arr(items));
            }
            _ => return Err(format!("expected ',' or ']' at byte {at}")),
        }
    }
}

fn parse_str(b: &[u8], at: &mut usize) -> Result<String, String> {
    if b.get(*at) != Some(&b'"') {
        return Err(format!("expected a string at byte {at}"));
    }
    *at += 1;
    let mut out = String::new();
    loop {
        let ch = *b.get(*at).ok_or("unterminated string")?;
        *at += 1;
        match ch {
            b'"' => return Ok(out),
            b'\\' => {
                let esc = *b.get(*at).ok_or("unterminated escape")?;
                *at += 1;
                match esc {
                    b'"' => out.push('"'),
                    b'\\' => out.push('\\'),
                    b'/' => out.push('/'),
                    b'b' => out.push('\u{8}'),
                    b'f' => out.push('\u{c}'),
                    b'n' => out.push('\n'),
                    b'r' => out.push('\r'),
                    b't' => out.push('\t'),
                    b'u' => {
                        let hex = b
                            .get(*at..*at + 4)
                            .ok_or("truncated \\u escape")?;
                        let code = u32::from_str_radix(
                            std::str::from_utf8(hex).map_err(|_| "bad \\u escape")?,
                            16,
                        )
                        .map_err(|_| "bad \\u escape")?;
                        *at += 4;
                        out.push(char::from_u32(code).ok_or("bad code point")?);
                    }
                    _ => return Err("unknown escape".into()),
                }
            }
            // The board glyphs are ASCII, but a multi-byte char in a string must survive
            // being copied through rather than being cut in half.
            _ => {
                let start = *at - 1;
                let len = utf8_len(ch);
                let slice = b.get(start..start + len).ok_or("truncated UTF-8")?;
                out.push_str(std::str::from_utf8(slice).map_err(|_| "bad UTF-8")?);
                *at = start + len;
            }
        }
    }
}

fn utf8_len(lead: u8) -> usize {
    match lead {
        0x00..=0x7f => 1,
        0xc0..=0xdf => 2,
        0xe0..=0xef => 3,
        _ => 4,
    }
}

fn parse_num(b: &[u8], at: &mut usize) -> Result<Json, String> {
    let start = *at;
    while *at < b.len() && matches!(b[*at], b'0'..=b'9' | b'-' | b'+' | b'.' | b'e' | b'E') {
        *at += 1;
    }
    std::str::from_utf8(&b[start..*at])
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .map(Json::Num)
        .ok_or_else(|| format!("bad number at byte {start}"))
}

// ---------------------------------------------------------------- writing

pub fn escape(s: &str, out: &mut String) {
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// `["ab","cd"]`, or bare `null` — the shape every board block in a reply takes.
pub fn rows_or_null(rows: Option<&Vec<String>>, out: &mut String) {
    match rows {
        None => out.push_str("null"),
        Some(rows) => {
            out.push('[');
            for (i, row) in rows.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                escape(row, out);
            }
            out.push(']');
        }
    }
}
