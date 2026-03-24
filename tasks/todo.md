# Task Plan - 2026-03-24

## Objective

Reduce Three.js background brightness peaks so desktop/mid-screen moments stay darker and less distracting.

## Plan

- [x] Locate shader intensity/brightness hotspots in background renderer.
- [x] Reduce highlight/specular intensity and apply a mild global brightness multiplier.
- [x] Darken highlight palette accent to reduce flash-like peaks.
- [x] Validate with typecheck/lint.

## Review

- Status: Completed
- Notes:
  - Updated `components/eye-candy.tsx` shader uniforms and params:
    - added `u_brightness`
    - added `u_highlightStrength`
    - reduced highlight color from `#cce9ff` to `#a6d2ff`
  - Final output now applies brightness scaling after vignette mask.
  - Validation:
    - `npm run typecheck` pass
    - `npm run lint` pass
