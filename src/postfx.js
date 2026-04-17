import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Custom final grade: chromatic aberration + vignette + subtle grain.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime:    { value: 0 },
    uChroma:  { value: 0.0012 },
    uVignette:{ value: 1.05 },   // stronger vignette = darker edges
    uGrain:   { value: 0.035 },
    uFade:    { value: 1.0 },    // 1 = full image, 0 = black
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChroma;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uFade;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float d = length(dir);

      // Chromatic aberration scales with radial distance.
      float amt = uChroma * (0.4 + 2.0 * d);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * amt).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * amt).b;

      // Soft vignette.
      float vig = smoothstep(0.95, 0.25, d);
      col *= mix(1.0 - uVignette, 1.0, vig);

      // Film grain.
      float g = hash(uv * vec2(1024.0, 768.0) + uTime);
      col += (g - 0.5) * uGrain;

      // Slight lift of blacks so deep space feels velvety, not crushed.
      col = col * 0.98 + vec3(0.008, 0.006, 0.014);

      // Global fade to black for cinematic transitions.
      col *= uFade;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35,   // strength — tuned low so only bright landmarks glow
    0.55,   // radius
    0.78,   // threshold — very high, nebula + dust stay below it
  );
  composer.addPass(bloom);

  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return { composer, bloom, gradePass };
}
