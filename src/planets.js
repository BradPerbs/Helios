import * as THREE from 'three';

// Procedural solar-system planets with extra detail: atmosphere halos,
// emissive surface features (lava cracks, city lights), independently-
// rotating cloud layers, and banded ring systems.
//
// Sizes are tuned so the ~2.4-unit spaceship feels tiny next to the gas
// giants. Distances are spread out so some are close to the spawn and
// others sit deep in the nebula.
export function createPlanets() {
  const group = new THREE.Group();

  // ---- Sun + system key light ---------------------------------------------
  const sunPos = new THREE.Vector3(380, 220, -600);
  const sunLight = new THREE.DirectionalLight(0xfff0cc, 2.6);
  sunLight.position.copy(sunPos);
  group.add(sunLight);

  const ambient = new THREE.AmbientLight(0x1e2540, 0.5);
  group.add(ambient);

  const sunMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(4.0, 3.0, 1.6),
    toneMapped: false,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 48), sunMat);
  sun.position.copy(sunPos);
  group.add(sun);

  // Sun corona halo — a larger, soft additive shell.
  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(150, 48, 32),
    makeHaloMaterial({ color: 0xffcc66, power: 3.0, intensity: 1.8 }),
  );
  sun.add(corona);

  // ---- Planet definitions --------------------------------------------------
  const defs = [
    {
      name: 'earth',   radius: 24,  pos: [ 110, 8, -90],
      palette: ['#0a2550', '#184a88', '#2e7ac0', '#2a7236', '#8a6f3a', '#cfbb7c'],
      clouds: true, atmosphere: '#6fbaff', atmoPower: 2.2,
      nightLights: true,
    },
    {
      name: 'mars',    radius: 16,  pos: [-130, -12,  -30],
      palette: ['#4a160a', '#9a3c16', '#c86430', '#e0824a', '#6a2212'],
      atmosphere: '#ff8a55', atmoPower: 4.0, atmoIntensity: 0.4,
    },
    {
      name: 'jupiter', radius: 95,  pos: [ 340, 40, -440],
      palette: ['#7a4a22', '#a06838', '#c8a06b', '#e8c894', '#f0d8b0', '#4a2a12'],
      bands: true, bandDensity: 44, storm: true,
      atmosphere: '#e8b070', atmoPower: 2.8, atmoIntensity: 0.7,
    },
    {
      name: 'saturn',  radius: 72,  pos: [-420, -80, -560],
      palette: ['#b89858', '#d8c090', '#e8d0a0', '#f0dcae', '#96754a'],
      bands: true, bandDensity: 26, rings: true, ringDetail: 'saturn',
      atmosphere: '#e8d098', atmoPower: 3.0, atmoIntensity: 0.5,
    },
    {
      name: 'neptune', radius: 40,  pos: [ 620, -140, -980],
      palette: ['#081f6c', '#1a4ab8', '#3a78d8', '#6aa0e8', '#b0d0f0'],
      bands: true, bandDensity: 18, storm: true, stormColor: '#0a1a4a',
      atmosphere: '#4a8aea', atmoPower: 2.4, atmoIntensity: 0.9,
    },
    {
      name: 'venus',   radius: 20,  pos: [-80, 60, 160],
      palette: ['#8a5022', '#c88c40', '#e8c074', '#f0d8a4', '#6a3812'],
      bands: true, bandDensity: 12,
      atmosphere: '#f0c078', atmoPower: 1.8, atmoIntensity: 1.0,
    },
    {
      name: 'moon',    radius: 7, pos: [ 160, 22, 10],
      palette: ['#6a6660', '#aaa8a0', '#7a7872', '#4a4843'],
      craters: true,
    },
    {
      name: 'ice',     radius: 48,  pos: [-780, 110, -1120],
      palette: ['#b8d8ea', '#e0f0ff', '#7aa8d4', '#d0e8f8', '#4a78a0'],
      bands: true, bandDensity: 10, rings: true, ringDetail: 'thin',
      atmosphere: '#c0e0ff', atmoPower: 2.0, atmoIntensity: 1.0,
    },
    {
      name: 'lava',    radius: 30,  pos: [ 480, -40, 220],
      palette: ['#0a0202', '#2a0804', '#5a1208', '#0e0303'],
      lavaCracks: true,
      atmosphere: '#ff4a14', atmoPower: 2.6, atmoIntensity: 1.4,
    },
  ];

  const planets = [];
  for (const def of defs) {
    const planet = makePlanet(def);
    planet.mesh.position.set(...def.pos);
    group.add(planet.mesh);
    planets.push({
      mesh: planet.mesh,
      clouds: planet.clouds,
      rotationSpeed: 0.015 + Math.random() * 0.04,
      cloudSpeed: 0.005 + Math.random() * 0.012,
    });
  }

  return { group, planets, sun };
}

// --------------------------------------------------------------------------
function makePlanet(def) {
  const { radius, palette, lavaCracks = false, nightLights = false } = def;
  const surface = makePlanetTexture(def);
  const emissive = lavaCracks
    ? makeLavaEmissive(palette)
    : nightLights
      ? makeNightLights()
      : null;

  const matOpts = {
    map: surface,
    roughness: lavaCracks ? 0.7 : 0.88,
    metalness: 0.0,
  };
  if (emissive) {
    matOpts.emissiveMap = emissive;
    matOpts.emissive = new THREE.Color(lavaCracks ? 0xff5020 : 0xffd28c);
    matOpts.emissiveIntensity = lavaCracks ? 3.2 : 1.2;
  }
  const mat = new THREE.MeshStandardMaterial(matOpts);
  const geo = new THREE.SphereGeometry(radius, 128, 80);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = (Math.random() - 0.5) * 0.4;
  mesh.rotation.y = Math.random() * Math.PI * 2;

  let cloudMesh = null;
  if (def.clouds) {
    cloudMesh = makeCloudLayer(radius);
    mesh.add(cloudMesh);
  }

  if (def.atmosphere) {
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.12, 96, 64),
      makeHaloMaterial({
        color: def.atmosphere,
        power: def.atmoPower || 2.5,
        intensity: def.atmoIntensity || 0.8,
      }),
    );
    mesh.add(atmo);
  }

  if (def.rings) {
    mesh.add(makeRings(radius, def.ringDetail || 'saturn'));
  }

  return { mesh, clouds: cloudMesh };
}

// --------------------------------------------------------------------------
function makePlanetTexture({ palette, bands = false, bandDensity = 18, craters = false, storm = false, stormColor, lavaCracks = false }) {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, palette[0]);
  grad.addColorStop(0.5, palette[Math.min(1, palette.length - 1)]);
  grad.addColorStop(1.0, palette[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (bands) {
    for (let i = 0; i < bandDensity * 3; i++) {
      const y = Math.random() * H;
      const h = 3 + Math.random() * (H / bandDensity);
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.fillRect(0, y, W, h);

      // Wavy turbulence streaks.
      ctx.strokeStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.globalAlpha = 0.1 + Math.random() * 0.25;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const yWave = y + h / 2;
      for (let x = 0; x <= W; x += 18) {
        const wave = Math.sin(x * 0.02 + i) * 3;
        if (x === 0) ctx.moveTo(x, yWave + wave);
        else ctx.lineTo(x, yWave + wave);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const blobs = 220 + Math.floor(Math.random() * 140);
  for (let i = 0; i < blobs; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 6 + Math.random() * 80;
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
    ctx.globalAlpha = 0.08 + Math.random() * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (storm) {
    // Great-Red-Spot style oval storm feature.
    const sx = 0.25 * W + Math.random() * 0.5 * W;
    const sy = 0.35 * H + Math.random() * 0.3 * H;
    const sw = 80 + Math.random() * 80;
    const sh = sw * 0.5;
    const c = stormColor || '#bb3318';
    const rg = ctx.createRadialGradient(sx, sy, 2, sx, sy, sw);
    rg.addColorStop(0, c);
    rg.addColorStop(0.6, c + 'aa');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (craters) {
    for (let i = 0; i < 320; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 2 + Math.random() * 18;
      ctx.fillStyle = '#1a1a1a';
      ctx.globalAlpha = 0.35 + Math.random() * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d0d0c8';
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (lavaCracks) {
    // Dark crust with subtle grey veining — the glow goes on the emissive map.
    ctx.strokeStyle = '#3a1108';
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 60; i++) {
      drawCrack(ctx, Math.random() * W, Math.random() * H, 60 + Math.random() * 200);
    }
    ctx.globalAlpha = 1;
  }

  // Noise pass.
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i]   = clamp(img.data[i]   + n);
    img.data[i+1] = clamp(img.data[i+1] + n);
    img.data[i+2] = clamp(img.data[i+2] + n);
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

function drawCrack(ctx, x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  let a = Math.random() * Math.PI * 2;
  let dist = 0;
  while (dist < len) {
    const step = 4 + Math.random() * 8;
    a += (Math.random() - 0.5) * 0.8;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    ctx.lineTo(x, y);
    dist += step;
    if (Math.random() < 0.08 && dist < len * 0.7) {
      // fork
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      let fa = a + (Math.random() - 0.5) * 1.2;
      for (let j = 0; j < 8; j++) {
        fa += (Math.random() - 0.5) * 0.6;
        x += Math.cos(fa) * (3 + Math.random() * 5);
        y += Math.sin(fa) * (3 + Math.random() * 5);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
}

// Lava emissive map: bright glowing cracks on black.
function makeLavaEmissive(palette) {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // Glow pass (wide blurry cracks).
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#ff5020';
  ctx.lineWidth = 6;
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#ff7030';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.35;
    drawCrack(ctx, Math.random() * W, Math.random() * H, 60 + Math.random() * 200);
  }
  // Bright core on top.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd06a';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 40; i++) {
    drawCrack(ctx, Math.random() * W, Math.random() * H, 60 + Math.random() * 200);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Earth night-side city lights emissive map — tiny yellow pinpricks clustered
// on the "continent" areas.
function makeNightLights() {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const clusters = 40;
  for (let c = 0; c < clusters; c++) {
    const cx = Math.random() * W;
    const cy = H * 0.2 + Math.random() * H * 0.6;
    const count = 30 + Math.random() * 80;
    for (let i = 0; i < count; i++) {
      const x = cx + (Math.random() - 0.5) * 140;
      const y = cy + (Math.random() - 0.5) * 90;
      ctx.fillStyle = '#ffe0a0';
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.fillRect(x, y, 1 + Math.random() * 1.2, 1 + Math.random() * 1.2);
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// --------------------------------------------------------------------------
// Rim-lit atmosphere halo using a Fresnel-based shader. Renders on the
// back faces of a slightly larger sphere and additively blends.
function makeHaloMaterial({ color, power = 2.5, intensity = 1.0 }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fres = pow(1.0 - abs(dot(vNormal, vViewDir)), uPower);
        gl_FragColor = vec4(uColor * fres * uIntensity, fres);
      }
    `,
  });
}

// --------------------------------------------------------------------------
function makeRings(planetRadius, detail = 'saturn') {
  const inner = planetRadius * (detail === 'thin' ? 1.45 : 1.35);
  const outer = planetRadius * (detail === 'thin' ? 2.1 : 2.6);
  const geo = new THREE.RingGeometry(inner, outer, 320, 1);

  const pos = geo.attributes.position;
  const uv  = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.sqrt(x*x + y*y);
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }

  const tex = makeRingTexture(detail);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.02,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.rotation.y = 0.1;
  ring.rotation.z = detail === 'thin' ? 0.4 : 0.25;
  return ring;
}

function makeRingTexture(detail) {
  const W = 2048, H = 8;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  for (let x = 0; x < W; x++) {
    const t = x / W;
    let a = 1;
    if (t < 0.06) a = t / 0.06;
    else if (t > 0.94) a = (1 - t) / 0.06;

    // Multiple band frequencies to add the Cassini-like gaps.
    const b1 = 0.5 + 0.5 * Math.sin(t * 62 + Math.sin(t * 9) * 2);
    const b2 = 0.5 + 0.5 * Math.sin(t * 180);
    const mix = Math.pow(b1, 2) * 0.75 + b2 * 0.25;
    a *= 0.3 + mix * 0.7;

    const tone = detail === 'thin'
      ? 180 + Math.sin(t * 12) * 40 + (Math.random() - 0.5) * 18
      : 190 + Math.sin(t * 20) * 22 + (Math.random() - 0.5) * 22;

    for (let y = 0; y < H; y++) {
      const idx = (y * W + x) * 4;
      img.data[idx]   = clamp(tone);
      img.data[idx+1] = clamp(tone * 0.93);
      img.data[idx+2] = clamp(tone * (detail === 'thin' ? 0.95 : 0.77));
      img.data[idx+3] = clamp(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --------------------------------------------------------------------------
function makeCloudLayer(planetRadius) {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 18 + Math.random() * 110;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.1 + Math.random() * 0.28;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Swirly wisps.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  for (let i = 0; i < 25; i++) {
    ctx.globalAlpha = 0.1 + Math.random() * 0.15;
    ctx.beginPath();
    let x = Math.random() * W;
    let y = Math.random() * H;
    let a = Math.random() * Math.PI * 2;
    ctx.moveTo(x, y);
    for (let j = 0; j < 40; j++) {
      a += (Math.random() - 0.5) * 0.3;
      x += Math.cos(a) * 12;
      y += Math.sin(a) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.92,
  });
  const geo = new THREE.SphereGeometry(planetRadius * 1.018, 128, 80);
  return new THREE.Mesh(geo, mat);
}
