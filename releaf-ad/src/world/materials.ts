// Materiały: własne shadery. Kolory liczone w przestrzeni wyświetlania (1:1 z CSS), więc płyta z uLit = 0
// ma dokładnie ten sam kolor co element HTML — podmiany 3D ↔ HTML są niewidoczne.
import * as THREE from 'three';

// Kolory hex mają trafiać do shadera bez konwersji sRGB → liniowe (wyjście też bez konwersji)
THREE.ColorManagement.enabled = false;

export const shared = {
  uLightDir: { value: new THREE.Vector3(-0.4, 0.7, 0.6).normalize() },
  uFillDir: { value: new THREE.Vector3(0.6, -0.3, -0.7).normalize() },
  uFogColor: { value: new THREE.Color('#0E181B') },
  uFog: { value: new THREE.Vector2(30, 90) },
  uCamPos: { value: new THREE.Vector3() },
  uStarVP: { value: new THREE.Matrix4() },
  uGlobalDim: { value: 0 },
};

const LIGHT = /* glsl */ `
  uniform vec3 uLightDir; uniform vec3 uFillDir; uniform vec3 uFogColor; uniform vec2 uFog; uniform vec3 uCamPos;
  uniform float uLit; uniform float uDim; uniform float uGlobalDim; uniform float uSpec; uniform vec2 uAmbKey;
  varying vec3 vNormalW; varying vec3 vWorld; varying float vDepth;
  vec3 shade(vec3 base) {
    vec3 n = normalize(vNormalW);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(uCamPos - vWorld);
    float key = max(dot(n, uLightDir), 0.0);
    float fill = max(dot(n, uFillDir), 0.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 h = normalize(uLightDir + v);
    float spec = pow(max(dot(n, h), 0.0), 60.0) * uSpec;
    vec3 lit = base * (uAmbKey.x + uAmbKey.y * key) + vec3(0.23, 0.55, 0.62) * (0.10 * fill + 0.10 * rim) + spec;
    vec3 c = mix(base, lit, uLit);
    float f = smoothstep(uFog.x, uFog.y, vDepth);
    c = mix(c, uFogColor, f);
    return mix(c, uFogColor, clamp(uDim + uGlobalDim, 0.0, 1.0));
  }
`;
const VERT = /* glsl */ `
  attribute vec2 uvReg; attribute vec3 finalPos;
  uniform mat4 uStarVP;
  varying vec3 vNormalW; varying vec3 vWorld; varying float vDepth; varying vec2 vUv; varying vec4 vStar;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vUv = uvReg;
    vStar = uStarVP * vec4(finalPos, 1.0);
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const base = (extra: Record<string, THREE.IUniform>) => ({
  uLightDir: shared.uLightDir, uFillDir: shared.uFillDir, uFogColor: shared.uFogColor, uFog: shared.uFog,
  uCamPos: shared.uCamPos, uStarVP: shared.uStarVP, uGlobalDim: shared.uGlobalDim,
  uLit: { value: 1 }, uDim: { value: 0 }, uSpec: { value: 0.12 }, uAmbKey: { value: new THREE.Vector2(0.66, 0.5) },
  ...extra,
});

// Jednolity kolor (boki, tył płyt, litery)
export const flatMaterial = (color: string, spec = 0.12, amb = 0.66, key = 0.5) =>
  new THREE.ShaderMaterial({
    uniforms: base({ uColor: { value: new THREE.Color(color) }, uSpec: { value: spec }, uAmbKey: { value: new THREE.Vector2(amb, key) } }),
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      ${LIGHT}
      void main() { gl_FragColor = vec4(shade(uColor), 1.0); }
    `,
    side: THREE.DoubleSide,
  });

// Przednia ściana płyty dnia: kartka z numerem ↔ logo ↔ fragment plakatu (mapowanie projekcyjne z C*)
export const faceMaterial = (numTex: THREE.Texture, rect: THREE.Vector4, poster: THREE.Texture, logo: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: base({
      uNumTex: { value: numTex }, uNumRect: { value: rect }, uPoster: { value: poster }, uLogoTex: { value: logo },
      uLogo: { value: 0 }, uPosterMix: { value: 0 }, uTint: { value: new THREE.Color('#1A2B30') }, uTintMix: { value: 0 },
    }),
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNumTex; uniform vec4 uNumRect; uniform sampler2D uPoster; uniform sampler2D uLogoTex;
      uniform float uLogo; uniform float uPosterMix; uniform vec3 uTint; uniform float uTintMix;
      varying vec2 vUv; varying vec4 vStar;
      ${LIGHT}
      void main() {
        vec3 c = texture2D(uNumTex, uNumRect.xy + clamp(vUv, 0.002, 0.998) * uNumRect.zw).rgb;
        if (uLogo > 0.0) c = mix(c, texture2D(uLogoTex, vUv).rgb, uLogo);
        if (uPosterMix > 0.0) {
          vec2 sp = vStar.xy / vStar.w * 0.5 + 0.5;
          c = mix(c, texture2D(uPoster, sp).rgb, uPosterMix);
        }
        c = mix(c, uTint, uTintMix);
        gl_FragColor = vec4(shade(c), 1.0);
      }
    `,
    side: THREE.FrontSide,
  });
