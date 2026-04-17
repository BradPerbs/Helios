import * as THREE from 'three';

// Procedural solar-system planets. Each one gets a CanvasTexture built from a
// palette + optional bands/clouds/craters, wrapped on a SphereGeometry.
// Sizes and distances are tuned relative to the ~2.4-unit-long spaceship so
// the nearest planets feel big and the farthest read as distant worlds.
export function createPlanets() {
  const group = new THREE.Group();

  // ---- Distant sun (acts as the key light for the whole system) ------------
  const sunPos = new THREE.Vector3(320, 180, -520);
  const sunLight = new THREE.DirectionalLight(0xfff0cc, 2.2);
  sunLight.position.copy(sunPos);
  group.add(sunLight);

  const ambient = new THREE.AmbientLight(0x1e2540, 0.55);
  group.add(ambient);

  const sunMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(3.0, 2.4, 1.4),   // >1 so bloom blows it out
    toneMapped: false,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(55, 48, 32), sunMat);
  sun.position.copy(sunPos);
  group.add(sun);

  // ---- Planet definitions --------------------------------------------------
  const defs = [
    {
      name: 'earth',   radius: 14,  pos: [ 90, 6,  -80],
      palette: ['#0d2c58', '#1f5ea3', '#6aa8d4', '#2d6a2b', '#c2b280'],
      clouds: true,
    },
    {
      name: 'mars',    radius: 10,  pos: [-110, -8,  -40],
      palette: ['#5a2010', '#a84a22', '#d47a45', '#7a3018'],
    },
    {
      name: 'jupiter', radius: 55,  pos: [ 260, 30, -340],
      palette: ['#9b6a3a', '#c8a06b', '#e8c894', '#8a4a22', '#f0d8b0'],
      bands: true, bandDensity: 32,
    },
    {
      name: 'saturn',  radius: 42,  pos: [-300, -60, -420],
      palette: ['#c8b280', '#d8c090', '#e8d0a0', '#a88858'],
      bands: true, bandDensity: 20, rings: true,
    },
    {
      name: 'neptune', radius: 22,  pos: [ 520, -120, -820],
      palette: ['#0f2f7a', '#2d5ec8', '#6fa0e0', '#a8c8f0'],
      bands: true, bandDensity: 14,
    },
    {
      name: 'venus',   radius: 13,  pos: [-70, 50, 120],
      palette: ['#a87838', '#e8c878', '#f0d8a8', '#80582c'],
      bands: true, bandDensity: 10,
    },
    {
      name: 'moon',    radius: 4.5, pos: [ 130, 18, 10],
      palette: ['#6a6660', '#aaa8a0', '#7a7872', '#5c5a54'],
      craters: true,
    },
    {
      name: 'ice',     radius: 28,  pos: [-680, 90, -940],
      palette: ['#b8d8ea', '#e0f0ff', '#6898c8', '#d0e8f8'],
      bands: true, bandDensity: 8,
    },
    {
      name: 'lava',    radius: 18,  pos: [ 420, -30, 180],
      palette: ['#1a0404', '#4a1008', '#c03414', '#f05820'],
      bands: true, bandDensity: 18,
    },
  ];

  const planets = [];
  for (const def of defs) {
    const tex = makePlanetTexture(def);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.88,
      metalness: 0.0,
    });
    const geo = new THREE.SphereGeometry(def.radius, 96, 64);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...def.pos);
    mesh.rotation.z = (Math.random() - 0.5) * 0.5;
    mesh.rotation.y = Math.random() * Math.PI * 2;

    if (def.rings) {
      mesh.add(makeRings(def.radius));
    }
    if (def.name === 'earth' && def.clouds) {
      mesh.add(makeCloudLayer(def.radius));
    }

    group.add(mesh);
    planets.push({
      mesh,
      rotationSpeed: 0.015 + Math.random() * 0.05,
    });
  }

  return { group, planets, sun };
}

// --------------------------------------------------------------------------
function makePlanetTexture({ palette, bands = false, bandDensity = 18, craters = false }) {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Vertical gradient base (poles a bit darker).
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, palette[0]);
  grad.addColorStop(0.5, palette[Math.min(1, palette.length - 1)]);
  grad.addColorStop(1.0, palette[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Latitudinal bands (for gas giants).
  if (bands) {
    for (let i = 0; i < bandDensity * 2; i++) {
      const y = Math.random() * H;
      const h = 4 + Math.random() * (H / bandDensity);
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.globalAlpha = 0.25 + Math.random() * 0.4;
      ctx.fillRect(0, y, W, h);
    }
    ctx.globalAlpha = 1;
  }

  // Surface blobs.
  const blobs = 120 + Math.floor(Math.random() * 80);
  for (let i = 0; i < blobs; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 6 + Math.random() * 60;
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
    ctx.globalAlpha = 0.08 + Math.random() * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Craters (moon-like).
  if (craters) {
    for (let i = 0; i < 180; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 3 + Math.random() * 14;
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

  // Grainy noise pass for texture.
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
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

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// Saturn-style ring system — a flat annulus with a banded alpha texture.
function makeRings(planetRadius) {
  const inner = planetRadius * 1.35;
  const outer = planetRadius * 2.4;
  const geo = new THREE.RingGeometry(inner, outer, 256, 1);

  // Remap UVs so U goes from 0 (inner edge) → 1 (outer edge).
  const pos = geo.attributes.position;
  const uv  = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.sqrt(x*x + y*y);
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }

  const tex = makeRingTexture();
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
  ring.rotation.z = 0.25;
  return ring;
}

function makeRingTexture() {
  const W = 1024, H = 8;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  for (let x = 0; x < W; x++) {
    const t = x / W;
    // Soft fade at the inner and outer edges.
    let a = 1;
    if (t < 0.08) a = t / 0.08;
    else if (t > 0.94) a = (1 - t) / 0.06;
    // Visible banding ("Cassini division"-style gaps).
    const band = 0.5 + 0.5 * Math.sin(t * 55 + Math.sin(t * 11) * 2);
    a *= 0.35 + Math.pow(band, 2) * 0.65;
    // Slight color variation across rings.
    const tone = 170 + Math.sin(t * 18) * 25 + (Math.random() - 0.5) * 20;
    for (let y = 0; y < H; y++) {
      const idx = (y * W + x) * 4;
      img.data[idx]   = clamp(tone);
      img.data[idx+1] = clamp(tone * 0.92);
      img.data[idx+2] = clamp(tone * 0.78);
      img.data[idx+3] = clamp(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A slightly larger sphere for Earth's clouds.
function makeCloudLayer(planetRadius) {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 140; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 15 + Math.random() * 70;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.12 + Math.random() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const geo = new THREE.SphereGeometry(planetRadius * 1.015, 96, 64);
  const clouds = new THREE.Mesh(geo, mat);
  return clouds;
}
