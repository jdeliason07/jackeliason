import {
  CanvasTexture,
  Color,
  CustomBlending,
  CylinderGeometry,
  DirectionalLight,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SrcAlphaFactor,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type Material,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The vates No. 01 bottle in Three.js: a lathe-turned glass bottle with water
 * inside and an ink cap. Imported dynamically by components/BottleViewer.tsx,
 * only when its section nears the viewport, so no other page pays for it.
 */

const PAPER = "#fbfaf7";
const INK = "#2a1f16";

// Profile, in bottle units (the bottle is about 2.6 tall).
const R = 0.43; // body radius
const WALL = 0.028;
const NECK = 0.18;
const BODY_TOP = 1.7;
const NECK_BOTTOM = 2.18;
const LIP = 2.46;
const FLOOR = 0.09; // inside of the thick glass base
const FILL = 1.25; // water line

const AUTO_SPIN = 0.12; // rad/s
const DRAG = 0.011; // rad per pixel dragged

function cubic(a: Vector2, b: Vector2, c: Vector2, d: Vector2, steps: number): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    points.push(new Vector2(w[0] * a.x + w[1] * b.x + w[2] * c.x + w[3] * d.x, w[0] * a.y + w[1] * b.y + w[2] * c.y + w[3] * d.y));
  }
  return points;
}

const v = (x: number, y: number) => new Vector2(x, y);

/** A closed glass shell: up the outside from the base, over the rim, and back down the inside. */
function glassProfile(): Vector2[] {
  const outside = [
    v(0, 0),
    v(R - 0.035, 0),
    ...cubic(v(R - 0.035, 0), v(R - 0.01, 0), v(R, 0.01), v(R, 0.035), 4),
    v(R, BODY_TOP),
    ...cubic(v(R, BODY_TOP), v(R, BODY_TOP + 0.28), v(NECK + 0.02, NECK_BOTTOM - 0.14), v(NECK, NECK_BOTTOM), 18),
    v(NECK, LIP),
  ];
  const r = R - WALL;
  const n = NECK - WALL;
  const inside = [
    v(n, LIP),
    v(n, NECK_BOTTOM + 0.01),
    ...cubic(v(n, NECK_BOTTOM + 0.01), v(n + 0.02, NECK_BOTTOM - 0.13), v(r, BODY_TOP + 0.27), v(r, BODY_TOP), 18),
    v(r, FLOOR + 0.03),
    ...cubic(v(r, FLOOR + 0.03), v(r, FLOOR + 0.01), v(r - 0.01, FLOOR), v(r - 0.03, FLOOR), 4),
    v(0, FLOOR),
  ];
  return [...outside, ...inside];
}

function waterProfile(): Vector2[] {
  const r = R - WALL - 0.006;
  return [v(0, FLOOR + 0.004), v(r - 0.03, FLOOR + 0.004), ...cubic(v(r - 0.03, FLOOR + 0.004), v(r - 0.01, FLOOR + 0.004), v(r, FLOOR + 0.015), v(r, FLOOR + 0.034), 4), v(r, FILL), v(0, FILL)];
}

function capProfile(): Vector2[] {
  const top = LIP + 0.16;
  const bottom = LIP - 0.21;
  return [v(0, top), v(0.198, top), ...cubic(v(0.198, top), v(0.212, top), v(0.216, top - 0.006), v(0.216, top - 0.02), 4), v(0.216, bottom + 0.012), v(0.208, bottom), v(0.19, bottom)];
}

/**
 * Blended like a transparent material, but kept in the opaque render list so it
 * is drawn into the glass's transmission pass and seen, refracted, through the glass.
 * (A `transparent: true` material is drawn after the glass and fails the depth test behind it.)
 */
function seenThroughGlass<T extends Material>(material: T): T {
  material.transparent = false;
  material.blending = CustomBlending;
  material.blendSrc = SrcAlphaFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  return material;
}

function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) draw(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

export type BottleScene = { dispose: () => void };

export async function mountBottle(
  host: HTMLElement,
  options: {
    /** The section whose scroll-through turns the bottle once. */
    track: HTMLElement;
    reducedMotion: boolean;
    /** Wordmark printed on the glass. */
    labelSrc: string;
    onContextLost: () => void;
  },
): Promise<BottleScene> {
  const { track, reducedMotion, labelSrc, onContextLost } = options;

  // Throws when WebGL is unavailable; the viewer falls back to the logo plate.
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene();
  scene.background = new Color(PAPER);
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;

  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 3);
  scene.add(key);

  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 1.55, 5.4);
  camera.lookAt(0, 1.27, 0);

  const bottle = new Group();
  scene.add(bottle);

  const glass = new Mesh(
    new LatheGeometry(glassProfile(), 96),
    new MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 1,
      roughness: 0.05,
      ior: 1.5,
      thickness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      attenuationColor: new Color("#bfe6df"),
      attenuationDistance: 0.9,
      envMapIntensity: 0.8,
    }),
  );
  bottle.add(glass);

  const water = new Mesh(
    new LatheGeometry(waterProfile(), 96),
    seenThroughGlass(new MeshStandardMaterial({ color: "#4f9e95", roughness: 0.1, opacity: 0.5, envMapIntensity: 0.45 })),
  );
  bottle.add(water);

  const cap = new Mesh(new LatheGeometry(capProfile(), 96), new MeshStandardMaterial({ color: INK, roughness: 0.55 }));
  bottle.add(cap);

  // The wordmark, printed on one side of the glass so the spin is visible.
  const logo = await loadImage(labelSrc);
  if (logo) {
    const arc = 1.7;
    const texture = canvasTexture(1024, 588, (context) => {
      const height = 588 * 0.46;
      const width = (logo.naturalWidth / logo.naturalHeight) * height;
      context.drawImage(logo, (1024 - width) / 2, (588 - height) / 2, width, height);
    });
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const label = new Mesh(
      new CylinderGeometry(R + 0.004, R + 0.004, 0.42, 64, 1, true, -arc / 2, arc),
      new MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.45, depthWrite: false }),
    );
    label.position.y = 0.98;
    bottle.add(label);
  }

  // A soft contact shadow, so the bottle stands on the page rather than floating.
  const shadow = new Mesh(
    new PlaneGeometry(1.9, 1.9),
    seenThroughGlass(
      new MeshBasicMaterial({
        depthWrite: false,
        map: canvasTexture(256, 256, (context) => {
          const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
          gradient.addColorStop(0, "rgba(42,31,22,0.34)");
          gradient.addColorStop(0.45, "rgba(42,31,22,0.12)");
          gradient.addColorStop(1, "rgba(42,31,22,0)");
          context.fillStyle = gradient;
          context.fillRect(0, 0, 256, 256);
        }),
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.renderOrder = -1;
  scene.add(shadow);

  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "pan-y"; // vertical swipes still scroll the page
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  // Rotation = slow drift + one turn across the section's scroll-through + drag with inertia.
  let drift = 0;
  let dragged = 0;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let lastMove = 0;

  const scrollTurn = () => {
    if (reducedMotion) return 0;
    const rect = track.getBoundingClientRect();
    const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
    return (Math.min(1, Math.max(0, progress)) - 0.5) * Math.PI * 2; // label faces you mid-section
  };

  const render = () => {
    bottle.rotation.y = drift + dragged + scrollTurn();
    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  // The loop runs only while the viewer is on screen, and never for reduced motion.
  let frame = 0;
  let running = false;
  let last = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    drift += AUTO_SPIN * dt;
    if (!dragging) {
      dragged += velocity * dt;
      velocity *= Math.exp(-3 * dt);
    }
    render();
    frame = running ? requestAnimationFrame(tick) : 0;
  };
  const start = () => {
    if (running || reducedMotion) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const visibility = new IntersectionObserver((entries) => (entries.some((entry) => entry.isIntersecting) ? start() : stop()));
  visibility.observe(host);

  const onDown = (event: PointerEvent) => {
    dragging = true;
    velocity = 0;
    lastX = event.clientX;
    lastMove = event.timeStamp;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onMove = (event: PointerEvent) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dt = Math.max(1, event.timeStamp - lastMove) / 1000;
    dragged += dx * DRAG;
    velocity = Math.max(-12, Math.min(12, 0.75 * velocity + 0.25 * ((dx * DRAG) / dt)));
    lastX = event.clientX;
    lastMove = event.timeStamp;
    if (reducedMotion) render(); // user-driven frames only
  };
  const onUp = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (reducedMotion || event.timeStamp - lastMove > 80) velocity = 0; // no fling after holding still
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  const onLost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  resize();

  return {
    dispose() {
      stop();
      visibility.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const material = object.material as Material & { map?: { dispose: () => void } | null };
          material.map?.dispose();
          material.dispose();
        }
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
