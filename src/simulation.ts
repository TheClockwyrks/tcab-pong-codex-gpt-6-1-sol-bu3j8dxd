import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, ReadState, PaddleState, BallState } from "./game";
import * as C from "./constants";
import { parkedBall } from "./debug";
import { readInput } from "./menus";
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
function paddle(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
function movePaddles(s: ReadState, api: UpdateApi, dt: number): CaromState {
  const held = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.value(a) > 0 ? 1 : 0]),
  );
  const leftVy =
    ((held["p1-down"] || (s.mode === "solo" && held["p2-down"]) ? 1 : 0) -
      (held["p1-up"] || (s.mode === "solo" && held["p2-up"]) ? 1 : 0)) *
    C.PADDLE_SPEED;
  let rightVy = (held["p2-down"] - held["p2-up"]) * C.PADDLE_SPEED;
  if (s.mode === "solo") {
    const defending =
      s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0;
    const target =
      defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
    const diff = target - s.paddles.right.cy;
    rightVy =
      !s.ai.movement ||
      Math.abs(diff) <= (defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE)
        ? 0
        : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  }
  return {
    ...s,
    paddles: {
      left: paddle(
        s.paddles.left,
        s.paddles.left.driven ? s.paddles.left.drivenVy : leftVy,
        dt,
      ),
      right: paddle(
        s.paddles.right,
        s.paddles.right.driven ? s.paddles.right.drivenVy : rightVy,
        dt,
      ),
    },
  };
}
// Mutable scratch values are local to a single transition; the input is never changed.
type Flight = { -readonly [K in keyof BallState]: BallState[K] };
function rectangle(b: Flight, r: C.Rect): number | null {
  if (
    b.x <= r.x0 - C.BALL_R ||
    b.x >= r.x1 + C.BALL_R ||
    b.y <= r.y0 - C.BALL_R ||
    b.y >= r.y1 + C.BALL_R
  )
    return null;
  const depths = [
    b.x - r.x0 + C.BALL_R,
    r.x1 + C.BALL_R - b.x,
    b.y - r.y0 + C.BALL_R,
    r.y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face === 0) {
    b.x = r.x0 - C.BALL_R;
    if (b.vx > 0) b.vx = -b.vx;
  }
  if (face === 1) {
    b.x = r.x1 + C.BALL_R;
    if (b.vx < 0) b.vx = -b.vx;
  }
  if (face === 2) {
    b.y = r.y0 - C.BALL_R;
    if (b.vy > 0) b.vy = -b.vy;
  }
  if (face === 3) {
    b.y = r.y1 + C.BALL_R;
    if (b.vy < 0) b.vy = -b.vy;
  }
  return face;
}
function flight(s: ReadState, dt: number, cues: Set<string>): BallState {
  const b: Flight = { ...s.ball! };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const a = (b.spin / speed) * h,
        vx = b.vx;
      b.vx = vx * Math.cos(a) - b.vy * Math.sin(a);
      b.vy = vx * Math.sin(a) + b.vy * Math.cos(a);
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y < C.BALL_R && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y > C.FIELD_H - C.BALL_R && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side],
        left = side === "left";
      const face = rectangle(b, {
        x0: left ? C.P1_X0 : C.P2_X0,
        x1: left ? C.P1_X1 : C.P2_X1,
        y0: p.cy - C.PADDLE_HALF,
        y1: p.cy + C.PADDLE_HALF,
      });
      if (face === null) continue;
      if (face < 2) {
        const theta =
          clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
        const speed = Math.min(
          Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
          C.SPEED_CAP,
        );
        b.vx = (left ? 1 : -1) * speed * Math.cos(theta);
        b.vy = speed * Math.sin(theta);
        b.spin = clamp(
          b.spin + p.vy * C.SPIN_FROM_PADDLE,
          -C.SPIN_CLAMP,
          C.SPIN_CLAMP,
        );
        b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
        cues.add(C.CUES.paddleHit);
      } else cues.add(C.CUES.wallBounce);
    }
    for (const o of s.obstacles) {
      if (rectangle(b, C.OBSTACLES[o.index]) !== null)
        cues.add(C.CUES.obstacleBounce);
    }
  }
  return b;
}
export function update(
  state: ReadState,
  api: UpdateApi,
  dt: number,
): CaromState {
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = movePaddles(s, api, dt);
  if (!s.ball) return s;
  const cues = new Set<string>();
  let b = s.ball;
  if (s.screen === "countdown") {
    const holdTimer = Math.max(0, b.holdTimer - dt);
    b = { ...b, x: C.FIELD_CX, y: C.FIELD_CY, holdTimer };
    if (holdTimer <= 0) {
      b = {
        ...b,
        held: false,
        vx:
          (s.receiver === "left" ? -1 : 1) *
          C.SERVE_SPEED *
          Math.cos(C.SERVE_ANGLE),
        vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        trail: [],
      };
      s = { ...s, screen: "playing" };
    }
  } else if (!b.held) b = flight(s, dt, cues);
  b = {
    ...b,
    trail: [
      ...b.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
      { x: b.x, y: b.y, t: s.simTime },
    ],
  };
  s = { ...s, ball: b };
  if (!b.held && (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)) {
    const left = b.x > C.FIELD_W,
      score = {
        p1: s.score.p1 + (left ? 1 : 0),
        p2: s.score.p2 + (left ? 0 : 1),
      };
    const win =
      (left ? score.p1 : score.p2) >= C.WIN_SCORE &&
      Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
    s = win
      ? {
          ...s,
          score,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
        }
      : {
          ...s,
          score,
          receiver: left ? "right" : "left",
          ball: parkedBall(),
          screen: "countdown",
        };
    cues.add(C.CUES.score);
  }
  for (const cue of cues) api.audio.play(cue);
  return s;
}
