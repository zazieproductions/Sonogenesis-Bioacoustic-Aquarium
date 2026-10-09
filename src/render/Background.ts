import * as THREE from 'three';
import type { HabitatParams } from '../sim/habitats';

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uCam;
uniform float uZoom;
uniform float uZoneW;
uniform float uWorldH;
uniform int uZones;
uniform vec3 uCol[6];
uniform vec3 uCol2[6];
uniform float uLight[6];
uniform float uStatic[6];
uniform float uLevel;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5;} return v; }

void main(){
  vec2 frag = vUv * uRes;
  vec2 wp = uCam + (frag - uRes*0.5) / uZoom * vec2(1.0,-1.0);
  float zf = wp.x / uZoneW;
  vec3 c1 = vec3(0.0); vec3 c2 = vec3(0.0); float light = 0.0; float stat = 0.0; float wsum = 0.0;
  for (int i=0;i<6;i++){
    if (i >= uZones) break;
    float center = float(i) + 0.5;
    float d = abs(zf - center);
    float w = 1.0 - smoothstep(0.42, 0.62, d);
    if (i == 0 && zf < 0.5) w = 1.0;
    if (i == uZones-1 && zf > center) w = 1.0;
    c1 += uCol[i]*w; c2 += uCol2[i]*w; light += uLight[i]*w; stat += uStatic[i]*w; wsum += w;
  }
  c1 /= max(wsum, 0.001); c2 /= max(wsum, 0.001); light /= max(wsum,0.001); stat /= max(wsum,0.001);
  vec2 p = wp * 0.004;
  float t = uTime * 0.04;
  float n = fbm(p + vec2(t, -t*0.7));
  float n2 = fbm(p*2.3 - vec2(t*1.3, t*0.4) + n);
  // caustics
  float ca = pow(abs(sin(n2*12.0 + uTime*0.6)), 18.0) * light;
  // volumetric shafts from top
  float yN = clamp(wp.y / uWorldH, 0.0, 1.0);
  float shaft = pow(max(0.0, sin(wp.x*0.006 + n*3.0 + uTime*0.05)), 8.0) * (1.0 - yN) * light * 0.5;
  vec3 col = c1 + c2 * (n2*n2*0.28 + ca*0.25 + shaft*0.35) * (0.8 + uLevel*1.5);
  // static flicker
  float sl = step(0.985 - stat*0.02, hash(vec2(floor(wp.y*0.25), floor(uTime*14.0)))) * stat;
  col += c2 * sl * 0.12 * hash(vec2(floor(wp.x*0.05), floor(uTime*20.0)));
  // marine snow
  vec2 sp = wp * 0.05 + vec2(0.0, uTime*0.3);
  vec2 cell = floor(sp);
  float h = hash(cell);
  vec2 off = vec2(hash(cell+3.1), hash(cell+7.7));
  float dd = length(fract(sp) - off);
  col += vec3(0.6,0.75,0.9) * smoothstep(0.06, 0.0, dd) * step(0.82, h) * 0.25;
  // outside world bounds
  float outside = step(wp.y, 0.0) + step(uWorldH, wp.y) + step(wp.x, 0.0) + step(float(uZones)*uZoneW, wp.x);
  col *= outside > 0.0 ? 0.25 : 1.0;
  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q,q)*1.1;
  col += (hash(frag + uTime) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class Background {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.ShaderMaterial;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
    const v3 = () => Array.from({ length: 6 }, () => new THREE.Vector3());
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uCam: { value: new THREE.Vector2() },
        uZoom: { value: 1 }, uZoneW: { value: 760 }, uWorldH: { value: 900 }, uZones: { value: 5 },
        uCol: { value: v3() }, uCol2: { value: v3() }, uLight: { value: new Array(6).fill(0) },
        uStatic: { value: new Array(6).fill(0) }, uLevel: { value: 0 },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w * pr, h * pr);
  }

  render(time: number, camX: number, camY: number, zoom: number, zones: HabitatParams[], zoneW: number, worldH: number, level: number) {
    const u = this.mat.uniforms;
    const pr = this.renderer.getPixelRatio();
    u.uTime.value = time;
    // uCam in world coordinates; shader flips Y (gl origin bottom-left)
    (u.uCam.value as THREE.Vector2).set(camX, camY);
    u.uZoom.value = zoom * pr;
    u.uZoneW.value = zoneW;
    u.uWorldH.value = worldH;
    u.uZones.value = zones.length;
    u.uLevel.value = Math.min(1, level * 4);
    zones.forEach((z, i) => {
      (u.uCol.value as THREE.Vector3[])[i].set(...z.color);
      (u.uCol2.value as THREE.Vector3[])[i].set(...z.color2);
      (u.uLight.value as number[])[i] = z.light;
      (u.uStatic.value as number[])[i] = z.instability;
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
