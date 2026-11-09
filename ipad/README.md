# Shoot the Moon for iPad

A native iPad version of [Shoot the Moon](https://corrupt.net/shoot-the-moon), the hearts roguelike. The UI is SwiftUI. The game rules are the shared TypeScript engine in `../engine`, bundled and run in JavaScriptCore, so a seed plays the same here as on the web under the same ruleset (the iPad uses `v2`).

iPad and iPhone, landscape only. On an iPad the stage is 1280 points wide and as tall as the screen; on an iPhone (wider than 16:9) it is 720 tall and as wide as the screen, clear of the camera cutout.

## Building

You need Xcode, [XcodeGen](https://github.com/yonaskolb/XcodeGen) and Node. Run `npm install` once at the repo root, then:

```bash
xcodegen generate
open ShootTheMoon.xcodeproj
```

Each build bundles the engine (`npm run -w engine build:bridge`) into `Resources/game-bundle.js` and records the repo commit it used (shown on the menu). The first build also pre-renders the sound effects and music takes into `Resources/Audio`, which takes a few seconds; delete that folder to render them again.

## Credits

The pixel font is [Jersey 10](https://fonts.google.com/specimen/Jersey+10) by The Soft Type Project Authors, under the SIL Open Font License 1.1 (`ShootTheMoon/Resources/Fonts/OFL.txt`).
