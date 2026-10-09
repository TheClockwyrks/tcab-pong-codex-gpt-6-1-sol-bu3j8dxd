import type { RenderApi } from "@clockwyrks/simple-2d";
import type { ReadState } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./menus";
const INK = "#e9f1ed",
  CYAN = "#70e4df",
  CORAL = "#ff927f",
  GOLD = "#eec56c",
  MUTED = "#748b95";
function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size = 16,
  color = INK,
  align: CanvasTextAlign = "left",
  weight = 400,
) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px ${size < 22 ? "monospace" : "sans-serif"}`;
  ctx.fillText(str, x, y);
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 7));
  ctx.fill();
  ctx.shadowBlur = 0;
}
function court(s: ReadState, ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#152730";
  ctx.lineWidth = 1;
  for (let x = 100; x < C.FIELD_W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.FIELD_H);
    ctx.stroke();
  }
  for (let y = 0; y < C.FIELD_H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(C.FIELD_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#344650";
  ctx.setLineDash([6, 14]);
  ctx.beginPath();
  ctx.moveTo(C.NET_X, 20);
  ctx.lineTo(C.NET_X, C.FIELD_H - 20);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#3a5661";
  ctx.fillRect(24, 0, C.FIELD_W - 48, 2);
  ctx.fillRect(24, C.FIELD_H - 2, C.FIELD_W - 48, 2);
  for (const o of s.obstacles) {
    bar(
      ctx,
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      GOLD,
    );
    text(
      ctx,
      o.index === 0 ? "A" : "B",
      o.cx,
      o.cy - C.OBSTACLE_HH - 16,
      12,
      MUTED,
      "center",
    );
  }
  bar(
    ctx,
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CYAN,
  );
  bar(
    ctx,
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CORAL,
  );
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      ctx.strokeStyle = `rgba(233,241,237,${(i / b.trail.length) * 0.45})`;
      ctx.lineWidth = 3 + (i / b.trail.length) * 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
      ctx.lineTo(b.trail[i].x, b.trail[i].y);
      ctx.stroke();
    }
    ctx.shadowColor = INK;
    ctx.shadowBlur = 20;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
function menu(s: ReadState, ctx: CanvasRenderingContext2D) {
  items(s).forEach((item, i) => {
    const r = menuItemRect(s, i)!;
    const active = s.menuIndex === i;
    ctx.fillStyle = active ? "#203d45" : "#101f28";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    if (active) {
      ctx.fillStyle = CYAN;
      ctx.fillRect(r.x, r.y, 3, r.h);
    }
    text(ctx, item, r.x + 24, r.y + 34, 18, active ? INK : MUTED, "left", 600);
    if (active) text(ctx, "↗", r.x + r.w - 30, r.y + 35, 22, CYAN, "center");
  });
}
export function render(s: ReadState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  court(s, ctx);
  if (s.screen === "title") {
    ctx.fillStyle = "rgba(11,20,27,0.92)";
    ctx.fillRect(0, 0, 700, C.FIELD_H);
    text(ctx, "THE ANGLE IS ONLY THE BEGINNING", 140, 157, 14, CYAN);
    text(ctx, C.TITLE_TEXT, 132, 285, 112, INK, "left", 800);
    text(ctx, "A duel of motion, spin & ricochet.", 140, 324, 19, MUTED);
    menu(s, ctx);
    text(ctx, "01 / MOVE", 800, 194, 13, CYAN);
    text(ctx, "02 / BEND", 800, 222, 13, INK);
    text(ctx, "03 / BANK", 800, 250, 13, GOLD);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(745, 360);
    ctx.bezierCurveTo(930, 300, 1060, 560, 1160, 410);
    ctx.stroke();
    text(ctx, "TWO PADDLES. INFINITE ANGLES.", 800, 640, 12, MUTED);
  } else if (s.screen === "howto") {
    ctx.fillStyle = "rgba(11,20,27,0.96)";
    ctx.fillRect(100, 80, 1080, 590);
    text(ctx, "MAKE YOUR MOVE", 160, 166, 48, INK, "left", 700);
    text(ctx, "A little momentum changes everything.", 160, 207, 20, MUTED);
    const rows = [
      [
        "01  CONTROL",
        "W / S moves left. ↑ / ↓ moves right.",
        "In Solo, either pair moves your paddle.",
      ],
      [
        "02  CURVE",
        "Move as you strike to put spin on the ball.",
        "Top & bottom contacts change the outgoing angle.",
      ],
      [
        "03  CAROM",
        "Bank off the amber obstacles to find a new route.",
        `First to ${C.WIN_SCORE}, with a ${C.WIN_LEAD}-point lead, wins.`,
      ],
    ];
    rows.forEach((r, i) => {
      const y = 280 + i * 94;
      text(ctx, r[0], 160, y, 16, CYAN);
      text(ctx, r[1], 360, y, 20);
      text(ctx, r[2], 360, y + 30, 16, MUTED);
    });
    menu(s, ctx);
  } else {
    text(
      ctx,
      s.mode === "solo" ? "YOU" : "PLAYER 1",
      450,
      45,
      12,
      CYAN,
      "center",
    );
    text(
      ctx,
      s.mode === "solo" ? "COMPUTER" : "PLAYER 2",
      830,
      45,
      12,
      CORAL,
      "center",
    );
    text(ctx, String(s.score.p1), 450, 110, 64, INK, "center", 700);
    text(ctx, String(s.score.p2), 830, 110, 64, INK, "center", 700);
    text(
      ctx,
      s.mode === "solo" ? "SOLO / HUMAN × MACHINE" : "VERSUS / LOCAL DUEL",
      C.FIELD_CX,
      35,
      12,
      MUTED,
      "center",
    );
    if (s.screen === "countdown") {
      text(ctx, "GET READY", C.FIELD_CX, 286, 13, CYAN, "center");
      text(
        ctx,
        String(Math.max(1, Math.ceil(s.ball?.holdTimer ?? 0))),
        C.FIELD_CX,
        455,
        52,
        INK,
        "center",
        700,
      );
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "rgba(11,20,27,0.83)";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      ctx.fillStyle = "#10212a";
      ctx.beginPath();
      ctx.roundRect(400, 174, 480, 420, 12);
      ctx.fill();
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : `${s.winner === "left" ? "PLAYER 1" : s.mode === "solo" ? "COMPUTER" : "PLAYER 2"} WINS`,
        C.FIELD_CX,
        265,
        40,
        INK,
        "center",
        700,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Take a breath. Find your angle."
          : `${s.score.p1}  —  ${s.score.p2}`,
        C.FIELD_CX,
        309,
        18,
        MUTED,
        "center",
      );
      menu(s, ctx);
    }
  }
  text(
    ctx,
    s.screen === "title"
      ? "↑ ↓ / W S  SELECT     ENTER  PLAY"
      : "P / ESC  PAUSE",
    s.screen === "title" ? 140 : 96,
    687,
    12,
    MUTED,
  );
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1184,
    687,
    12,
    MUTED,
    "right",
  );
  ctx.restore();
}
