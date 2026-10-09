import * as C from "./constants";
import type { CaromState, ReadState, Mode } from "./game";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import { initialState, parkedBall } from "./debug";
export function items(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: ReadState, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= items(s).length)
    return null;
  return {
    x: s.screen === "title" ? 140 : 440,
    y: (s.screen === "howto" ? 590 : 360) + index * 66,
    w: s.screen === "title" ? 360 : 400,
    h: 54,
  };
}
export function start(s: ReadState, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
  };
}
function title(s: ReadState): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function confirm(s: ReadState): CaromState {
  if (s.screen === "title") {
    const t = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...t, screen: "howto", menuIndex: 0 }
      : start(t, s.menuIndex === 0 ? "solo" : "versus");
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? start(s, s.mode)
        : title(s);
  return s.menuIndex === 0 ? start(s, s.mode) : title(s);
}
// The press origin travels with the immutable state, never in an input closure.
type MenuState = CaromState & {
  readonly menuPresses?: Readonly<Record<number, number>>;
};
export function readInput(state: ReadState, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  api.input.pointer();
  let s: MenuState = { ...state };
  api.audio.setMuted(edges.mute ? !s.muted : s.muted);
  s = { ...s, muted: api.audio.muted() };
  if (s.screen === "playing" || s.screen === "countdown")
    return edges.pause
      ? { ...s, resumeScreen: s.screen, screen: "paused", menuIndex: 0 }
      : s;
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return title(s);
  const up = edges["p1-up"] || edges["p2-up"],
    down = edges["p1-down"] || edges["p2-down"];
  const count = items(s).length;
  if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
  const keyboardConfirm = !up && !down && edges.confirm;
  const keyboardItem = s.menuIndex;
  const presses = { ...s.menuPresses };
  let pointerConfirm = false;
  const hit = (x: number, y: number) =>
    items(s).findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
  for (const p of samples) {
    if (p.button && p.button !== "primary") continue;
    const index = hit(p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (p.type === "down") presses[p.id] = index;
    if (p.type === "up") {
      if (index >= 0 && presses[p.id] === index) pointerConfirm = true;
      delete presses[p.id];
    }
  }
  for (const p of contacts) {
    const index = hit(p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  s = { ...s, menuPresses: presses };
  if (keyboardConfirm) return confirm({ ...s, menuIndex: keyboardItem });
  return pointerConfirm ? confirm(s) : s;
}
