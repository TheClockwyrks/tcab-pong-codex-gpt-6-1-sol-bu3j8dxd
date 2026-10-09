import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
});
async function setup(ms = 10) {
  const target = new EventTarget(),
    canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  await engine.initialize();
  cleanups.push(() => engine.destroy());
  const key = (code: string, down = true) =>
    target.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pose = (x: number, y: number, vx: number, vy = 0) =>
    engine.apply((s) => ({
      ...s,
      screen: "playing",
      mode: "versus",
      obstacles: [],
      ball: { ...s.ball!, x, y, vx, vy, held: false, spin: 0, trail: [] },
    }));
  return { engine, key, tap, pose, canvas, target };
}
describe("Carom through the engine", () => {
  it("initializes the complete immutable title and diagnostics", async () => {
    const { engine } = await setup();
    expect(engine.debug.snapshot(engine.state)).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      receiver: "left",
      ball: { held: true, speed: 0 },
      score: { p1: 0, p2: 0 },
    });
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(12);
    const previous = engine.state;
    engine.apply((s) => engine.debug.setScore(s, 4, 5));
    expect(previous.score.p1).toBe(0);
    expect(engine.state.score.p1).toBe(4);
  });
  it("serves after a timed hold without moving on its serve frame", async () => {
    const { engine, tap } = await setup();
    await tap("Enter");
    await engine.advance(99);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(C.SERVE_SPEED);
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("freezes and resumes once on Escape, and mirrors mute", async () => {
    const { engine, tap } = await setup();
    await tap("Enter");
    await tap("Escape");
    const b = engine.state.ball;
    await engine.advance(20);
    expect(engine.state.ball).toEqual(b);
    expect(engine.state.screen).toBe("paused");
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
  });
  it("integrates human and driven paddles and reports clamped velocity", async () => {
    const { engine, key } = await setup();
    engine.apply((s) => ({ ...s, screen: "countdown", mode: "versus" }));
    key("KeyW");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY - C.PADDLE_SPEED * 0.01,
    );
    engine.apply((s) => engine.debug.setPaddleDriven(s, "right", true));
    engine.apply((s) => engine.debug.setPaddleVy(s, "right", 1000));
    await engine.advance(40);
    expect(engine.state.paddles.right.cy).toBe(C.PADDLE_MAX_CY);
    expect(engine.state.paddles.right.vy).toBe(0);
    expect(engine.state.paddles.right.drivenVy).toBe(1000);
  });
  it("solo accepts arrows for the human and gates AI faculties independently", async () => {
    const { engine, key, pose } = await setup();
    pose(1000, 180, 520);
    engine.apply((s) => engine.debug.setMode(s, "solo"));
    key("ArrowUp");
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(-C.PADDLE_SPEED);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    engine.apply((s) => engine.debug.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    engine.apply((s) =>
      engine.debug.setAiMovement(engine.debug.setAiTracking(s, false), true),
    );
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
  });
  it("paddle hit accelerates and adds integrated paddle spin", async () => {
    const { engine, pose } = await setup();
    pose(C.P1_X1 + C.BALL_R + 1, C.FIELD_CY, -520);
    engine.apply((s) => engine.debug.setPaddleDriven(s, "left", true));
    engine.apply((s) => engine.debug.setPaddleVy(s, "left", 200));
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520 * C.SPEED_MULT);
    expect(engine.state.ball!.spin).toBeGreaterThan(160);
    expect(cues).toEqual([C.CUES.paddleHit]);
  });
  it("wall and obstacle bounce preserve speed and emit distinct cues", async () => {
    const { engine, pose } = await setup();
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    pose(300, C.BALL_R + 1, 0, -520);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(520);
    pose(C.OBSTACLES[0].x0 - C.BALL_R - 1, 220, 520);
    engine.apply((s) => engine.debug.spawnObstacle(s, 0));
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBe(-520);
    expect(cues).toEqual([C.CUES.wallBounce, C.CUES.obstacleBounce]);
  });
  it("end caps reflect without a speed increase", async () => {
    const { engine, pose } = await setup();
    pose(C.P1_X0 + 4, C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1, 0, 520);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-520);
  });
  it("scores beyond the full radius and wins only with a two-point lead", async () => {
    const { engine, pose } = await setup();
    engine.apply((s) => engine.debug.setScore(s, 10, 10));
    pose(C.FIELD_W + C.BALL_R + 1, 350, 520);
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 11, p2: 10 });
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    pose(C.FIELD_W + C.BALL_R + 1, 350, 520);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
  });
  it("curves flight with exponential spin decay consistently across frame lengths", async () => {
    const drive = async (ms: number) => {
      const { engine, pose } = await setup(ms);
      pose(300, 360, 520);
      engine.apply((s) => engine.debug.setBallSpin(s, 300));
      await engine.advance(800 / ms);
      return engine.state.ball!;
    };
    const a = await drive(2),
      b = await drive(16);
    expect(a.spin).toBeCloseTo(150);
    expect(b.spin).toBeCloseTo(150);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(520);
    expect(Math.abs(a.vy - b.vy)).toBeLessThan(2);
  });
  it("debug poses work without advancing, and absent entities fail loudly", async () => {
    const { engine } = await setup();
    engine.apply((s) => engine.debug.clearWorld(s));
    expect(engine.debug.snapshot(engine.state).ball).toBeNull();
    expect(() => engine.debug.setBallSpin(engine.state, 3)).toThrow();
    expect(() => engine.debug.spawnObstacle(engine.state, 2)).toThrow();
    engine.apply((s) => engine.debug.spawnBall(s));
    engine.apply((s) => engine.debug.setBallVelocity(s, 3, 4));
    const before = engine.debug.snapshot(engine.state);
    engine.apply((s) => engine.debug.reconcile(s));
    expect(engine.debug.snapshot(engine.state)).toEqual(before);
    expect(before.ball?.speed).toBe(5);
    engine.apply((s) => engine.debug.setMuted(s, true));
    engine.apply((s) => engine.debug.reset(s));
    expect(engine.state.muted).toBe(true);
    expect(engine.state.simTime).toBe(0);
  });
  it("menu movement precedes confirm and restores the remembered title item", async () => {
    const { engine, key, tap } = await setup();
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    key("KeyS", false);
    key("Enter", false);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    await tap("Escape");
    await tap("KeyS");
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.titleIndex).toBe(2);
  });
  it("pointer confirms require both edges inside the same menu item", async () => {
    const { engine, target } = await setup();
    const point = (type: string, x: number, y: number) =>
      target.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    const r = engine.debug.menuItemRect(engine.state, 1)!;
    point("pointerdown", r.x + 20, r.y + 20);
    await engine.advance(1);
    point("pointerup", r.x + 20, r.y + 20);
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.debug.menuItemRect(engine.state, 0)).toBeNull();
  });
  it("a cleared field remains empty while time advances", async () => {
    const { engine } = await setup();
    engine.apply((s) =>
      engine.debug.setScreen(engine.debug.clearWorld(s), "playing"),
    );
    await engine.advance(5);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.simTime).toBeCloseTo(0.05);
  });
});

describe("automation contract", () => {
  it("poses every scalar without changing unrelated state", async () => {
    const { engine } = await setup();
    const d = engine.debug;
    engine.apply((s) => d.setScreen(s, "paused"));
    engine.apply((s) => d.setMenuIndex(s, 2));
    engine.apply((s) => d.setTitleIndex(s, 1));
    engine.apply((s) => d.setResumeScreen(s, "countdown"));
    engine.apply((s) => d.setWinner(s, "right"));
    engine.apply((s) => d.setReceiver(s, "right"));
    engine.apply((s) => d.setPaddleCy(s, "left", 100));
    engine.apply((s) => d.setBallPosition(s, 200, 250));
    engine.apply((s) => d.setBallVelocity(s, -300, 400));
    engine.apply((s) => d.setBallSpin(s, -700));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallHoldTimer(s, 0.35));
    engine.apply((s) => d.setBallServeSign(s, -1));
    expect(d.snapshot(engine.state)).toMatchObject({
      screen: "paused",
      menuIndex: 2,
      titleIndex: 1,
      resumeScreen: "countdown",
      winner: "right",
      receiver: "right",
      paddles: { left: { cy: 100 } },
      ball: {
        x: 200,
        y: 250,
        vx: -300,
        vy: 400,
        speed: 500,
        spin: -700,
        held: false,
        holdTimer: 0.35,
        serveSign: -1,
      },
    });
    engine.apply((s) => d.drawBallServeSign(s));
    expect([-1, 1]).toContain(engine.state.ball!.serveSign);
    const before = engine.state;
    await engine.advance(1);
    expect(engine.state.ball).toEqual(before.ball);
  });
  it("reset releases drivers and restores all declared title defaults", async () => {
    const { engine } = await setup();
    const d = engine.debug;
    engine.apply((s) =>
      d.setPaddleDriven(d.setPaddleVy(s, "left", 500), "left", true),
    );
    engine.apply((s) => d.setAiTracking(d.setAiMovement(s, false), false));
    await engine.advance(5);
    engine.apply((s) => d.reset(s));
    expect(engine.state.paddles.left).toEqual({
      cy: C.FIELD_CY,
      vy: 0,
      driven: false,
      drivenVy: 0,
    });
    expect(engine.state.ai).toEqual({ tracking: true, movement: true });
    expect(engine.state.simTime).toBe(0);
  });
  it("rejects a pointer press released on a different item", async () => {
    const { engine, target } = await setup();
    const r = engine.debug.menuItemRect(engine.state, 0)!;
    const point = (type: string, y: number) =>
      target.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: r.x + 10,
          clientY: y,
          pointerId: 2,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    point("pointerdown", r.y + 10);
    await engine.advance(1);
    point("pointerup", r.y + 76);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("restarts, plays again, and returns from match results", async () => {
    const { engine, tap } = await setup();
    await tap("Enter");
    await tap("Escape");
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.screen).toBe("countdown");
    engine.apply((s) => ({
      ...s,
      screen: "matchover",
      winner: "right",
      menuIndex: 0,
    }));
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    engine.apply((s) => ({
      ...s,
      screen: "matchover",
      winner: "left",
      menuIndex: 0,
    }));
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
  });
});
