# Shoot the Moon

A Hearts roguelike for the browser. Dodge points, or take them all and shoot the moon, and build a relic engine that turns each hand into a bigger score, across eight tables.

Built on the same stack as [Vulnerable](https://corrupt.net/vulnerable/), the contract bridge roguelike: SvelteKit 2, Svelte 5, a pure TypeScript engine, and every card, icon and sound generated in code. There's also a native iPad version built on the same engine.

## Layout

One repo, three parts:

| Folder | What it is |
| --- | --- |
| `engine/` | The shared core in TypeScript: rules, run logic, saves, pixel art and sound synthesis (`src/`), the bridge the iPad app runs in JavaScriptCore (`bridge/`), the balance bot and simulator (`tools/`), and the tests. |
| `web/` | The browser game (SvelteKit). Imports the engine as `$engine/...`. |
| `ipad/` | The iPad app (SwiftUI). Its build step bundles `engine/` into the app. |

Both games name the rules they use: the web game `classic` (`WEB_RULESET` in `web/src/lib/app/game.svelte.ts`), the iPad `v2` (`IPAD_RULESET` in `engine/bridge/entry.ts`). `v2` adds relic editions, bosses, 32 more relics, opponents who go for the moon and gentler targets. A save records its ruleset, so changing the rules later means adding a new one.

## How to play

- **Hearts, against three opponents.** Every heart you take costs a point; the queen of spades costs 13. Take all 26 and you shoot the moon.
- **Passing.** Each hand starts with a three-card pass: left, right, across, then a hand with no passing. The lowest club leads (normally the two), you must follow suit, no points on the first trick, and hearts can't be led until they're broken: by a heart being played, or by someone taking the queen of spades.
- **Scoring.** Each hand scores *chips × mult*. Base chips are 26 minus the points you took, plus 10 for a clean hand. Shooting the moon (taking every point in the pack) pays three times the pack's points: 78 with a standard pack. If an opponent shoots the moon, you score nothing.
- **Structure.** 8 tables × 3 boards; three hands per board to reach its target. The third board at each table is the High Board.
- **The club.** Win boards to earn money, then spend it on:
  - **Relics** (23 of them): some reward clean play, some pay you to take hearts or the queen, so a run can go hunting instead of hiding.
  - **Upgrades**, which level up dodging, clean hands or the moon.
  - **Seals** that mark one card for the rest of the run: Gilded (+$2 when you win a trick with it), Ward (it carries no points), Thorn (3 extra points for whoever takes it; +12 chips when that's an opponent), Crown (+0.5 mult when you win a trick with it) and Homing (always dealt to you).
  - **Pack items** that change the pack everyone is dealt from: Burn a card, Recolor it into another suit, Promote it a rank, or Copy it. The pack stays between 36 and 64 cards; hands are the pack split four ways, and any leftover cards form a kitty that goes to whoever wins the first trick.

**Controls:** tap three cards and **Pass**. Click a card to play it, or drag it onto the table. Drag any card to rearrange your hand. **Play it out** hands the rest of the hand to the autopilot. Space or Enter continues; Escape goes to the menu; M toggles the music. Runs save automatically.

## Running it

Needs Node 22.18 or newer. From the repo root:

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

`npm test` runs the engine's tests; `npm run check` type-checks the engine and the web app; `npm run simulate` plays runs with the balance bot (`RULESET=v2` for the iPad's rules).

The iPad app needs Xcode and [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
cd ipad && xcodegen generate && open ShootTheMoon.xcodeproj
```
