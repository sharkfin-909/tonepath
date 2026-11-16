---
id: 71
title: "Open in Tuner, with mic states"
labels: [ready-for-agent]
status: closed
blocked_by: [70]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

Every open and reload starts in Tuner, so the browser may ask for the mic straight away. The tuner bar says what is
going on instead of showing a blank: *allow the microphone to start listening* while the browser asks, *tap to start
listening* while the browser holds the audio until a gesture (the first click or key resumes it), and why the mic
can't be used (blocked, no device, insecure page) — the mode stays and the hex keeps working.

## Acceptance criteria

- [x] A reload opens in Tuner
- [x] While the permission prompt is open the tuner bar says so
- [x] Suspended audio shows *tap to start listening* and resumes on the first click or key (no hang in `startListening`)
- [x] Blocked / missing / insecure mic: a message in the tuner bar; the mode does not change

## Blocked by

- [070](070-tuner-mode.md)

## Resolution

Built: `initialSession` mode `tuner`; `startListening` no longer awaits `resume()` (`onAudioState`, `resume`); `micProblem`; ListenPill messages.
