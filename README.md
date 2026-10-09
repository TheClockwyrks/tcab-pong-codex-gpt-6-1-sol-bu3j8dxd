# Carom

A browser paddle duel about angles and momentum. Move as you strike to curve the ball, bank off two obstacles, and race to 11 points with a two-point lead. Play Solo against the computer or Versus with a friend on the same keyboard. Graphics and audio are generated in code; no backend or runtime downloads are needed.

## Run

Install with `npm ci`, then use `npm run dev` for the development server.
`npm run build` produces the complete static site in `dist/`. Serve that directory at the root of any static server, or run `npm run preview` locally.

## Controls

- Solo: W/S or up/down arrows move your paddle.
- Versus: W/S moves player one; up/down arrows move player two.
- Menus: either movement pair selects, Enter or Space confirms. Mouse and touch also select and confirm items.
- P or Escape pauses and resumes; Escape returns from instructions or match results.
- M toggles sound. Backquote toggles the engine diagnostic overlay.
- Touch devices get the engine's two vertical paddle controls.

## Checks

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` check types, lint, formatting, and the simulation. Tests run the Simple 2D engine with an in-process canvas and a controlled clock. The immutable game state and debug surface support repeatable scenarios without a browser.

The player presentation and captured game media are in `showcase/`.
