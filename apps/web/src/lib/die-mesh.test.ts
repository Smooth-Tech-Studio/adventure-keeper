import { describe, expect, it } from "vitest";

import { DIE_SIDES, dieMesh, faceUpQuat, qMat, rotate, type DieKind } from "./die-mesh";

const KINDS: DieKind[] = ["d4", "d6", "d8", "d10", "d12", "d20"];

describe("dieMesh", () => {
  it.each(KINDS)("%s has one face per side and values 1..sides", (kind) => {
    const mesh = dieMesh(kind);
    const sides = DIE_SIDES[kind];
    expect(mesh.faces).toHaveLength(sides);
    expect(mesh.faceNormals).toHaveLength(sides);
    expect([...mesh.faceValue].sort((a, b) => a - b)).toEqual(
      Array.from({ length: sides }, (_, i) => i + 1),
    );
  });

  it.each(KINDS)("%s has unit-length outward normals", (kind) => {
    for (const n of dieMesh(kind).faceNormals) {
      expect(Math.hypot(...n)).toBeCloseTo(1, 5);
    }
  });

  it.each(["d6", "d8", "d10", "d12", "d20"] as DieKind[])(
    "%s numbers opposite faces to sum to sides + 1",
    (kind) => {
      const mesh = dieMesh(kind);
      const sides = DIE_SIDES[kind];
      mesh.faceNormals.forEach((n, i) => {
        let opp = i;
        let best = 1;
        mesh.faceNormals.forEach((m, j) => {
          if (j === i) return;
          const d = n[0] * m[0] + n[1] * m[1] + n[2] * m[2];
          if (d < best) {
            best = d;
            opp = j;
          }
        });
        expect(mesh.faceValue[i] + mesh.faceValue[opp]).toBe(sides + 1);
      });
    },
  );

  it("caches the mesh instance", () => {
    expect(dieMesh("d20")).toBe(dieMesh("d20"));
  });
});

describe("faceUpQuat", () => {
  it.each(KINDS)("%s turns any value's face toward the camera (+Z, minus a rest tilt)", (kind) => {
    const mesh = dieMesh(kind);
    for (let value = 1; value <= DIE_SIDES[kind]; value++) {
      const fi = mesh.faceValue.indexOf(value);
      const z = rotate(mesh.faceNormals[fi], qMat(faceUpQuat(mesh, value, value)))[2];
      // > 0.9: still clearly the front face, allowing for the fixed rest tilt.
      expect(z).toBeGreaterThan(0.9);
    }
  });
});
