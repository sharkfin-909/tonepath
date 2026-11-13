---
id: 41
title: "Spec update"
labels: [wayfinder:task]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Fold the decisions made since [Spec assembly](036-spec-assembly.md) into [SPEC.md](../SPEC.md) and clear its §15 open items:
- [VexFlow notation spike](040-vexflow-notation-spike.md) into §2 (drop the fallback) and §7 (headroom, label minimums, ghost-note spacing, bundled fonts, the resize gotcha);
- [Bar editing](037-bar-editing.md) into §4.1, §6.3 and §11 (bar handle, menu, shortcuts);
- [Hex for slots without a scale](038-hex-for-slots-without-a-scale.md) into §5.2, §8.2 and §3.3;
- [Notation details](039-notation-details.md) into §7.1, §7.2 and §12.3.

Keep the accepted risk (light-band contrast) as a note. If nothing is left open, the map's destination is reached.

## Resolution

Done 2026-11-13 (AFK task). [SPEC.md](../SPEC.md) now carries every decision on the map:

- **§2 / §7.1** — VexFlow 5 core adopted, fallback dropped; fonts bundled (no CDN); SOFT voices + `GhostNote` padding; fixed 3-ledger-line headroom; label minimums 11px / 9px; VexFlow spacing; `Renderer.resize` gotcha; draw after fonts ready. Beaming by beat (compound: groups of 3 eighths), never across a slot line.
- **§7.2** — mark colours `#D62728` + ring / `#B5B5B5` / both, hover reason.
- **§3.1, §3.3, §3.4, §4.1, §4.2, §6.3, §11** — bar editing: handle + menu, selection, ⌘C/V/D/⌫, "+", melody moves with the bars, paste replaces, split refusal, merge, caret rule, minimum one bar; every bar edit one undo step.
- **§5.2, §8.3, new §8.4, §9, §3.3** — rests-only hex (N.C. / empty / unparseable) and chord-tones hex (no-fit chord), with labels, audio and Play-mode behaviour.
- **§12.3** — slot-crossing import repair (shorten + rest-pad, counted in the toast).
- **§14** — new test tables 8 (bar editing) and 9 (beaming), plus no-scale hex and import-repair rows.
- **§15** — no open items left; three accepted risks kept as notes (hex-theme contrast, VexFlow spacing, performance measured on laptop Chrome only).

Nothing remains to decide: the map's destination (a build-ready v1 spec) is reached.
