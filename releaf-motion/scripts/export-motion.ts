// Zapisuje przebieg ruchu klatka po klatce, żeby dźwięk (make-sound.py) trafiał w obraz.
// Uruchom: node --experimental-strip-types scripts/export-motion.ts > scripts/motion.json
import { DURATION, FPS, SNAP, LOCK, LAND_START, HOLD_END, SLAT_COUNT, camera, slatLift } from "../src/motion.ts";

const frames = Array.from({ length: DURATION }, (_, f) => {
  const c = camera(f);
  let lift = 0;
  for (let i = 0; i < SLAT_COUNT; i++) lift += slatLift(i, f);
  return { rotY: c.rotY, rotX: c.rotX, zoom: c.zoom, lift: lift / SLAT_COUNT };
});
// chwila, w której każdy paseczek dotyka powierzchni / odrywa się od niej
const touch = Array.from({ length: SLAT_COUNT }, (_, i) => {
  let land = -1;
  let leave = -1;
  for (let f = 1; f < DURATION; f++) {
    if (land < 0 && slatLift(i, f) < 0.1) land = f;
    if (land >= 0 && leave < 0 && slatLift(i, f) > 0.1) leave = f;
  }
  return { land, leave };
});
process.stdout.write(JSON.stringify({ fps: FPS, duration: DURATION, snap: SNAP, lock: LOCK, landStart: LAND_START, holdEnd: HOLD_END, frames, touch }));
