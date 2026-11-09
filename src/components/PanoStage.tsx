"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { S, spotEls } from "./state";

export type Spot = { lon: number; lat: number };

const D2R = Math.PI / 180;

// The photo is a grid of points that are placed either on a flat 2:1 sheet
// (bend = 0) or curled toward the viewer until it closes into a sphere (bend = 1).
const vertex = /* glsl */ `
  uniform float bend;
  uniform float pop;
  uniform vec2 shift;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float lon = (uv.x - 0.5) * 6.28318530718;
    float lat = (uv.y - 0.5) * 3.14159265359;
    float m = max(bend, 0.0001);
    float r = 1.0 / m;
    float a = lat * m;
    float b = lon * m;
    vec3 p = r * vec3(cos(a) * sin(b), sin(a), -cos(a) * cos(b)) + vec3(0.0, 0.0, r);
    p.xy = p.xy * pop + shift;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D map;
  uniform float alpha;
  uniform float grid;
  uniform vec3 gridColor;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    vec2 g = vUv * vec2(24.0, 12.0);
    vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(d.x, d.y), 1.0);
    c.rgb = mix(c.rgb, gridColor, line * grid * 0.85);
    // The two short edges light up as they come round to meet.
    float seam = smoothstep(0.012, 0.0, min(vUv.x, 1.0 - vUv.x));
    c.rgb = mix(c.rgb, vec3(1.0), seam * grid);
    gl_FragColor = vec4(c.rgb, alpha);
    #include <colorspace_fragment>
  }
`;

// One panorama on the page, so its shader inputs live at module level.
const U = {
  map: { value: null as THREE.Texture | null },
  bend: { value: 0 },
  pop: { value: 1 },
  shift: { value: new THREE.Vector2() },
  alpha: { value: 0 },
  grid: { value: 0 },
  gridColor: { value: new THREE.Color("#74b94e") },
};

function Scene({ spots }: { spots: Spot[] }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const ready = useRef(false);

  const args = useMemo<[THREE.ShaderMaterialParameters]>(
    () => [
      {
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        uniforms: U,
      },
    ],
    [],
  );

  useEffect(() => {
    const big = gl.capabilities.maxTextureSize >= 8192 && window.innerWidth >= 1024;
    let tex: THREE.Texture | undefined;
    new THREE.TextureLoader().load(big ? "/tour/hero-6k.webp" : "/tour/hero-3k.webp", (t) => {
      tex = t;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      U.map.value = t;
      // Upload to the GPU now, while the visitor is still on the intro, so nothing stalls on arrival.
      gl.initTexture(t);
      gl.compile(scene, camera);
      ready.current = true;
    });
    return () => tex?.dispose();
  }, [gl, scene, camera]);

  // Where each hotspot sits on the finished sphere (centre 0,0,1, radius 1).
  const world = useMemo(
    () =>
      spots.map(({ lon, lat }) => {
        const l = lon * D2R, t = lat * D2R;
        return new THREE.Vector3(Math.cos(t) * Math.sin(l), Math.sin(t), 1 - Math.cos(t) * Math.cos(l));
      }),
    [spots],
  );
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, dt) => {
    const u = U;
    const cam = state.camera as THREE.PerspectiveCamera;
    const v = tmp.current;
    u.bend.value = S.bend;
    u.grid.value = S.grid;
    u.alpha.value = ready.current ? S.alpha : 0;

    const W = state.size.width, H = state.size.height;
    // The visible region is the editor viewport while editing and the whole stage once live.
    const viewW = THREE.MathUtils.lerp(W, S.cell.w, S.off), viewH = THREE.MathUtils.lerp(H, S.cell.h, S.off);
    const aspect = viewW / viewH;
    const want = aspect >= 1 ? 76 : Math.min(100, 2 * Math.atan(Math.tan(38 * D2R) / aspect) / D2R);
    const fovFlat = 50;
    const fovIn = Math.min(150, (2 * Math.atan(Math.tan((want / 2) * D2R) * (H / viewH))) / D2R);

    // Distance at which the flat photo fits the editor viewport.
    const ppu = Math.min((S.cell.w * 0.9) / (2 * Math.PI), (S.cell.h * 0.82) / Math.PI);
    const fitD = H / (2 * Math.tan((fovFlat / 2) * D2R) * ppu);
    // The flat photo starts on its filmstrip thumbnail and lifts into the viewport.
    const ccx = S.cell.x + S.cell.w / 2, ccy = S.cell.y + S.cell.h / 2;
    u.pop.value = THREE.MathUtils.lerp(S.thumb.w / (2 * Math.PI * ppu), 1, S.fly);
    u.shift.value.set(((S.thumb.cx - ccx) / ppu) * (1 - S.fly), (-(S.thumb.cy - ccy) / ppu) * (1 - S.fly));
    // Stay inside the curl so the camera never punches through the photo.
    const z = Math.min(THREE.MathUtils.lerp(fitD, 1, S.zoom), 1.7 / Math.max(S.bend, 0.0001));

    // Slow drift once the tour is live, paused while the visitor drags.
    if (S.live && performance.now() - S.lastDrag > 2600) S.dragYaw += dt * 2.2;

    cam.position.set(0, 0, z);
    cam.rotation.set((S.pitch + S.dragPitch) * D2R, -(S.yaw + S.dragYaw) * D2R, 0, "YXZ");
    cam.fov = THREE.MathUtils.lerp(fovFlat, fovIn, S.zoom);
    cam.setViewOffset(W, H, (W / 2 - ccx) * S.off, (H / 2 - ccy) * S.off, W, H);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    for (let i = 0; i < world.length; i++) {
      const el = spotEls[i];
      if (!el) continue;
      v.copy(world[i]).applyMatrix4(cam.matrixWorldInverse);
      if (v.z > -0.05) {
        el.style.visibility = "hidden";
        continue;
      }
      v.applyMatrix4(cam.projectionMatrix);
      el.style.visibility = "visible";
      el.style.transform = `translate3d(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px, 0)`;
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1, 180, 90]} />
      <shaderMaterial args={args} />
    </mesh>
  );
}

// `active` is false while the section is off screen or the page is still gliding to it,
// so the 3D scene never competes with scrolling for frames.
export default function PanoStage({ spots, active }: { spots: Spot[]; active: boolean }) {
  return (
    <Canvas
      flat
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 50, near: 0.01, far: 200, position: [0, 0, 6] }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Scene spots={spots} />
    </Canvas>
  );
}
