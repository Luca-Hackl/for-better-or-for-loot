/** Dependency-free canvas confetti burst. Browser-only. */
export function fireConfetti(opts?: { particleCount?: number; colors?: string[]; spread?: number }) {
  if (typeof document === "undefined") return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const count = opts?.particleCount ?? 150;
  const colors = opts?.colors ?? ["#ff3b4e", "#35d0e0", "#ffcc33", "#34d399", "#c46bff", "#ffffff"];
  const spread = opts?.spread ?? 200;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999";
  canvas.width = W;
  canvas.height = H;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const parts = Array.from({ length: count }).map(() => ({
    x: W / 2 + (Math.random() - 0.5) * spread,
    y: H / 3 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 11,
    vy: Math.random() * -13 - 4,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
  }));

  const start = performance.now();
  const DUR = 2800;
  function frame(t: number) {
    const el = t - start;
    ctx!.clearRect(0, 0, W, H);
    const alpha = Math.max(0, 1 - el / DUR);
    for (const p of parts) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }
    if (el < DUR) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
