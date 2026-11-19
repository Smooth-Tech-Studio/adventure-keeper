/**
 * Convex polyhedra + quaternion helpers for the animated dice in the dice tray.
 * Pure geometry, no rendering. The d20 icosahedron was ported from a standalone
 * canvas prototype; the other solids are built the same way (origin-centred,
 * scaled to circumradius 1, numbered so opposite faces sum to `sides + 1`).
 */

const PHI = (1 + Math.sqrt(5)) / 2;

export type Vec3 = [number, number, number];
/** `[w, x, y, z]` unit quaternion. */
export type Quat = [number, number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export type DieKind = "d4" | "d6" | "d8" | "d10" | "d12" | "d20";

export const DIE_SIDES: Record<DieKind, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
};

export interface DieMesh {
  kind: DieKind;
  sides: number;
  /** Vertices on / within the unit sphere. */
  vertices: Vec3[];
  /** Faces as ordered vertex-index loops (triangles up to pentagons). */
  faces: number[][];
  /** Outward unit normal of each face. */
  faceNormals: Vec3[];
  /** The number printed on each face. */
  faceValue: number[];
  /** Glyph size as a fraction of the die radius. */
  glyphScale: number;
  /** Extra scale on the draw radius so kinds look consistent side by side. */
  renderScale: number;
}

// --- vector helpers -------------------------------------------------------

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const norm = (v: Vec3): Vec3 => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// --- raw solids --------------------------------------------------------

interface RawSolid {
  vertices: Vec3[];
  faces: number[][];
}

function tetrahedron(): RawSolid {
  return {
    vertices: [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ],
    faces: [
      [1, 2, 3],
      [0, 3, 2],
      [0, 1, 3],
      [0, 2, 1],
    ],
  };
}

function cube(): RawSolid {
  return {
    vertices: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
    faces: [
      [1, 2, 6, 5], // +x
      [0, 4, 7, 3], // -x
      [3, 7, 6, 2], // +y
      [0, 1, 5, 4], // -y
      [4, 5, 6, 7], // +z
      [0, 3, 2, 1], // -z
    ],
  };
}

function octahedron(): RawSolid {
  return {
    vertices: [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
    faces: [
      [0, 2, 4],
      [2, 1, 4],
      [1, 3, 4],
      [3, 0, 4],
      [2, 0, 5],
      [1, 2, 5],
      [3, 1, 5],
      [0, 3, 5],
    ],
  };
}

const ICO_VERTICES: Vec3[] = (
  [
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ] as Vec3[]
).map(norm);

const ICO_FACES: number[][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

function icosahedron(): RawSolid {
  return { vertices: ICO_VERTICES.map((v) => [...v] as Vec3), faces: ICO_FACES.map((f) => [...f]) };
}

/** Dodecahedron as the dual of the icosahedron: its 20 vertices are the icosa
 *  face centres; each of its 12 faces rings the icosa faces around one icosa
 *  vertex. */
function dodecahedron(): RawSolid {
  const centres: Vec3[] = ICO_FACES.map((f) => {
    const c: Vec3 = [0, 0, 0];
    for (const k of f) {
      c[0] += ICO_VERTICES[k][0];
      c[1] += ICO_VERTICES[k][1];
      c[2] += ICO_VERTICES[k][2];
    }
    return norm(c);
  });

  const faces: number[][] = [];
  for (let iv = 0; iv < 12; iv++) {
    const ring = ICO_FACES.map((f, fi) => ({ fi, in: f.includes(iv) }))
      .filter((o) => o.in)
      .map((o) => o.fi);
    const axis = ICO_VERTICES[iv];
    const first = centres[ring[0]];
    const u = norm([
      first[0] - axis[0] * dot3(first, axis),
      first[1] - axis[1] * dot3(first, axis),
      first[2] - axis[2] * dot3(first, axis),
    ]);
    const w = cross3(axis, u);
    ring.sort(
      (a, b) =>
        Math.atan2(dot3(centres[a], w), dot3(centres[a], u)) -
        Math.atan2(dot3(centres[b], w), dot3(centres[b], u)),
    );
    faces.push(ring);
  }
  return { vertices: centres, faces };
}

/** Pentagonal trapezohedron: two apexes + two offset rings of five, ten kite
 *  faces — the classic d10 shape. */
function trapezohedron(): RawSolid {
  const ringZ = 0.32;
  const apexZ = 1.05;
  const vertices: Vec3[] = [
    [0, 0, apexZ],
    [0, 0, -apexZ],
  ];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    vertices.push([Math.cos(a), Math.sin(a), ringZ]);
  }
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 + 36) * Math.PI) / 180;
    vertices.push([Math.cos(a), Math.sin(a), -ringZ]);
  }
  const upper = (i: number) => 2 + (i % 5);
  const lower = (i: number) => 7 + (i % 5);
  const faces: number[][] = [];
  for (let i = 0; i < 5; i++) {
    faces.push([0, upper(i), lower(i), upper(i + 1)]);
    faces.push([1, lower(i), upper(i + 1), lower(i + 1)]);
  }
  return { vertices, faces };
}

// --- assembly --------------------------------------------------------

/** Number the faces so geometric opposites sum to `sides + 1` (a real die). */
function opposedValues(normals: Vec3[], sides: number): number[] {
  const value = new Array<number>(sides).fill(0);
  let next = 1;
  for (let i = 0; i < sides; i++) {
    if (value[i]) continue;
    let opp = i;
    let best = 1;
    for (let j = 0; j < sides; j++) {
      if (j === i || value[j]) continue;
      const d = dot3(normals[i], normals[j]);
      if (d < best) {
        best = d;
        opp = j;
      }
    }
    value[i] = next;
    value[opp] = sides + 1 - next;
    next++;
  }
  return value;
}

const GLYPH: Record<DieKind, number> = {
  d4: 0.42,
  d6: 0.52,
  d8: 0.4,
  d10: 0.32,
  d12: 0.3,
  d20: 0.3,
};
const RENDER: Record<DieKind, number> = {
  d4: 1.28,
  d6: 1.08,
  d8: 1.16,
  d10: 1.08,
  d12: 0.98,
  d20: 1,
};

function build(kind: DieKind, raw: RawSolid): DieMesh {
  const maxR = Math.max(...raw.vertices.map(len));
  const vertices = raw.vertices.map((v) => [v[0] / maxR, v[1] / maxR, v[2] / maxR] as Vec3);
  const faceNormals = raw.faces.map((f) => {
    const c: Vec3 = [0, 0, 0];
    for (const k of f) {
      c[0] += vertices[k][0];
      c[1] += vertices[k][1];
      c[2] += vertices[k][2];
    }
    return norm(c);
  });
  const faceValue = kind === "d4" ? [1, 2, 3, 4] : opposedValues(faceNormals, raw.faces.length);
  return {
    kind,
    sides: DIE_SIDES[kind],
    vertices,
    faces: raw.faces,
    faceNormals,
    faceValue,
    glyphScale: GLYPH[kind],
    renderScale: RENDER[kind],
  };
}

const RAW: Record<DieKind, () => RawSolid> = {
  d4: tetrahedron,
  d6: cube,
  d8: octahedron,
  d10: trapezohedron,
  d12: dodecahedron,
  d20: icosahedron,
};

const CACHE = new Map<DieKind, DieMesh>();

/** The mesh for a die kind (built once, then cached). */
export function dieMesh(kind: DieKind): DieMesh {
  let mesh = CACHE.get(kind);
  if (!mesh) {
    mesh = build(kind, RAW[kind]());
    CACHE.set(kind, mesh);
  }
  return mesh;
}

// --- roll emphasis --------------------------------------------------------

/** Crit / fail highlight for a rolled die — drives the tray's reveal flourish. */
export type Emphasis = "crit" | "fail" | null;

/** A discarded die (advantage / disadvantage) never celebrates. */
export function emphasisFor(die: { kind: DieKind; value: number; faded?: boolean }): Emphasis {
  if (die.faded) return null;
  if (die.value === dieMesh(die.kind).sides) return "crit";
  if (die.value === 1 && (die.kind === "d20" || die.kind === "d12")) return "fail";
  return null;
}

// --- quaternions --------------------------------------------------------

export const qMul = (a: Quat, b: Quat): Quat => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];

export const qNorm = (q: Quat): Quat => {
  const l = Math.hypot(...q) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};

export function qAxis(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  const l = len(axis) || 1;
  return [Math.cos(angle / 2), (axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s];
}

export function qMat(q: Quat): Mat3 {
  const [w, x, y, z] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}

/** Shortest-path spherical interpolation between two orientations. */
export function qSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) {
    b = [-b[0], -b[1], -b[2], -b[3]];
    d = -d;
  }
  if (d > 0.9995) {
    return qNorm([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t,
    ]);
  }
  const th = Math.acos(d);
  const s = Math.sin(th);
  const w1 = Math.sin((1 - t) * th) / s;
  const w2 = Math.sin(t * th) / s;
  return [
    a[0] * w1 + b[0] * w2,
    a[1] * w1 + b[1] * w2,
    a[2] * w1 + b[2] * w2,
    a[3] * w1 + b[3] * w2,
  ];
}

export function rotate(v: Vec3, m: Mat3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** A gentle fixed tilt applied at rest so flat-faced dice (d6, d8…) still read
 *  as 3D solids instead of a flat polygon straight on. */
const REST_TILT: Quat = qNorm(qMul(qAxis([1, 0, 0], -0.26), qAxis([0, 1, 0], 0.2)));

/**
 * Orientation that brings the face showing `value` toward the camera (+Z, then
 * a slight rest tilt), with an optional in-plane `spin` so repeated rolls of the
 * same number don't land identically.
 */
export function faceUpQuat(mesh: DieMesh, value: number, spin = 0): Quat {
  const fi = Math.max(0, mesh.faceValue.indexOf(value));
  const n = mesh.faceNormals[fi];
  const ax: Vec3 = [n[1], -n[0], 0]; // cross(n, +Z)
  const d = Math.max(-1, Math.min(1, n[2]));
  const q: Quat =
    Math.hypot(...ax) < 1e-6 ? (d > 0 ? [1, 0, 0, 0] : [0, 1, 0, 0]) : qAxis(ax, Math.acos(d));
  return qNorm(qMul(REST_TILT, qMul(qAxis([0, 0, 1], spin), q)));
}
