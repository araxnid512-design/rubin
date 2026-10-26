// Каркас игры: цикл, камера, игрок. Игровые механики добавляются по ТЗ
// и только после сверки с LORE.md (см. CLAUDE.md).
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const TILE = 64;
  const player = { x: 0, y: 0, r: 16, speed: 220 };
  let width = 0, height = 0, dpr = 1;
  let last = performance.now();

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function update(dt) {
    player.x += window.Input.move.x * player.speed * dt;
    player.y += window.Input.move.y * player.speed * dt;
  }

  function drawGrid(camX, camY) {
    ctx.strokeStyle = '#1c1f1a';
    ctx.lineWidth = 1;
    const startX = Math.floor(camX / TILE) * TILE - camX;
    const startY = Math.floor(camY / TILE) * TILE - camY;
    ctx.beginPath();
    for (let x = startX; x < width; x += TILE) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = startY; y < height; y += TILE) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  }

  function drawStick() {
    const s = window.Input.stick;
    if (!s) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, window.Input.RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const camX = player.x - width / 2;
    const camY = player.y - height / 2;

    ctx.fillStyle = '#0d0f0c';
    ctx.fillRect(0, 0, width, height);
    drawGrid(camX, camY);

    ctx.fillStyle = '#c9b56a';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, player.r, 0, Math.PI * 2);
    ctx.fill();

    drawStick();

    ctx.fillStyle = '#777';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Стикс — прототип', 12, 22);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!window.Platform.paused) update(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.Platform.on('resume', () => { last = performance.now(); });
  resize();
  requestAnimationFrame(frame);
})();
