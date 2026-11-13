# Graph-editing library survey

Ticket: [issues/009-graph-editing-library-survey.md](../issues/009-graph-editing-library-survey.md) · Researched 2026-11-12

**Question.** What are the realistic ways to render and edit Improwiser's lattice in React (TypeScript, Vite, static site)? The lattice is a set of circles labelled with a note name (`E4`), coloured by role, joined by links the user draws. For each option we look at: dragging nodes, drawing links from node to node, custom node rendering, many small graphs (one per bar) vs one large graph across the progression, performance, licence, bundle size and maintenance.

The scale matters for everything below. A progression has perhaps 4–64 bars, each with perhaps 3–15 notes, so roughly **50–1,000 nodes in total**. At that size performance hardly separates the options. What separates them is ergonomics, bundle size, and how well each fits the "one graph per bar" or "one graph across the progression" model.

## Snapshot (npm registry, GitHub API and bundlephobia, fetched 2026-11-12)

| Option | Version | Licence | Min+gzip (bundlephobia, peers excluded) | Weekly npm downloads | Last activity on repo |
|---|---|---|---|---|---|
| Hand-rolled SVG (+ optional `@use-gesture/react` 10.3.1) | n/a | MIT (use-gesture) | ~9 KB (use-gesture) or 0 | 10.0M (use-gesture) | use-gesture last published 2024-03 |
| `@xyflow/react` (React Flow) | 12.12.1 | MIT | ~60 KB (includes zustand, `@xyflow/system`) | 20.9M | pushed 2026-11-10, 39k stars |
| `konva` + `react-konva` | 10.9.1 / 19.3.2 | MIT | ~57 KB + ~45 KB ≈ 100 KB | 3.7M / 2.7M | pushed 2026-11-10 / 2026-10-15 |
| `@joint/core` (+ `@joint/react`) | 4.3.4 / 4.3.7 | MPL-2.0 (paid JointJS+ tier) | ~139 KB (core), ~148 KB (react, includes core) | 70k / 2.3k | pushed 2026-11-09 |
| `cytoscape` (+ `cytoscape-edgehandles`) | 3.35.0 / 4.0.1 | MIT | ~139 KB | 25.9M | pushed 2026-11-10; edgehandles last published 2021-07 |
| `@antv/x6` | 3.1.8 | MIT | not measurable (bundlephobia returned 449 B, which is wrong) | 87k | pushed 2026-10-23, 156 open issues |
| `sigma` + `@react-sigma/core` | 4.0.6 / 6.0.0 | MIT | ~97 KB (+ graphology) | 726k | pushed 2026-11-10 |
| `vis-network` | 10.1.5 | Apache-2.0 OR MIT | ~118 KB (+ several peers) | 1.1M | active |
| `reagraph` | 4.32.0 | Apache-2.0 | ~385 KB (three.js) | 106k | pushed 2026-06-25 |

Sources: `registry.npmjs.org/<pkg>/latest`, `api.npmjs.org/downloads/point/last-week/<pkg>`, `api.github.com/repos/<repo>`, `bundlephobia.com/api/size?package=<pkg>`. Bundlephobia sizes leave out peer dependencies (React, and Konva for react-konva).

## 1. Hand-rolled SVG

**How it works.** Each bar renders an `<svg>`. Each note is a `<g>` containing a `<circle>` and a `<text>`, and each link is a `<line>` or `<path>`. Pointer Events (`pointerdown` / `pointermove` / `pointerup` with `setPointerCapture`) handle dragging. Drawing a link means dragging out a "rubber-band" line from one circle and hit-testing the circle under the pointer on release (`document.elementFromPoint`, or `data-note-id` attributes on the circles). `@use-gesture/react` is an optional MIT helper (~9 KB) that normalises the drag gestures. Note that it has not been published since 2024-03.

- **Dragging nodes:** you build it yourself, roughly 50–100 lines. Converting screen coordinates to SVG coordinates is easy with `getScreenCTM().inverse()`.
- **Drawing links:** you build it yourself. You get full control over the gesture: drag from the rim of a circle, click one circle and then another, modifier keys, and so on. That fits ticket 008, where the interaction is still undecided.
- **Custom node rendering:** trivial. A circle with a note name and a fill colour is the most basic thing SVG draws. Colour-blind cues (outline, dash, shape) are one attribute each.
- **Many small graphs vs one large graph:** both are natural. Per bar is one `<svg>` per bar inside a CSS grid. Across the progression is one `<svg>` overlaid on the whole bar grid, with links free to cross bar lines. Links between bars inside a CSS-grid layout need a shared coordinate space, so you need either a single overlay SVG or measured bar offsets.
- **Performance:** about 1,000 SVG elements re-rendered by React is fine if node components are memoised and the drag state is kept local. Nothing here gets near SVG limits.
- **Licence / bundle / maintenance:** none, about 0 KB, and you own the code.
- **Costs:** you write selection, delete, undo, keyboard access, zoom/pan (if needed), hit areas for links and touch handling yourself. Keyboard and focus accessibility is easier in SVG, which has real DOM nodes with `tabindex` and ARIA, than in canvas.

## 2. React Flow (`@xyflow/react`)

**How it works.** `<ReactFlow nodes edges onNodesChange onEdgesChange onConnect>`. Nodes are **HTML divs that hold your React component**, and edges are rendered as SVG. It ships with dragging, selection, a pan/zoom viewport, delete-key handling, minimap and controls.

- **Dragging nodes:** built in.
- **Drawing links:** built in, via `<Handle>` components on nodes. By default handles are small connection points with a `type` of source or target. `connectionMode="loose"` lets a handle act as both source and target ([handles docs](https://reactflow.dev/learn/customization/handles)). The free **Easy Connect** example makes the whole node a connection area, with floating edges computed from where the line between centres crosses each border. It notes that you then need a separate drag handle to move nodes ([example](https://reactflow.dev/examples/nodes/easy-connect)). For a small circle that has to be both draggable and linkable, this conflict needs a design answer, for example drag from the centre and connect from the rim.
- **Custom node rendering:** any React component. A coloured circle with a label is easy. Edges default to bezier/step curves, and a straight edge type or a custom floating edge is available.
- **Many small graphs vs one large graph:** several flows on one page are supported, but "you will need to use a separate `<ReactFlowProvider />` for each flow" ([provider docs](https://reactflow.dev/api-reference/react-flow-provider)). Each instance brings its own viewport, store and event handlers, which is heavy for 32 bars of 5 notes. **One flow across the progression fits better**: bars can be background or group nodes (parent/sub-flow nodes are supported) and links can cross bar lines freely. Within-bar constraints, such as keeping notes inside their bar, would need `extent: 'parent'` on child nodes.
- **Performance:** the official guidance is to memoise custom nodes, `useCallback` the handlers, avoid subscribing to the whole `nodes` array, and limit heavy CSS ([performance docs](https://reactflow.dev/learn/advanced-use/performance)). The page gives no node-count threshold. Hundreds of simple nodes is well within typical use.
- **Licence:** MIT. The page says it is "open-source MIT-licensed software, and it will be forever". **React Flow Pro** is an optional subscription (Starter $169/mo, Professional $289/mo, Enterprise custom). It sells Pro examples/templates, prioritised issues and support, not library features ([pro page](https://reactflow.dev/pro)).
- **Bundle:** ~60 KB min+gzip, plus its stylesheet.
- **Maintenance:** very active (xyflow GmbH, 39k stars, weekly releases).
- **Fit concerns:** it is built for flowchart and node-editor UIs. You inherit its opinions (handles, a viewport with pan/zoom, the HTML-node / SVG-edge split) and may spend effort turning things off (`panOnDrag`, `zoomOnScroll`, `nodesConnectable`, and so on).

## 3. Konva + react-konva (canvas)

**How it works.** `<Stage><Layer><Circle draggable/><Text/><Line/></Layer></Stage>`. React components drive a retained-mode canvas scene graph ([react-konva docs](https://konvajs.org/docs/react/index.html)).

- **Dragging nodes:** built in, via the `draggable` prop and `onDragMove` / `onDragEnd`.
- **Drawing links:** no graph concept, so you build it yourself, the same way as with hand-rolled SVG: draw a temporary `Line` while dragging and use Konva's hit detection on release.
- **Custom node rendering:** `Circle` + `Text` shapes, easy. Text and HTML are less flexible than DOM (DOM portals exist).
- **Many small graphs vs one large graph:** one Stage per bar works, but each Layer allocates **two canvases** (scene + hit), about 41 MB per layer on a 1920×1080 retina stage. Konva warns above 5 layers, and Mobile Safari blanks canvases when total canvas memory exceeds about 256–384 MB ([perf tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)). Many small stages are cheaper than one big one, but dozens of stages on an iPad (the "tablet on a music stand" goal) is a real risk to measure. One stage across the progression, with bar lines drawn as shapes, avoids the multiplication.
- **Performance:** excellent for thousands of shapes, far more than we need.
- **Licence / bundle / maintenance:** MIT. About 100 KB gzip for both packages. Very active, with 3 open issues on konva. The react-konva major version must match the React major.
- **Costs:** canvas has no DOM, so keyboard focus, ARIA, text selection and CSS theming all need extra work. Crisp text at different zoom levels needs care (`pixelRatio`).

## 4. JointJS (`@joint/core`, `@joint/react`)

**How it works.** A full diagramming toolkit with an MVC graph model (`dia.Graph`, `dia.Paper`) rendered to SVG. Elements can declare **magnets/ports**: dragging from a magnet creates a link, with `validateConnection` hooks and connection snapping. `@joint/react` (MPL-2.0) adds a `renderElement` function that turns node data into React components ([joint-react README](https://github.com/clientIO/joint/tree/master/packages/joint-react)). From the downloads (2.3k/week) it looks young.

- **Dragging / drawing links / custom rendering:** all built in and mature, which is JointJS's core strength.
- **Many small graphs vs one large graph:** one Paper per bar or one Paper overall are both possible. It is heavier per instance.
- **Licence:** MPL-2.0 core. Changes to MPL files must be shared, but using the library in a closed app is fine. **JointJS+** is a commercial tier: per-developer perpetual licence (listed at $3,468, $1,734 in the Nov-2026 sale) adding 180+ demo apps, 40+ UI components (stencil, inspector, undo/redo command manager and similar) and support ([licence page](https://www.jointjs.com/license)).
- **Bundle:** ~139–148 KB gzip.
- **Maintenance:** active (client IO, commercial backing).
- **Fit:** overkill. Its model is a second source of truth beside our own state.

## 5. Cytoscape.js

**How it works.** A graph theory and visualisation library rendered to canvas. Node style comes from a CSS-like stylesheet mapped to data (`background-color: data(color)`, `label: data(name)`) ([docs](https://js.cytoscape.org/)). Its core gestures cover pan, zoom, select and **drag nodes**.

- **Drawing links:** not in core. It needs the **`cytoscape-edgehandles`** extension (MIT), which was last published 2021-07 (v4.0.1).
- **Custom node rendering:** stylesheet only, with no React components inside nodes. A circle with a label is the default node shape, so this does fit our simple nodes.
- **Many small graphs vs one large graph:** one instance per container. Many instances work but each is a canvas renderer. Its strength is one large graph.
- **React:** `react-cytoscapejs` (MIT) is a thin wrapper. The model is imperative, so React state has to be kept in sync with `cy` yourself.
- **Licence / bundle / maintenance:** MIT, ~139 KB gzip, very active core.
- **Fit:** made for analysing and laying out graphs. It is weak at authoring (drawing links depends on a stale extension).

## 6. Others checked and set aside

- **AntV X6** (`@antv/x6`, MIT): a full diagram editor (ports, link drawing, React node shapes) and an X6 equivalent of JointJS. Its docs and community are mostly Chinese-language, it has 156 open issues, and it brings a large dependency set (lodash-es etc.). Credible, but nothing to recommend it over React Flow here.
- **sigma.js + @react-sigma** (MIT): WebGL renderer for *large* graphs (tens of thousands of nodes). Building interactive edges is DIY. Wrong scale.
- **vis-network** (Apache-2.0/MIT): canvas, with an `addEdgeMode` manipulation mode. It has many peer dependencies, is imperative, and looks dated. It works, but there is no reason to prefer it.
- **reagraph** (Apache-2.0): WebGL/three.js graph *visualisation*, ~385 KB gzip, focused on layout and exploration, not authoring. Ruled out.
- **d3 (`d3-drag`, `d3-selection`)** (ISC): can provide the drag mechanics for the hand-rolled SVG option (~6 KB). It overlaps with React's DOM ownership, so Pointer Events or use-gesture are usually simpler in React.

## Trade-off summary

| | Drag | Draw links | Custom circle+label | Many small graphs | One large graph | Licence | Size (gz) |
|---|---|---|---|---|---|---|---|
| Hand-rolled SVG | DIY (small) | DIY (full control) | trivial | natural | natural (overlay SVG) | none | ~0–9 KB |
| React Flow | built in | built in (handles; whole-node needs the Easy Connect pattern) | any React | works, but one provider + viewport per bar is heavy | **best fit** (sub-flows for bars) | MIT; Pro = paid support/examples only | ~60 KB |
| Konva | built in | DIY | easy (canvas) | canvas memory risk on iPad | good | MIT | ~100 KB |
| JointJS | built in | built in (magnets) | SVG/React | ok | good | MPL-2.0; JointJS+ paid | ~140 KB |
| Cytoscape | built in | extension (stale) | stylesheet | meh | good | MIT | ~139 KB |

## Tentative lean (not a decision; ticket 010 decides)

- If the lattice stays **one small graph per bar** with simple circles: **hand-rolled SVG** looks best. The node visuals are trivial, the per-bar instances are free, there are no extra dependencies, accessibility is straightforward, and the interaction from ticket 008 can be shaped exactly. The cost is a few hundred lines for drag, link drawing, selection and delete.
- If links **cross bar lines** (one graph across the progression), or we want pan/zoom, selection and connection UX out of the box: **React Flow** in a single instance, with bars as background/group nodes, is the strongest library option. It is MIT and well maintained, and its Pro tier is optional. Expect to tune or disable its flowchart defaults and to design the drag-vs-connect gesture on a small circle.
- Hand-rolled SVG also handles one large graph through a single overlay `<svg>`. So SVG is the option that holds up under **both** answers to the bar-line question, and React Flow is the fallback if the DIY interaction work grows too big.
- Konva, JointJS, Cytoscape and the rest are not a good match for this scale or for an authoring-first UI.

## Open points for the rendering decision

- Measure: a throwaway prototype of drag-and-link in hand-rolled SVG versus React Flow (ticket 008/010 territory).
- How React Flow's pan/zoom viewport would coexist with a bar grid laid out by CSS, if the graph spans the progression.
- Touch/tablet: both SVG with Pointer Events and React Flow support touch. Konva's canvas memory limit on Mobile Safari is the specific iPad risk noted above.
