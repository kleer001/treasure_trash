// Spike verifier — proves L1–L3 solve in par and that a wrong strike soft-locks.
// Mirrors the pure logic in index.html. Run: node verify.mjs
const NONE=0,BAG=1,CANF=2,CANE=3,TRASH=4, FLOOR=0,WALL=1;
const LEVELS=[
  {name:"L1",par:2,grid:["...",".B.","...","#R#"]},
  {name:"L2",par:5,grid:["...","...","...",".C.",".R."]},
  {name:"L3",par:3,grid:["...",".B.",".R.",".B.","..."]},
];
const U=[0,-1],D=[0,1],L=[-1,0],R=[1,0];
function parse(g){const rows=g.length,cols=g[0].length,cells=[];let rac={x:0,y:0};
  for(let r=0;r<rows;r++){cells.push([]);for(let c=0;c<cols;c++){const ch=g[r][c];let t=FLOOR,o=NONE;
    if(ch==='#')t=WALL;else if(ch==='B')o=BAG;else if(ch==='C')o=CANF;else if(ch==='c')o=CANE;
    else if(ch==='x')o=TRASH;else if(ch==='R')rac={x:c,y:r};cells[r].push({t,o});}}
  return {cols,rows,cells,rac,moves:0};}
const clone=s=>JSON.parse(JSON.stringify(s));
const inGrid=(s,x,y)=>x>=0&&y>=0&&x<s.cols&&y<s.rows;
const cell=(s,x,y)=>s.cells[y][x];
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
function run(grid,seq){let s=parse(grid);for(const[dx,dy]of seq){const n=tryMove(s,dx,dy);if(!n)return{s,ok:false};s=n;}return{s,ok:true};}

const solutions={ L1:[U,U], L2:[U,R,U,L,U], L3:[U,D,D] };
let pass=true;
for(const lvl of LEVELS){
  const {s,ok}=run(lvl.grid,solutions[lvl.name]);
  const solved=ok&&bagsLeft(s)===0, par=s.moves===lvl.par;
  console.log(`${lvl.name}: solved=${solved} moves=${s.moves}/${lvl.par} ${solved&&par?'✓':'✗'}`);
  if(!(solved&&par))pass=false;
}
// soft-lock check: L3, striking the TOP bag downward should seal the corridor and strand the bottom bag.
{
  // path the raccoon up to (1,0), then Down onto the top bag -> corridor trashed
  let s=parse(LEVELS[2].grid);
  for(const m of [L,U,U,R]) { const n=tryMove(s,...m); if(n)s=n; }   // (1,2)->(0,2)->(0,1)->(0,0)->(1,0)
  const atTop = s.rac.x===1 && s.rac.y===0;
  const n=tryMove(s,...D);  // strike top bag downward
  const stranded = n && bagsLeft(n)===1 && n.cells[2].every(c=>c.o===TRASH); // corridor row 2 all trash
  console.log(`L3 soft-lock: reachedTop=${atTop} corridorSealed=${!!stranded} ${atTop&&stranded?'✓':'✗'}`);
  if(!(atTop&&stranded))pass=false;
}
console.log(pass?'\nALL PASS':'\nFAIL'); process.exit(pass?0:1);
