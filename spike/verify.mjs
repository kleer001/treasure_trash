// Spike verifier — proves L0–L3 solve in par, and that the three exit/mess soft-locks fire.
// Mirrors the pure logic in index.html. Run: node verify.mjs
const NONE=0,BAG=1,CANF=2,CANE=3,TRASH=4, FLOOR=0,WALL=1;
const LEVELS=[
  {name:"L0",par:2,grid:["#E#","#.#","#R#"]},
  {name:"L1",par:4,grid:["...",".B.","..E","#R#"]},
  {name:"L2",par:7,grid:["...","...","E..",".C.",".R."]},
  {name:"L3",par:5,grid:["...",".B.",".RE",".B.","..."]},
];
const U=[0,-1],D=[0,1],L=[-1,0],R=[1,0];
function parse(g){const rows=g.length,cols=g[0].length,cells=[];let rac={x:0,y:0};
  for(let r=0;r<rows;r++){cells.push([]);for(let c=0;c<cols;c++){const ch=g[r][c];let t=FLOOR,o=NONE,exit=false;
    if(ch==='#')t=WALL;else if(ch==='B')o=BAG;else if(ch==='C')o=CANF;else if(ch==='c')o=CANE;
    else if(ch==='x')o=TRASH;else if(ch==='E')exit=true;else if(ch==='R')rac={x:c,y:r};cells[r].push({t,o,exit});}}
  return {cols,rows,cells,rac,moves:0};}
const clone=s=>JSON.parse(JSON.stringify(s));
const inGrid=(s,x,y)=>x>=0&&y>=0&&x<s.cols&&y<s.rows;
const cell=(s,x,y)=>s.cells[y][x];
// the exit is terrain, not an occupant — it reads as clear floor, so a fan CAN bury it
const isClearFloor=(s,x,y)=>inGrid(s,x,y)&&cell(s,x,y).t===FLOOR&&cell(s,x,y).o===NONE;
function fan(bx,by,dx,dy){const px=-dy,py=dx;return[[bx+px,by+py],[bx-px,by-py],[bx+dx,by+dy],[bx+dx+px,by+dy+py],[bx+dx-px,by+dy-py]];}
const fanClear=(s,bx,by,dx,dy)=>fan(bx,by,dx,dy).every(([x,y])=>isClearFloor(s,x,y));
function tryMove(s,dx,dy){const n=clone(s);const x=n.rac.x,y=n.rac.y,tx=x+dx,ty=y+dy;
  if(!inGrid(n,tx,ty)||cell(n,tx,ty).t===WALL)return null;const o=cell(n,tx,ty).o;
  if(o===NONE){n.rac={x:tx,y:ty};n.moves++;return n;}
  if(o===TRASH)return null;
  if(o===BAG){if(!fanClear(n,tx,ty,dx,dy))return null;for(const[fx,fy]of fan(tx,ty,dx,dy))cell(n,fx,fy).o=TRASH;
    cell(n,tx,ty).o=NONE;n.rac={x:tx,y:ty};n.moves++;return n;}
  if(o===CANF){const b1x=tx+dx,b1y=ty+dy,b2x=tx+2*dx,b2y=ty+2*dy;
    if(!isClearFloor(n,b1x,b1y)||!isClearFloor(n,b2x,b2y))return null;
    cell(n,b2x,b2y).o=BAG;cell(n,b1x,b1y).o=CANE;cell(n,tx,ty).o=NONE;n.rac={x:tx,y:ty};n.moves++;return n;}
  if(o===CANE){const b1x=tx+dx,b1y=ty+dy;if(!isClearFloor(n,b1x,b1y))return null;
    cell(n,b1x,b1y).o=CANE;cell(n,tx,ty).o=NONE;n.rac={x:tx,y:ty};n.moves++;return n;}
  return null;}
const bagsLeft=s=>{let k=0;for(const row of s.cells)for(const c of row)if(c.o===BAG||c.o===CANF)k++;return k;};
const atExit=s=>cell(s,s.rac.x,s.rac.y).exit;
const isWon=s=>bagsLeft(s)===0&&atExit(s);
function run(grid,seq){let s=parse(grid);for(const[dx,dy]of seq){const n=tryMove(s,dx,dy);if(!n)return{s,ok:false};s=n;}return{s,ok:true};}

// Brute-force solver (Laws list 4): proves each room solvable, proves par is actually
// MINIMAL, and counts distinct shortest solutions — an unintended second-shortest solve
// usually means the room isn't teaching what the note claims.
const key=s=>s.cells.map(r=>r.map(c=>c.t===WALL?'#':c.o).join('')).join('/')+`|${s.rac.x},${s.rac.y}`;
function solve(grid){
  const start=parse(grid);
  let frontier=[start], seen=new Set([key(start)]), depth=0;
  while(frontier.length){
    const wins=frontier.filter(isWon);
    if(wins.length) return {depth,count:wins.length};
    const next=[]; const nextSeen=new Set();
    for(const s of frontier) for(const d of [U,D,L,R]){
      const n=tryMove(s,...d); if(!n) continue;
      const k=key(n); if(seen.has(k)||nextSeen.has(k)) continue;   // dedupe by state, not by path
      nextSeen.add(k); next.push(n);
    }
    for(const k of nextSeen) seen.add(k);
    frontier=next; depth++;
    if(depth>40) return {depth:-1,count:0};
  }
  return {depth:-1,count:0};
}

const solutions={ L0:[U,U], L1:[U,U,D,R], L2:[U,L,U,R,U,D,L], L3:[U,D,D,U,R] };
let pass=true;
const check=(label,cond)=>{console.log(`${label} ${cond?'✓':'✗'}`);if(!cond)pass=false;};

for(const lvl of LEVELS){
  const {s,ok}=run(lvl.grid,solutions[lvl.name]);
  const won=ok&&isWon(s);
  const best=solve(lvl.grid);
  check(`${lvl.name}: won=${won} moves=${s.moves}/${lvl.par} · shortest=${best.depth} (${best.count} state${best.count===1?'':'s'})`,
    won&&s.moves===lvl.par&&best.depth===lvl.par);
}

// --- the exit must not fire early: L2 walks OVER the exit at move 3 with a bag still out.
{
  const {s}=run(LEVELS[2].grid,[U,L,U]);
  check(`L2 exit inert while bags remain: onExit=${atExit(s)} bags=${bagsLeft(s)} won=${isWon(s)}`,
    atExit(s)&&bagsLeft(s)===1&&!isWon(s));
}

// --- soft-lock 1: L1's other legal strike. Loop to (2,1) and pounce DOWN — the bag opens,
// but the fan's leading row lands on y3, burying the exit at (3,3).
{
  let s=parse(LEVELS[1].grid);
  for(const m of [U,L,U,U,R]) { const n=tryMove(s,...m); if(n)s=n; }   // 0-idx (1,3)->(1,2)->(0,2)->(0,1)->(0,0)->(1,0)
  const atTop = s.rac.x===1 && s.rac.y===0;
  const n=tryMove(s,...D);   // strike the bag downward
  const buried = n && bagsLeft(n)===0 && n.cells[2][2].o===TRASH && n.cells[2][2].exit && !isWon(n);
  check(`L1 soft-lock (exit buried): reachedTop=${atTop} allBagsOpen&exitTrashed=${!!buried}`, atTop&&!!buried);
}

// --- soft-lock 2: L2's mirror solve. Push the empty can LEFT onto the exit — no pull,
// and one more push is off-grid, so the exit is sealed for good.
{
  const {s,ok}=run(LEVELS[2].grid,[U,R,U,L]);   // up (dump), right, up, push can left onto E
  const canOnExit = ok && s.cells[2][0].o===CANE && s.cells[2][0].exit;
  const stuck = canOnExit && tryMove(s,...L)===null;   // can't shove it further — off-grid
  check(`L2 soft-lock (can on exit): canOnExit=${!!canOnExit} unpushable=${!!stuck}`, !!stuck);
}

// --- soft-lock 3: L3, striking the TOP bag downward seals the corridor, strands the
// bottom bag, AND buries the exit under the same row.
{
  let s=parse(LEVELS[3].grid);
  for(const m of [L,U,U,R]) { const n=tryMove(s,...m); if(n)s=n; }   // (1,2)->(0,2)->(0,1)->(0,0)->(1,0)
  const atTop = s.rac.x===1 && s.rac.y===0;
  const n=tryMove(s,...D);   // strike top bag downward
  const stranded = n && bagsLeft(n)===1 && n.cells[2].every(c=>c.o===TRASH) && n.cells[2][2].exit;
  check(`L3 soft-lock (corridor + exit sealed): reachedTop=${atTop} sealed=${!!stranded}`, atTop&&!!stranded);
}

console.log(pass?'\nALL PASS':'\nFAIL'); process.exit(pass?0:1);
