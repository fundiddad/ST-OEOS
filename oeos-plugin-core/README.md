# OEOS Plugin Core (for SillyTavern)

This directory contains the core files of the OEOS SillyTavern extension.

- These files are tracked in git (kept in this repo)
- During deployment they are copied into SillyTavern under:
  `SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/`
- Keep ES module imports relative within this folder (e.g., `./plugin-bridge.js`)
- The Vue app does NOT import from here at build time. It consumes the API via `window.oeosApi` at runtime.

Files you typically keep here:
- index.js (extension entry)
- plugin-bridge.js (exposes `window.oeosApi`)
- ui.js (loader that mounts the built Vue UI if needed)
- game-state.js, st-api.js, v4-parser.js (as needed)
- manifest.json (SillyTavern extension manifest)

