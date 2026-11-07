# Shoot the Moon

A Hearts roguelike for the browser. Dodge points, or take them all and shoot the moon, and build a relic engine that turns each hand into a bigger score, across eight tables.

Built on the same stack as [Vulnerable](https://corrupt.net/vulnerable/), the contract bridge roguelike: SvelteKit 2, Svelte 5, a pure TypeScript engine, and every card, icon and sound generated in code.

## How to play

- **Hearts, against three opponents.** Every heart you take costs a point; the queen of spades costs 13. Take all 26 and you shoot the moon.
- **Passing.** Each hand starts with a three-card pass: left, right, across, then a hand with no passing. The two of clubs leads, you must follow suit, no points on the first trick, and hearts can't be led until one has been played.
- **Scoring.** Each hand scores *chips × mult*. Base chips are the points you dodged (26 minus what you took), plus 10 for a clean hand. Shooting the moon pays 78. If an opponent shoots the moon, you score nothing.
- **Structure.** 8 tables × 3 boards; three hands per board to reach its target. The third board at each table is the High Board.
- **The club.** Win boards to earn money, then buy **relics** (23 of them: some reward clean play, some pay you to take hearts or the queen, so a run can go hunting instead of hiding) and **upgrades**, which level up dodging, clean hands or the moon.

**Controls:** tap three cards and **Pass**. Click a card to play it, or drag it onto the table. Drag any card to rearrange your hand. **Play it out** hands the rest of the hand to the autopilot. Space or Enter continues; Escape goes to the menu; M toggles the music. Runs save automatically.

## Running it

Needs Node 22.18 or newer.

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run simulate
```

`npm run simulate` plays complete runs with a bot that passes and plays with the opponents' AI and shops by a simple rule. The targets are tuned so it wins about 14% of runs; a thoughtful player should do better.

## Layout

```
src/lib/rules/     cards, RNG, the rules of Hearts, the AI
src/lib/game/      the run: tables, boards, scoring, relics, upgrades, the club
src/lib/app/       game controller, auto-save (seed + action log, replayed), layout, effects
src/lib/audio/     synthesized sound effects and generative music
src/lib/ui/        pixel-art and smooth cards, icons, palette, settings
src/lib/components the Svelte UI
tools/             balance bot and simulator
tests/             node --test suites
```

## Deploying

`.github/workflows/deploy.yml` builds and publishes with GitHub Pages on every push to `main`, with the base path taken from the repository name. In a repo named `shoot-the-moon` on the dpmcnevin account, that serves the game at https://corrupt.net/shoot-the-moon/. Turn on Pages once under Settings → Pages → Source: GitHub Actions.

## Prototype status

- Relic icons reuse Vulnerable's pixel art for now.
- The opponents are heuristic: they duck, dump the queen, flush her out with low spades and gang up on a moon attempt, but never try to shoot the moon themselves.
