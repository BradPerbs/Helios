import * as THREE from 'three';

// Builds a PMREM-filtered environment map that matches the scene — a dark
// void with a single bright warm sun, a faint cool rim on the opposite side,
// and a warm glow from below that echoes Phoenix. This gives PBR reflections
// the right colour signature for a spacecraft, instead of the "studio room"
// look RoomEnvironment produces.
//
// Painted as a 2:1 equirectangular canvas and converted via PMREMGenerator.
export function buildSpaceEnvMap(renderer) {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // --- Deep space base ------------------------------------------------------
  // Near-black with a barely-there vertical gradient so reflections have a
  // tiny bit of directional variation rather than a uniform flat black.
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#020206');                // top: faintly cool
  base.addColorStop(0.5, '#010103');
  base.addColorStop(1, '#040202');                // bottom: faintly warm
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // --- Sun (bright warm key) ------------------------------------------------
  // Placed upper-right so reflections have a clear dominant highlight
  // that lines up with the scene's directional sunlight direction.
  paintRadialGlow(ctx, W * 0.30, H * 0.32, 60, [
    [0.00, 'rgba(255, 240, 200, 1.00)'],
    [0.10, 'rgba(255, 210, 140, 0.90)'],
    [0.35, 'rgba(230, 140,  60, 0.35)'],
    [1.00, 'rgba(0, 0, 0, 0)'],
  ]);
  // Wider warm halo so mid-rough surfaces pick up a soft warm wash.
  paintRadialGlow(ctx, W * 0.30, H * 0.32, 260, [
    [0.00, 'rgba(180, 110,  60, 0.22)'],
    [1.00, 'rgba(0, 0, 0, 0)'],
  ]);

  // --- Cool rim (opposite hemisphere) --------------------------------------
  // Very dim cool source so the shadow side of the hull isn't a dead
  // pure-black — adds that subtle "night side" rim you see on film spaceships.
  paintRadialGlow(ctx, W * 0.80, H * 0.55, 240, [
    [0.00, 'rgba(60,  90, 130, 0.22)'],
    [1.00, 'rgba(0, 0, 0, 0)'],
  ]);

  // --- Phoenix glow from below ---------------------------------------------
  // A warm wash from the lower hemisphere so the ship belly picks up an
  // orange rim when Phoenix is below frame. Keeps the scene feeling lived-in.
  paintRadialGlow(ctx, W * 0.50, H * 0.88, 300, [
    [0.00, 'rgba(180,  80,  30, 0.28)'],
    [1.00, 'rgba(0, 0, 0, 0)'],
  ]);

  // A handful of faint background stars so high-gloss metal reflections
  // get a subtle sparkle instead of pure dead colour.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() < 0.1 ? 1.4 : 0.7;
    ctx.globalAlpha = 0.3 + Math.random() * 0.5;
    ctx.fillRect(x, y, r, r);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return envMap;
}

function paintRadialGlow(ctx, x, y, radius, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
