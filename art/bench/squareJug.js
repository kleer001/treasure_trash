// The square water jug for the benches: the Blender model in tmp/jug/, warped and lit in three.js and
// read back as pixel art. A page that imports this needs an import map for 'three'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** The square jug as the owner set it on the square jug and jug light pages. Lengths are cm unless named px. */
export const JUG_LOOK = { rx: 35, ry: 0, rz: 0, h: 42, neck: 10.2, rib: 1.8, water: 66, dy: -1, pxm: 56, laz: -36, lel: 56,
  bands: [78, 84, 72], wet: 4.5, thick: 5, dark: 40, facing: 71, bevel: 1.2, recess: 1.7, inset: 3,
  ink: '#19152b', shadow: '#3c4a68', mouth: '#2b2d55', plastic: '#67819e', fill: '#b9d3d6', blues: ['#244287', '#3169b0', '#7dafb3', '#f1eccb'] };

const BOX = 128, WATER = 1, rad = THREE.MathUtils.degToRad;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const WHOLE = new Set(['collar', 'lip', 'mouth']);
/** Each fall: the push direction in the jug's frame. */
const AXIS = { r: new THREE.Vector3(1, 0, 0), l: new THREE.Vector3(-1, 0, 0), d: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(0, 0, -1) };

/** The height of the water's surface over the floor when a fraction `F` of the section holds water, `deg` over. */
function surface([u0, u1, v0, v1], deg, F) {
  const c = Math.cos(rad(deg)), sn = Math.sin(rad(deg));
  const poly = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => [u * c + v * sn, -u * sn + v * c]);
  const ys = poly.map(p => p[1]);
  if (F <= 0) return Math.min(...ys) - 1;
  const area = q => Math.abs(q.reduce((t, p, i) => { const r = q[(i + 1) % q.length]; return t + p[0] * r[1] - r[0] * p[1]; }, 0)) / 2;
  const below = h => area(poly.flatMap((p, i) => {
    const q = poly[(i + 1) % poly.length], out = p[1] <= h ? [p] : [];
    if ((p[1] <= h) !== (q[1] <= h)) out.push([p[0] + (h - p[1]) / (q[1] - p[1]) * (q[0] - p[0]), h]);
    return out;
  }));
  const want = F * (u1 - u0) * (v1 - v0);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (below(m) < want) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/** The jug. `set(look)` applies a look; `drawing(dir, deg, F)` draws it under the last look set. */
export async function squareJug() {
  // Two passes. The water, alone on layer 1, adds up into THICK how far each pixel's line of sight runs
  // through it below the water's surface. Then the plastic writes, per pixel, the light in the room's
  // frame (red), that water in metres (green), and how square it faces the viewer, or 1 for the mouth (blue).
  const THICK = new THREE.WebGLRenderTarget(BOX, BOX, { type: THREE.HalfFloatType, depthBuffer: false });
  const level = { uUp: { value: new THREE.Vector3() }, uH: { value: 0 } };
  const thickness = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, depthTest: false, depthWrite: false, uniforms: level,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: 'varying vec3 vP; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
    // Along the line of sight, depth d = -z - 5 from the room's middle; the surface is dot(p, uUp) = uH.
    // Each face adds its depth clamped to the stretch of the line below the surface, so a front and a
    // back face together add the length of water between them that is below it.
    fragmentShader: `uniform vec3 uUp; uniform float uH; varying vec3 vP;
    void main() {
      float d = -vP.z - 5.0, k = dot(vP.xy, uUp.xy) - 5.0 * uUp.z - uH, lo = -1e3, hi = 1e3;
      if (uUp.z > 1e-4) lo = k / uUp.z; else if (uUp.z < -1e-4) hi = k / uUp.z; else if (k > 0.0) lo = hi;
      float c = clamp(d, lo, hi);
      gl_FragColor = vec4(gl_FrontFacing ? -c : c, 0.0, 0.0, 1.0);
    }`,
  });
  const turn = { value: new THREE.Matrix3() }, LIT = new THREE.Vector3();
  const facts = mouth => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uThick: { value: THICK.texture }, uSize: { value: new THREE.Vector2(BOX, BOX) }, uLight: { value: LIT }, uTurn: turn, uMouth: { value: mouth } },
    vertexShader: `uniform mat3 uTurn; varying vec3 vN; varying vec3 vV;
    void main() { vN = uTurn * normal; vV = normalMatrix * normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uThick; uniform vec2 uSize; uniform vec3 uLight; uniform float uMouth; varying vec3 vN; varying vec3 vV;
    void main() {
      float side = gl_FrontFacing ? 1.0 : -1.0;
      float through = clamp(texture2D(uThick, gl_FragCoord.xy / uSize).r, 0.0, 1.0);
      float facing = clamp(normalize(vV).z * side, 0.0, 1.0);
      gl_FragColor = vec4(max(dot(normalize(vN) * side, uLight), 0.0), through, uMouth > 0.5 ? 1.0 : 0.9 * facing, 1.0);
    }`,
  });
  const MATERIALS = { plastic: facts(0), mouth: facts(1), water: thickness };

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(BOX, BOX, false);
  const scene3 = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10); camera.position.set(0, 0, 5);
  // The room, tipped toward the camera; in it, the turn about the edge the jug goes over, at the middle of the picture.
  const room = new THREE.Group(), fall = new THREE.Group();
  room.add(fall); scene3.add(room);

  const gltf = await new GLTFLoader().loadAsync(new URL('../../tmp/jug/jug.glb', import.meta.url).href);
  const jug = gltf.scene, meta = jug.getObjectByName('jug').userData, parts = [];
  fall.add(jug);
  jug.traverse(o => {
    if (!o.isMesh) return;
    const wet = o.name.startsWith('water_');
    o.material = MATERIALS[o.material.name];
    if (wet) o.layers.set(WATER);
    const rest = o.geometry.attributes.position.array.slice(), widest = new Map();
    let midY = 0;
    for (let i = 0; i < rest.length; i += 3) {
      const y = rest[i + 1].toFixed(4);
      widest.set(y, Math.max(widest.get(y) ?? 0, Math.abs(rest[i]), Math.abs(rest[i + 2])));
      midY += rest[i + 1] / (rest.length / 3);
    }
    parts.push({ o, wet, rest, widest, midY });
  });
  const boxOf = meshes => meshes.reduce((b, o) => b.union(o.geometry.boundingBox), new THREE.Box3());

  const grab = (() => {
    const c = document.createElement('canvas'); c.width = c.height = BOX;
    const g = c.getContext('2d', { willReadFrequently: true });
    return () => { g.clearRect(0, 0, BOX, BOX); g.drawImage(renderer.domElement, 0, 0); return g.getImageData(0, 0, BOX, BOX).data; };
  })();

  let look, UP, BODY, MOUTH, PIVOT, SECTION;
  const DRAWN = new Map();

  /** The warps for height, rib depth, neck width, the foot's curl and the base's recess. */
  function reshape() {
    const { H, za, zb, zs, foot, A, RN, W } = meta, grow = look.h / 100 - H, rn = look.neck / 200;
    const lift = y => (y <= za ? y : y >= zb ? y + grow : za + (y - za) * (zb - za + grow) / (zb - za));
    for (const { o, wet, rest, widest, midY } of parts) {
      const pos = o.geometry.attributes.position;
      const out = wet ? A - W : A, r0 = wet ? RN - W : RN, r1 = wet ? rn - W : rn;
      const shift = o.name === 'midrib' ? lift(midY) - midY : null;
      const base = o.name === 'base', sole = base ? A - (A - widest.get((0).toFixed(4))) * look.bevel : 0;
      for (let i = 0; i < rest.length; i += 3) {
        const y = rest[i + 1], a = widest.get(y.toFixed(4)), floor = base && y > 1e-6;
        const k = floor ? (sole - look.inset / 100) / a : y <= foot ? (A - (A - a) * look.bevel) / a
          : y <= zs ? (out + (a - out) * look.rib) / a : WHOLE.has(o.name) ? rn / RN : (out - (out - a) * (out - r1) / (out - r0)) / a;
        pos.array[i] = rest[i] * k; pos.array[i + 2] = rest[i + 2] * k;
        pos.array[i + 1] = floor ? look.recess / 100 : shift === null ? lift(y) : y + shift;
      }
      pos.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    }
  }

  function set(next) {
    look = next; DRAWN.clear();
    const half = BOX / 2 / look.pxm;
    Object.assign(camera, { left: -half, right: half, top: half, bottom: -half }); camera.updateProjectionMatrix();
    room.rotation.set(rad(look.rx), rad(look.ry), rad(look.rz), 'XYZ');
    UP = new THREE.Vector3(0, 1, 0).applyEuler(room.rotation);
    const az = rad(look.laz), el = rad(look.lel);
    LIT.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    reshape();
    const solid = parts.filter(p => !p.wet).map(p => p.o), INSIDE = boxOf(parts.filter(p => p.wet).map(p => p.o));
    BODY = boxOf(solid);
    MOUTH = solid.find(o => o.name === 'mouth').geometry.boundingBox.getCenter(new THREE.Vector3());
    // The bottom edge each fall goes over, its middle; and the inside of the jug across the fall,
    // [u0, u1, v0, v1]: u along the push and v up, from that edge.
    const mid = BODY.getCenter(new THREE.Vector3());
    PIVOT = Object.fromEntries(Object.entries(AXIS).map(([d, a]) => [d, new THREE.Vector3(
      a.x > 0 ? BODY.max.x : a.x < 0 ? BODY.min.x : mid.x, BODY.min.y, a.z > 0 ? BODY.max.z : a.z < 0 ? BODY.min.z : mid.z)]));
    SECTION = Object.fromEntries(Object.entries(AXIS).map(([d, a]) => {
      const u = [INSIDE.min, INSIDE.max].map(p => p.clone().sub(PIVOT[d]).dot(a)).sort((p, q) => p - q);
      return [d, [...u, INSIDE.min.y - BODY.min.y, INSIDE.max.y - BODY.min.y]];
    }));
  }

  /** The pixel jug from [x, y, light 0..1, cm of water seen through, facing 0..1, is the mouth] cells. */
  function pixelJug(cells) {
    const key = (x, y) => `${x},${y}`, inside = new Set(cells.map(([x, y]) => key(x, y)));
    return cells.map(([x, y, lit, cm, facing, mouth]) => {
      if (N4.some(([a, b]) => !inside.has(key(x + a, y + b)))) return [x, y, look.ink];
      if (mouth) return [x, y, look.mouth];
      const lightBand = lit * 100 < look.dark ? -1 : look.bands.filter(t => lit * 100 >= t).length;
      const b = Math.max(-1, lightBand - (facing * 100 < look.facing ? 1 : 0));
      return [x, y, cm < look.wet ? [look.shadow, look.plastic, look.fill, look.blues[2], look.blues[3]][b + 1]
        : look.blues[Math.max(0, b - (cm >= look.thick ? 1 : 0))]];
    });
  }

  /** The jug `deg` over toward `dir`, a fraction `F` of it water: its px from its top-left `x, y` in the
   *  picture, where the middle of the edge it goes over is the picture's middle, and its mouth's middle
   *  from that top-left. */
  function drawing(dir, deg, F) {
    const id = `${dir} ${deg} ${Math.round(F * 100)}`;
    if (DRAWN.has(id)) return DRAWN.get(id);
    const a = AXIS[dir], t = rad(deg);
    fall.rotation.set(a.z * t, 0, -a.x * t);
    jug.position.copy(PIVOT[dir]).negate();
    room.updateMatrixWorld(true);
    turn.value.setFromMatrix4(fall.matrix);
    const h = surface(SECTION[dir], deg, F);
    level.uUp.value.copy(UP); level.uH.value = h - 5 * UP.z;
    camera.layers.set(WATER); renderer.setRenderTarget(THICK); renderer.clear(); renderer.render(scene3, camera);
    camera.layers.set(0); renderer.setRenderTarget(null); renderer.render(scene3, camera);
    const d = grab(), cells = [];
    for (let y = 0; y < BOX; y++) for (let x = 0; x < BOX; x++) {
      const o = (y * BOX + x) * 4;
      if (d[o + 3] > 127) cells.push([x, y, d[o] / 255, d[o + 1] / 255 * 100, Math.min(1, d[o + 2] / 229.5), d[o + 2] > 242]);
    }
    const px = pixelJug(cells), x0 = Math.min(...px.map(p => p[0])), y0 = Math.min(...px.map(p => p[1]));
    const m = MOUTH.clone().applyMatrix4(jug.matrixWorld).project(camera);
    const out = { x: x0, y: y0, w: Math.max(...px.map(p => p[0])) - x0 + 1, h: Math.max(...px.map(p => p[1])) - y0 + 1,
      px: px.map(([x, y, c]) => [x - x0, y - y0, c]), mouth: [(m.x + 1) / 2 * BOX - x0, (1 - m.y) / 2 * BOX - y0] };
    DRAWN.set(id, out);
    return out;
  }

  return { set, drawing };
}
