# Shoot the Moon for iPad

A native iPad version of [Shoot the Moon](https://corrupt.net/shoot-the-moon), the hearts roguelike. The UI is SwiftUI. The game rules are the web game's own TypeScript engine, bundled and run in JavaScriptCore, so seeds, rules and saves match the web game exactly.

iPad only, landscape only.

## Building

You need Xcode, [XcodeGen](https://github.com/yonaskolb/XcodeGen) and Node. The engine and audio come from the web game's repo, which is expected at `~/src/node/shoot-the-moon`; set `SHOOT_THE_MOON_WEB` to use another path.

```bash
xcodegen generate
open ShootTheMoon.xcodeproj
```

Each build bundles the engine (`npm run build:bridge` in the web repo) into `Resources/game-bundle.js`. The first build also pre-renders the sound effects and music takes into `Resources/Audio`, which takes a few seconds; delete that folder to render them again.
