import * as C from "./constants";
import type {
  BallState,
  CaromState,
  ReadState,
  Side,
  Screen,
  Mode,
} from "./game";
import { menuItemRect } from "./menus";

export function parkedBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: Math.random() < 0.5 ? -1 : 1,
    trail: [],
  };
}
export function initialState(muted: boolean): CaromState {
  const paddle = { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: { ...paddle }, right: { ...paddle } },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: C.OBSTACLE_CENTERS.map((p, index) => ({
      index,
      cx: p.x,
      cy: p.y,
    })),
    simTime: 0,
    muted,
  };
}
function ballPatch(s: ReadState, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("Carom: ball is absent");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePatch(
  s: ReadState,
  side: Side,
  patch: Partial<CaromState["paddles"]["left"]>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebug() {
  return {
    version: C.CAROM_DEBUG_VERSION,
    clearWorld: (s: ReadState): CaromState => ({
      ...s,
      ball: null,
      obstacles: [],
    }),
    spawnBall: (s: ReadState): CaromState => ({ ...s, ball: parkedBall() }),
    spawnObstacle: (s: ReadState, index: number): CaromState => {
      const p = C.OBSTACLE_CENTERS[index];
      if (!p || !Number.isInteger(index))
        throw new Error("Carom: invalid obstacle");
      return {
        ...s,
        obstacles: [
          ...s.obstacles.filter((o) => o.index !== index),
          { index, cx: p.x, cy: p.y },
        ].sort((a, b) => a.index - b.index),
      };
    },
    reset: (s: ReadState) => initialState(s.muted),
    reconcile: (s: ReadState): CaromState => ({ ...s }),
    setScreen: (s: ReadState, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: ReadState, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: ReadState, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: ReadState, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: ReadState,
      resumeScreen: "playing" | "countdown",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: ReadState, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: ReadState, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: ReadState, receiver: Side): CaromState => ({
      ...s,
      receiver,
    }),
    setPaddleCy: (s: ReadState, side: Side, cy: number) =>
      paddlePatch(s, side, { cy }),
    setPaddleVy: (s: ReadState, side: Side, drivenVy: number) =>
      paddlePatch(s, side, { drivenVy }),
    setPaddleDriven: (s: ReadState, side: Side, driven: boolean) =>
      paddlePatch(s, side, { driven }),
    setBallPosition: (s: ReadState, x: number, y: number) =>
      ballPatch(s, { x, y }),
    setBallVelocity: (s: ReadState, vx: number, vy: number) =>
      ballPatch(s, { vx, vy }),
    setBallSpin: (s: ReadState, spin: number) => ballPatch(s, { spin }),
    setBallHeld: (s: ReadState, held: boolean) => ballPatch(s, { held }),
    setBallHoldTimer: (s: ReadState, holdTimer: number) =>
      ballPatch(s, { holdTimer }),
    setBallServeSign: (s: ReadState, serveSign: 1 | -1) =>
      ballPatch(s, { serveSign }),
    drawBallServeSign: (s: ReadState) =>
      ballPatch(s, { serveSign: Math.random() < 0.5 ? -1 : 1 }),
    setAiTracking: (s: ReadState, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: ReadState, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: ReadState, muted: boolean): CaromState => ({ ...s, muted }),
    snapshot: (s: ReadState) => ({
      screen: s.screen,
      mode: s.mode,
      menuIndex: s.menuIndex,
      titleIndex: s.titleIndex,
      resumeScreen: s.resumeScreen,
      winner: s.winner,
      receiver: s.receiver,
      muted: s.muted,
      simTime: s.simTime,
      version: C.CAROM_DEBUG_VERSION,
      score: { ...s.score },
      paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
      ai: { ...s.ai },
      ball: s.ball
        ? {
            ...s.ball,
            speed: Math.hypot(s.ball.vx, s.ball.vy),
            trail: s.ball.trail.map((p) => ({ ...p })),
          }
        : null,
      obstacles: s.obstacles.map((o) => ({ ...o })),
    }),
    menuItemRect,
  };
}
