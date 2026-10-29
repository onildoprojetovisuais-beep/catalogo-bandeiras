// Cursor customizado — cor de marca (--vermelho: #ff4747) em toda a página
// (o crossfade para o lima da Caterham saiu em 2026-10-29). Reduzido a detalhe de acabamento: sem
// faíscas, resposta quase 1:1 ao mouse, rastro curto e fino, sem brilho.
(() => {
  const canvas = document.getElementById('trailCanvas');
  if (!canvas) return;

  // (hover: hover) and (pointer: fine) = tem mouse/trackpad de verdade.
  // Mais preciso que checar 'ontouchstart' in window, que dá falso positivo
  // em notebook com tela touch E mouse — o efeito é só para quem tem
  // ponteiro fino, nunca para touch/mobile.
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!hasFinePointer || prefersReduced) return;

  const ctx = canvas.getContext('2d');
  const TRAIL_LIFE = 160; // ms — rastro curto, quase imperceptível
  const MAX_TRAIL_POINTS = 14;
  const FOLLOW = 0.55; // resposta quase direta — pouco deslocamento/lag

  const raw = { x: -100, y: -100 };
  const smooth = { x: -100, y: -100 };
  let hasMouse = false;

  const RGB = '255, 71, 71'; // --vermelho em rgb

  let points = []; // {x, y, born}

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('load', resize);
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener(
    'mousemove',
    (e) => {
      raw.x = e.clientX;
      raw.y = e.clientY;
      if (!hasMouse) {
        smooth.x = raw.x;
        smooth.y = raw.y;
      }
      hasMouse = true;
    },
    { passive: true }
  );

  document.body.style.cursor = 'none';

  function updateTrail(now) {
    smooth.x += (raw.x - smooth.x) * FOLLOW;
    smooth.y += (raw.y - smooth.y) * FOLLOW;

    if (hasMouse) {
      const last = points[points.length - 1];
      if (!last || Math.hypot(smooth.x - last.x, smooth.y - last.y) > 3) {
        points.push({ x: smooth.x, y: smooth.y, born: now });
        if (points.length > MAX_TRAIL_POINTS) points.shift();
      }
    }

    points = points.filter((p) => now - p.born < TRAIL_LIFE);
  }

  function drawTrail() {
    if (points.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = `rgba(${RGB}, 0.35)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawCursor() {
    if (!hasMouse) return;
    ctx.beginPath();
    ctx.fillStyle = `rgb(${RGB})`;
    ctx.arc(smooth.x, smooth.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop() {
    const now = performance.now();

    updateTrail(now);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTrail();
    drawCursor();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
