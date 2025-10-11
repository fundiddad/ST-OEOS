// OEOS SillyTavern Extension Entry
// Keep imports relative inside this folder.
// This file is deployed to SillyTavern under
// public/scripts/extensions/third-party/oeos-st-extension/

import './plugin-bridge.js'
// If you need to run any initialization on ST load, do it here.
// Example: show a small toast that OEOS plugin is loaded (if toastr is present).
try {
  if (typeof toastr !== 'undefined') {
    toastr.info('[OEOS] plugin loaded')
  }
} catch {}

