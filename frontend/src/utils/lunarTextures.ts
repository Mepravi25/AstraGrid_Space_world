import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural Texture Generators for HabitatOS Lunar Simulation
// ---------------------------------------------------------------------------

let cachedRegolithMap: THREE.CanvasTexture | null = null;
let cachedRegolithBump: THREE.CanvasTexture | null = null;
let cachedSolarPanelMap: THREE.CanvasTexture | null = null;
let cachedSunCoronaMap: THREE.CanvasTexture | null = null;
let cachedEarthFallback: {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
} | null = null;

/**
 * Generate high-detail procedural lunar regolith textures (diffuse + bump map)
 * Simulates micro-craters, basaltic dust grain, and subtle mineral albedo variations.
 */
export function getLunarRegolithTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (cachedRegolithMap && cachedRegolithBump) {
    return { map: cachedRegolithMap, bumpMap: cachedRegolithBump };
  }

  const size = 1024;
  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  const dCtx = diffuseCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // 1. Base Regolith Grey Tone (Apollo landing site basalt albedo ~0.09)
  dCtx.fillStyle = '#3c3f47';
  dCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // 2. Multi-scale basalt dust noise & mineral flecks
  const dImgData = dCtx.getImageData(0, 0, size, size);
  const bImgData = bCtx.getImageData(0, 0, size, size);
  const dData = dImgData.data;
  const bData = bImgData.data;

  // Simple deterministic pseudo-random noise generator
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < dData.length; i += 4) {
    const n1 = (rand() - 0.5) * 22;
    const n2 = (rand() - 0.5) * 12;
    const totalN = n1 + n2;

    // Diffuse tone
    dData[i] = Math.max(30, Math.min(85, dData[i] + totalN));
    dData[i + 1] = Math.max(32, Math.min(88, dData[i + 1] + totalN * 0.98));
    dData[i + 2] = Math.max(36, Math.min(94, dData[i + 2] + totalN * 1.05));

    // Bump relief
    const bVal = Math.max(0, Math.min(255, 128 + totalN * 1.8));
    bData[i] = bVal;
    bData[i + 1] = bVal;
    bData[i + 2] = bVal;
  }

  dCtx.putImageData(dImgData, 0, 0);
  bCtx.putImageData(bImgData, 0, 0);

  // 3. Scattered micro-craters with shaded bowls and raised ejecta rims
  const craterCount = 180;
  for (let i = 0; i < craterCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 2.5 + Math.pow(rand(), 2.8) * 42;

    // Bump crater (dark interior bowl, bright rim)
    const bumpGrad = bCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.35);
    bumpGrad.addColorStop(0, '#303030');
    bumpGrad.addColorStop(0.65, '#505050');
    bumpGrad.addColorStop(0.85, '#e0e0e0'); // raised rim
    bumpGrad.addColorStop(1.0, 'rgba(128,128,128,0)');
    bCtx.fillStyle = bumpGrad;
    bCtx.beginPath();
    bCtx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    bCtx.fill();

    // Diffuse crater shading
    const diffGrad = dCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.25);
    diffGrad.addColorStop(0, 'rgba(28,30,36,0.7)');
    diffGrad.addColorStop(0.75, 'rgba(38,41,48,0.4)');
    diffGrad.addColorStop(0.9, 'rgba(95,100,112,0.5)'); // lighter rim ejecta
    diffGrad.addColorStop(1.0, 'rgba(60,63,71,0)');
    dCtx.fillStyle = diffGrad;
    dCtx.beginPath();
    dCtx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
    dCtx.fill();
  }

  const map = new THREE.CanvasTexture(diffuseCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(24, 24);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(24, 24);

  cachedRegolithMap = map;
  cachedRegolithBump = bumpMap;

  return { map, bumpMap };
}

/**
 * Generate procedural photovoltaic solar panel texture with silicon cells & busbars
 */
export function getPhotovoltaicTexture(): THREE.CanvasTexture {
  if (cachedSolarPanelMap) return cachedSolarPanelMap;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep space-grade anti-reflective silicon substrate (dark navy-black)
  ctx.fillStyle = '#061224';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const rows = 12;
  const pad = 4;
  const cellW = (512 - pad * (cols + 1)) / cols;
  const cellH = (512 - pad * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cellW + pad);
      const y = pad + r * (cellH + pad);

      // Monocrystalline silicon cell with chamfered corners
      const cellGrad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      cellGrad.addColorStop(0, '#0a2344');
      cellGrad.addColorStop(0.5, '#071830');
      cellGrad.addColorStop(1, '#051226');

      ctx.fillStyle = cellGrad;
      ctx.fillRect(x, y, cellW, cellH);

      // Chamfered 45-degree cell corners
      ctx.fillStyle = '#0f294a';
      const ch = 4;
      ctx.fillRect(x, y, ch, ch);
      ctx.fillRect(x + cellW - ch, y, ch, ch);
      ctx.fillRect(x, y + cellH - ch, ch, ch);
      ctx.fillRect(x + cellW - ch, y + cellH - ch, ch, ch);

      // Fine silver gridlines (fingers)
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
      ctx.lineWidth = 1;
      const fingerStep = 5;
      for (let fy = y + 3; fy < y + cellH - 2; fy += fingerStep) {
        ctx.beginPath();
        ctx.moveTo(x + 1, fy);
        ctx.lineTo(x + cellW - 1, fy);
        ctx.stroke();
      }

      // Dual silver main collector busbars
      ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
      const b1 = x + cellW * 0.33;
      const b2 = x + cellW * 0.67;
      ctx.fillRect(b1 - 1, y, 2, cellH);
      ctx.fillRect(b2 - 1, y, 2, cellH);
    }
  }

  // Aluminum perimeter structural border
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, 510, 510);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);

  cachedSolarPanelMap = texture;
  return texture;
}

/**
 * Generate subtle solar corona / optical glare texture with faint diffraction spikes
 */
export function getSunCoronaTexture(): THREE.CanvasTexture {
  if (cachedSunCoronaMap) return cachedSunCoronaMap;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;

  // 1. Radiant exponential solar corona glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 256);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.06, 'rgba(255, 255, 240, 0.95)');
  grad.addColorStop(0.18, 'rgba(255, 245, 210, 0.75)');
  grad.addColorStop(0.38, 'rgba(255, 232, 160, 0.38)');
  grad.addColorStop(0.62, 'rgba(255, 205, 110, 0.12)');
  grad.addColorStop(0.85, 'rgba(255, 170, 60, 0.025)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 256, 0, Math.PI * 2);
  ctx.fill();

  // 2. Optical diffraction spikes (space visor / camera aperture rays)
  const drawSpike = (angle: number, width: number, length: number, alpha: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const spikeGrad = ctx.createLinearGradient(-length, 0, length, 0);
    spikeGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    spikeGrad.addColorStop(0.4, `rgba(255, 245, 210, ${alpha * 0.2})`);
    spikeGrad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
    spikeGrad.addColorStop(0.6, `rgba(255, 245, 210, ${alpha * 0.2})`);
    spikeGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spikeGrad;
    ctx.fillRect(-length, -width / 2, length * 2, width);
    ctx.restore();
  };

  // Primary cardinal spikes
  drawSpike(0, 2.5, 250, 0.85);
  drawSpike(Math.PI / 2, 2.5, 250, 0.85);

  // Secondary diagonal faint flares
  drawSpike(Math.PI / 4, 1.5, 170, 0.35);
  drawSpike(-Math.PI / 4, 1.5, 170, 0.35);

  const texture = new THREE.CanvasTexture(canvas);
  cachedSunCoronaMap = texture;
  return texture;
}

/**
 * Procedural Fallback Earth Textures (Day, Night lights, Clouds, Specular)
 * Guaranteed fallback if external image assets are unavailable or delayed.
 */
export function createProceduralEarthFallback(): {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
} {
  if (cachedEarthFallback) return cachedEarthFallback;

  const w = 1024;
  const h = 512;

  // Day Canvas
  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = w;
  dayCanvas.height = h;
  const dCtx = dayCanvas.getContext('2d')!;

  // Deep Blue Oceans
  const oceanGrad = dCtx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#0f2952');
  oceanGrad.addColorStop(0.5, '#0a2144');
  oceanGrad.addColorStop(1, '#0e2b56');
  dCtx.fillStyle = oceanGrad;
  dCtx.fillRect(0, 0, w, h);

  // Continents approximation (Eurasia, Africa, Americas, Australia, Antarctica)
  dCtx.fillStyle = '#2f5a28'; // Land green/forest

  // North America
  dCtx.beginPath();
  dCtx.ellipse(w * 0.24, h * 0.32, w * 0.12, h * 0.16, -0.3, 0, Math.PI * 2);
  dCtx.fill();

  // South America
  dCtx.fillStyle = '#3e6b2c';
  dCtx.beginPath();
  dCtx.ellipse(w * 0.32, h * 0.65, w * 0.07, h * 0.18, 0.2, 0, Math.PI * 2);
  dCtx.fill();

  // Eurasia
  dCtx.fillStyle = '#416335';
  dCtx.beginPath();
  dCtx.ellipse(w * 0.65, h * 0.3, w * 0.22, h * 0.15, 0.1, 0, Math.PI * 2);
  dCtx.fill();

  // Africa
  dCtx.fillStyle = '#997c3e'; // Sahara savanna
  dCtx.beginPath();
  dCtx.ellipse(w * 0.52, h * 0.52, w * 0.09, h * 0.18, 0, 0, Math.PI * 2);
  dCtx.fill();

  // Australia
  dCtx.fillStyle = '#a87332';
  dCtx.beginPath();
  dCtx.ellipse(w * 0.82, h * 0.72, w * 0.07, h * 0.09, 0, 0, Math.PI * 2);
  dCtx.fill();

  // Polar Ice Caps
  dCtx.fillStyle = '#e2e8f0';
  dCtx.fillRect(0, 0, w, h * 0.08);
  dCtx.fillRect(0, h * 0.88, w, h * 0.12);

  // Night Canvas (City lights)
  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = w;
  nightCanvas.height = h;
  const nCtx = nightCanvas.getContext('2d')!;

  nCtx.fillStyle = '#000000';
  nCtx.fillRect(0, 0, w, h);

  // City clusters (North America East, Western Europe, East Asia, coastal South America)
  const cityClusters = [
    { x: w * 0.26, y: h * 0.34, r: 24, count: 60 },
    { x: w * 0.21, y: h * 0.36, r: 18, count: 35 },
    { x: w * 0.52, y: h * 0.28, r: 28, count: 90 },
    { x: w * 0.76, y: h * 0.35, r: 35, count: 110 },
    { x: w * 0.68, y: h * 0.42, r: 25, count: 70 },
    { x: w * 0.35, y: h * 0.68, r: 16, count: 30 }
  ];

  let cSeed = 998877;
  const crand = () => {
    cSeed = (cSeed * 1664525 + 1013904223) % 4294967296;
    return cSeed / 4294967296;
  };

  cityClusters.forEach((c) => {
    for (let i = 0; i < c.count; i++) {
      const px = c.x + (crand() - 0.5) * c.r * 2;
      const py = c.y + (crand() - 0.5) * c.r * 1.6;
      const rad = 0.8 + crand() * 1.8;
      nCtx.fillStyle = crand() > 0.4 ? '#fef08a' : '#f59e0b';
      nCtx.beginPath();
      nCtx.arc(px, py, rad, 0, Math.PI * 2);
      nCtx.fill();
    }
  });

  // Clouds Canvas
  const cloudsCanvas = document.createElement('canvas');
  cloudsCanvas.width = w;
  cloudsCanvas.height = h;
  const cCtx = cloudsCanvas.getContext('2d')!;

  cCtx.fillStyle = 'rgba(0,0,0,0)';
  cCtx.fillRect(0, 0, w, h);

  cCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  // Mid-latitude swirling cloud bands
  for (let i = 0; i < 45; i++) {
    const cx = crand() * w;
    const cy = h * 0.15 + crand() * h * 0.7;
    const rw = 40 + crand() * 160;
    const rh = 10 + crand() * 35;
    const grad = cCtx.createRadialGradient(cx, cy, 0, cx, cy, rw);
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.ellipse(cx, cy, rw, rh, crand() * 0.4 - 0.2, 0, Math.PI * 2);
    cCtx.fill();
  }

  // Specular Canvas (Oceans white, land black)
  const specCanvas = document.createElement('canvas');
  specCanvas.width = w;
  specCanvas.height = h;
  const sCtx = specCanvas.getContext('2d')!;

  sCtx.fillStyle = '#ffffff'; // oceans reflective
  sCtx.fillRect(0, 0, w, h);
  sCtx.fillStyle = '#101010'; // land non-reflective
  sCtx.beginPath();
  sCtx.ellipse(w * 0.24, h * 0.32, w * 0.12, h * 0.16, -0.3, 0, Math.PI * 2);
  sCtx.ellipse(w * 0.32, h * 0.65, w * 0.07, h * 0.18, 0.2, 0, Math.PI * 2);
  sCtx.ellipse(w * 0.65, h * 0.3, w * 0.22, h * 0.15, 0.1, 0, Math.PI * 2);
  sCtx.ellipse(w * 0.52, h * 0.52, w * 0.09, h * 0.18, 0, 0, Math.PI * 2);
  sCtx.ellipse(w * 0.82, h * 0.72, w * 0.07, h * 0.09, 0, 0, Math.PI * 2);
  sCtx.fill();

  cachedEarthFallback = {
    dayMap: new THREE.CanvasTexture(dayCanvas),
    nightMap: new THREE.CanvasTexture(nightCanvas),
    cloudsMap: new THREE.CanvasTexture(cloudsCanvas),
    specularMap: new THREE.CanvasTexture(specCanvas)
  };

  return cachedEarthFallback;
}
