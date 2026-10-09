import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { createDebug, initialState } from "./debug";
import { update } from "./simulation";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;
}

export type ReadState = DeepReadonly<CaromState>;
export type CaromDebugApi = ReturnType<typeof createDebug>;
export const BACKGROUND = "#0b141b";
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    const frequencies = [620, 280, 880, 440];
    Object.values(C.CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        wave: i === 2 ? "triangle" : "sine",
        freq: frequencies[i],
        freqTo: frequencies[i] / 2,
        gain: 0.16,
        durationMs: i === 3 ? 220 : 65,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball ${key}`, (s) => s.ball?.[key] ?? "absent");
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "absent",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side} ${key}`, (s) => s.paddles[side][key]);
    return [initialState(false), createDebug()];
  },
  update,
  render,
};
