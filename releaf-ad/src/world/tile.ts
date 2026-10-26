// Płyta dnia: cienka bryła o dowolnym czworokątnym kształcie (kwadrat ↔ anamorficzny czworokąt ↔ prostokąt karty).
import * as THREE from 'three';
import { C } from '../brand/palette';
import { faceMaterial, flatMaterial } from './materials';
import type { Shape4 } from './layout';

export class Tile {
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  face: THREE.ShaderMaterial;
  back: THREE.ShaderMaterial;
  side: THREE.ShaderMaterial;
  private pos = new Float32Array(36 * 3);
  private nor = new Float32Array(36 * 3);

  constructor(numTex: THREE.Texture, rect: THREE.Vector4, poster: THREE.Texture, logo: THREE.Texture, frontWorld: THREE.Vector3[]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    const uv = new Float32Array(36 * 2);
    const fin = new Float32Array(36 * 3);
    const FRONT = [0, 1, 2, 0, 2, 3];
    const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
    FRONT.forEach((k, v) => {
      uv.set(UV[k], v * 2);
      fin.set([frontWorld[k].x, frontWorld[k].y, frontWorld[k].z], v * 3);
    });
    geo.setAttribute('uvReg', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('finalPos', new THREE.BufferAttribute(fin, 3));
    geo.addGroup(0, 6, 0);
    geo.addGroup(6, 6, 1);
    geo.addGroup(12, 24, 2);
    this.geo = geo;
    this.face = faceMaterial(numTex, rect, poster, logo);
    this.back = flatMaterial(C.surface, 0.06);
    this.side = flatMaterial(C.tealDeep, 0.2);
    this.mesh = new THREE.Mesh(geo, [this.face, this.back, this.side]);
    this.mesh.frustumCulled = false;
  }

  setShape(shape: Shape4, th: number) {
    const z = th / 2;
    const F = shape.map(([x, y]) => new THREE.Vector3(x, y, z));
    const B = shape.map(([x, y]) => new THREE.Vector3(x, y, -z));
    let v = 0;
    const put = (p: THREE.Vector3, n: THREE.Vector3) => {
      this.pos.set([p.x, p.y, p.z], v * 3);
      this.nor.set([n.x, n.y, n.z], v * 3);
      v++;
    };
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3) => {
      // nawinięcie zgodne z normalną (żeby gl_FrontFacing był wiarygodny)
      const cr = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (cr.dot(n) < 0) { put(a, n); put(c, n); put(b, n); } else { put(a, n); put(b, n); put(c, n); }
    };
    const nF = new THREE.Vector3(0, 0, 1), nB = new THREE.Vector3(0, 0, -1);
    // przód: kolejność wierzchołków musi pasować do uvReg/finalPos (0,1,2,0,2,3)
    put(F[0], nF); put(F[1], nF); put(F[2], nF); put(F[0], nF); put(F[2], nF); put(F[3], nF);
    tri(B[0], B[2], B[1], nB); tri(B[0], B[3], B[2], nB);
    for (let k = 0; k < 4; k++) {
      const a = F[k], b = F[(k + 1) % 4], c = B[(k + 1) % 4], d = B[k];
      const e = new THREE.Vector3().subVectors(b, a);
      const n = new THREE.Vector3(e.y, -e.x, 0).normalize();
      tri(a, d, c, n); tri(a, c, b, n);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
  }

  setLit(face: number, rest = face) {
    this.face.uniforms.uLit.value = face;
    this.back.uniforms.uLit.value = rest;
    this.side.uniforms.uLit.value = rest;
  }
  setDim(d: number) {
    this.face.uniforms.uDim.value = d;
    this.back.uniforms.uDim.value = d;
    this.side.uniforms.uDim.value = d;
  }
}
