---
id: 9
title: "Graph-editing library survey"
labels: [wayfinder:research]
status: closed
parent: 1
blocked_by: []
assignee: research-agent
---

## Question

What are the realistic ways to render and edit a node-and-link lattice in React — hand-rolled SVG, React Flow (xyflow), and other options? For each: drag nodes, draw links between nodes, custom node rendering (labelled coloured circles), many small graphs on one page (one per bar) vs one large graph, performance, licence, bundle size. Facts for the rendering decision.

## Resolution

At Improwiser's scale (about 50–1,000 nodes) performance doesn't separate the options. Ergonomics and fit do. **Hand-rolled SVG** (no dependencies, simple circle+label nodes, works per bar or as one overlay SVG across bars) and **React Flow** (`@xyflow/react`, MIT, ~60 KB gz, built-in drag/connect/pan/zoom, best as a single instance across the progression; several flows each need their own provider; Pro is a paid support/examples subscription, not a feature gate) are the two realistic options. Konva (canvas, DIY links, canvas memory risk on iPad with many stages), JointJS (MPL-2.0 plus a paid JointJS+ tier, ~140 KB), Cytoscape (link drawing needs an edgehandles extension last published in 2021) and others (X6, sigma, vis-network, reagraph) fit less well. Tentative lean: hand-rolled SVG, with React Flow as the fallback if links span bars and the DIY interaction work grows. Final call in ticket 010.

Findings: [research/graph-editing-library-survey.md](../research/graph-editing-library-survey.md)
