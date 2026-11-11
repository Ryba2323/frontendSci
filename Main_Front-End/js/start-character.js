/* Poruszamy fragmentami oryginalnego obrazka. Głowa, oczy i listek są poza siatką. */
(function () {
  'use strict';

  const mascot = document.querySelector('.start-mascot');
  const image = mascot.querySelector('img');
  const start = mascot.closest('.start');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Granice i punkty obrotu w pikselach oryginalnego pliku listek-hop.webp.
  const padding = 36;
  const limbs = [
    { bounds: [-36, 196, 113, 326], pivot: [88, 270], reach: x => smooth((108 - x) / 49) },
    { bounds: [252, 174, 396, 298], pivot: [285, 261], reach: x => smooth((x - 263) / 49) },
    { bounds: [14, 350, 181, 512], pivot: [120, 389], reach: (_, y) => smooth((y - 370) / 49) },
    { bounds: [181, 298, 379, 469], pivot: [224, 398], reach: x => smooth((x - 199) / 55) },
  ];

  const jump = [
    [.27, 14, -13, -12, 12],
    [.37, -16, 19, 18, -18],
    [.51, 23, -25, -27, 25],
    [.66, -16, 18, 19, -17],
    [.76, 15, -19, -16, 17],
    [.87, -8, 10, 7, -7],
    [1, 0, 0, 0, 0],
  ];

  const kick = [
    [0, 0, 0, 0, 0],
    [.25, -5, 6, -7, -12],
    [4 / 7, 9, -9, -5, 23],
    [.8, 4, -3, -2, 11],
    [1, 0, 0, 0, 0],
  ];

  canvas.width = Number(image.getAttribute('width')) + padding * 2;
  canvas.height = Number(image.getAttribute('height')) + padding * 2;
  canvas.setAttribute('aria-hidden', 'true');
  mascot.append(canvas);

  function smooth(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function mesh({ bounds: [left, top, right, bottom], pivot, reach }) {
    const cols = Math.ceil((right - left) / 17);
    const rows = Math.ceil((bottom - top) / 17);
    const width = (right - left) / cols;
    const height = (bottom - top) / rows;
    const points = Array.from({ length: rows + 1 }, (_, row) =>
      Array.from({ length: cols + 1 }, (_, col) => {
        const x = left + col * width;
        const y = top + row * height;
        const edge = Math.min(x - left, right - x, y - top, bottom - y);
        return { x, y, weight: reach(x, y) * smooth(edge / 22) };
      }));
    return { left, top, right, bottom, cols, rows, width, height, points, pivot };
  }

  const patches = limbs.map(mesh);

  function tile(origin, across, down, dx, dy) {
    const a = (across.tx - origin.tx) / dx;
    const b = (across.ty - origin.ty) / dx;
    const c = (down.tx - origin.tx) / dy;
    const d = (down.ty - origin.ty) / dy;
    const centerX = (origin.tx + across.tx + down.tx) / 3;
    const centerY = (origin.ty + across.ty + down.ty) / 3;
    ctx.save();
    ctx.beginPath();
    // Zakładka podpikselowa zapobiega szparom między trójkątami.
    ctx.moveTo(origin.tx + (origin.tx - centerX) * .09, origin.ty + (origin.ty - centerY) * .09);
    ctx.lineTo(across.tx + (across.tx - centerX) * .09, across.ty + (across.ty - centerY) * .09);
    ctx.lineTo(down.tx + (down.tx - centerX) * .09, down.ty + (down.ty - centerY) * .09);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, origin.tx - a * origin.x - c * origin.y, origin.ty - b * origin.x - d * origin.y);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  function drawPatch(patch, degrees) {
    if (Math.abs(degrees) < .1) return;
    const { left, top, right, bottom, cols, rows, width, height, points, pivot: [px, py] } = patch;
    const angle = degrees * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const row of points) {
      for (const point of row) {
        const x = point.x - px;
        const y = point.y - py;
        point.tx = point.x + (cos * x - sin * y - x) * point.weight;
        point.ty = point.y + (sin * x + cos * y - y) * point.weight;
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    ctx.clearRect(left, top, right - left, bottom - top);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tl = points[row][col];
        const tr = points[row][col + 1];
        const bl = points[row + 1][col];
        const br = points[row + 1][col + 1];
        if (tl.weight || tr.weight || bl.weight || br.weight) {
          tile(tl, tr, bl, width, height);
          tile(br, bl, tr, -width, -height);
        } else {
          ctx.drawImage(image, tl.x, tl.y, width, height, tl.x, tl.y, width, height);
        }
      }
    }
    ctx.restore();
  }

  function poseAt(poses, progress) {
    const next = poses.findIndex(([at]) => at >= progress);
    if (next < 1) return poses[next === 0 ? 0 : poses.length - 1].slice(1);
    const from = poses[next - 1];
    const to = poses[next];
    const t = smooth((progress - from[0]) / (to[0] - from[0]));
    return from.slice(1).map((angle, i) => angle + (to[i + 1] - angle) * t);
  }

  start.addEventListener('animationstart', event => {
    if (event.animationName !== 'start-flight' || !image.complete || !image.naturalWidth) return;
    const flight = event.target.getAnimations().find(animation => animation.animationName === 'start-flight');
    const timeline = start.querySelector('.start-seed').getAnimations().find(animation => animation.animationName === 'start-bloom');
    if (!flight || !timeline) return;
    const { duration } = flight.effect.getComputedTiming();
    const kickTime = duration / 3;

    function frame() {
      const elapsed = timeline.currentTime;
      if (!start.classList.contains('is-opening') || elapsed >= duration + kickTime) {
        mascot.classList.remove('is-moving');
        return;
      }
      if (elapsed >= duration * .28) {
        const angles = elapsed < duration ? poseAt(jump, elapsed / duration) : poseAt(kick, (elapsed - duration) / kickTime);
        mascot.classList.toggle('is-moving', angles.some(angle => Math.abs(angle) >= .1));
        ctx.setTransform(1, 0, 0, 1, padding, padding);
        ctx.clearRect(-padding, -padding, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        patches.forEach((patch, i) => drawPatch(patch, angles[i]));
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();
