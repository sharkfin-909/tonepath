---
id: 53
title: "Chart zoom"
labels: [ready-for-agent]
status: closed
blocked_by: [52]
assignee: claude
---

## What to build

Automatic chart zoom (SPEC §3.1): scale so every row fits the chart area above the fixed 50% hex, capped ~1.4× on short forms; never below the readable floor (staff line gap ≈ 5px). Below the floor the chart scrolls vertically and keeps the caret's row in view. No manual zoom. Mind the VexFlow gotcha: `Renderer.resize` writes inline width / height, so set `style.width/height` (or use a viewBox wrapper) after each resize.

Spec: [SPEC.md](../SPEC.md) §3.1, §7.1. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] A 4-bar form fills the chart area without exceeding 1.4×
- [x] A 32-bar form at 4 per row shrinks to the floor then scrolls, following the caret
- [x] Window resize refits without distorted staves

## Blocked by

- [Notation details](052-notation-details.md)

## Resolution

Built.

- Pure `src/zoom.ts`:
  - `fitZoom(rows, staveHeight, height, min = 0.5, max = 1.4)` returns the largest zoom at which every row fits (by bisection), or the floor plus `scrolls: true`.
  - `labelPx` / `headerPx` keep the label minimums: logical font size = `max(base, min / z)`, and the header grows to hold them.
  - Floor 0.5 = VexFlow's 10px staff gap → 5px. Stand mode can call it with `min = 0` (no floor).
  - Tests in `src/zoom.test.ts`.
- `Chart` measures its parent's content box with a ResizeObserver. It lays the rows out at logical width `area / z` and applies `transform: scale(z)`, so staves are never re-sized non-uniformly (this also avoids the `Renderer.resize` inline-style gotcha).
  - The `.chart-fit` box takes the scaled height and uses `overflow-x: clip`, so vertical overflow (scale menus, far-out notes) stays visible.
  - Label sizes come from the CSS variables `--chord-px` / `--scale-px`; the header height is a prop on each slot.
  - When the chart scrolls, the active slot is scrolled into view (`block: 'nearest'`) on every caret or zoom change.
- Stave clicks convert screen px → logical px (`offsetWidth / rect.width`), so caret placement stays exact at any zoom.
- Checked in the browser: the 4-bar form sits at 1.4× (capped). A 32-bar test form at 4 per row stops at the 0.5 floor (rendered staff 55px), with labels at exactly 11px / 9px; it scrolls and follows the caret from bar 21 back to bar 3. A click between notes snaps correctly at 0.5×. Resizing refits with undistorted staves and no horizontal scroll. The user's data was restored afterwards.
