---
id: 76
title: "Real-device check"
labels: [needs-human]
status: open
blocked_by: [71, 74]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

Check on real hardware what can't be checked from automation: the permission prompt and the held-audio overlay on an
open straight into Tuner, Read etude on a tablet, and Improvise with an instrument and speakers.

## Acceptance criteria

- [ ] Safari (macOS / iPad) and Chrome: opening in Tuner asks for the mic; *tap to start listening* clears on the first tap; denying shows the blocked message
- [ ] Read etude on a 1024×768 tablet: 32 bars fit; the playhead is easy to follow
- [ ] Improvise with a real instrument and speakers: *Audio on chord* does not light the hex or trigger the waiting sound (echo guard)

## Blocked by

- [071](071-open-in-tuner-with-mic-states.md)
- [074](074-read-etude-with-the-transport.md)
