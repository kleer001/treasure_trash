// SlopCodeBench's erosion measure, on JavaScript: the share of complexity mass held by functions
// whose cyclomatic complexity is above 10, where a function's mass is CC × √SLOC
// (github.com/SprocketLab/slop-code-bench, src/slop_code/metrics/checkpoint/mass.py).
// CC counts branches the way radon does for Python: each if, ?:, loop, catch, non-default case and
// && / || / ?? operand. A nested function is its own symbol, and its branches do not count for
// the function around it. SLOC is the lines of a function's span that carry a token.
//
//   ACORN=<dir with node_modules/acorn> node erosion.mjs [--top N] <file or dir>...
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const require = createRequire(join(process.env.ACORN, 'x.js'));
const acorn = require('acorn'), walk = require('acorn-walk');

const args = process.argv.slice(2);
const top = args[0] === '--top' ? Number(args.splice(0, 2)[1]) : 25;
const HIGH = 10;

const files = args.flatMap(function list(p) {
  if (statSync(p).isDirectory()) return readdirSync(p).sort().flatMap(n => list(join(p, n)));
  return /\.m?js$/.test(p) ? [p] : [];
});

const BRANCH = new Set(['IfStatement', 'ConditionalExpression', 'ForStatement', 'ForInStatement',
  'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'CatchClause']);
const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function nameOf(node, parent, src) {
  if (node.id) return node.id.name;
  if (parent?.type === 'VariableDeclarator') return parent.id.name;
  if (parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition')
    return parent.key.name ?? parent.key.value;
  if (parent?.type === 'AssignmentExpression') return src.slice(parent.left.start, parent.left.end);
  return null;
}

function measure(file) {
  const src = readFileSync(file, 'utf8'), coded = new Set();
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true,
    onToken: t => { for (let l = t.loc.start.line; l <= t.loc.end.line; l++) coded.add(l); } });
  const fns = [];
  walk.fullAncestor(ast, (node, _state, ancestors) => {
    if (!FN.has(node.type)) return;
    const parent = ancestors[ancestors.length - 2];
    const name = nameOf(node, parent, src);
    let cc = 1;
    walk.recursive(node.body, null, {
      Function() {},
      ...Object.fromEntries([...BRANCH].map(t => [t, (n, s, c) => { cc++; walk.base[t](n, s, c); }])),
      SwitchCase(n, s, c) { if (n.test) cc++; walk.base.SwitchCase(n, s, c); },
      LogicalExpression(n, s, c) { cc++; walk.base.LogicalExpression(n, s, c); },
    });
    let sloc = 0;
    for (let l = node.loc.start.line; l <= node.loc.end.line; l++) if (coded.has(l)) sloc++;
    fns.push({ file, name: name ?? `<anon>`, line: node.loc.start.line, cc, sloc, mass: cc * Math.sqrt(sloc) });
  });
  return fns;
}

const all = files.flatMap(measure);
const share = fns => {
  const total = fns.reduce((s, f) => s + f.mass, 0), high = fns.filter(f => f.cc > HIGH).reduce((s, f) => s + f.mass, 0);
  return { total, high, pct: total ? (100 * high) / total : 0, n: fns.length, nHigh: fns.filter(f => f.cc > HIGH).length };
};
const rel = f => relative(process.cwd(), f);

const whole = share(all);
console.log(`erosion ${whole.pct.toFixed(1)}%  (${whole.nHigh} of ${whole.n} functions above CC ${HIGH}; mass ${whole.high.toFixed(0)} of ${whole.total.toFixed(0)})\n`);
console.log('file erosion, by high-CC mass');
const byFile = files.map(f => ({ f, ...share(all.filter(x => x.file === f)) })).filter(r => r.n).sort((a, b) => b.high - a.high);
for (const r of byFile) if (r.high) console.log(`  ${r.pct.toFixed(0).padStart(3)}%  ${r.high.toFixed(0).padStart(6)}  ${String(r.nHigh).padStart(3)} fn  ${rel(r.f)}`);
console.log(`\ntop ${top} functions above CC ${HIGH}, by mass`);
console.log('    mass   cc  sloc  function');
for (const f of all.filter(f => f.cc > HIGH).sort((a, b) => b.mass - a.mass).slice(0, top))
  console.log(`  ${f.mass.toFixed(0).padStart(6)} ${String(f.cc).padStart(4)} ${String(f.sloc).padStart(5)}  ${rel(f.file)}:${f.line} ${f.name}`);
