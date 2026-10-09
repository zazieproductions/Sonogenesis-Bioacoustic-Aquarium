# Accessibility

[← Back to the README](../README.md) · [User guide](USER_GUIDE.md) · [Roadmap](ROADMAP.md)

Accessibility is an active engineering concern, but the current interface has not been audited against WCAG and no conformance claim is made. The experience is a canvas-first instrument, and the gaps below are real limitations—not a substitute for a user test.

## What is available now

- A silent-observation path avoids requiring audio to explore the application.
- Audio has visible enable, mute, and master-volume controls.
- Several actions have keyboard shortcuts; `Space` pauses, `1`–`6` change speed, and `Escape` clears selection/tracking.
- Most panels use native buttons, inputs, selects, or range controls; the shared slider primitive pairs a visible label with its input.
- The document declares `lang="en"`, and panel content is text/DOM even though the world itself is drawn to canvases.

These features are useful, but do not make every workflow keyboard- or screen-reader-complete.

## Known gaps

| Area | Current limitation |
| --- | --- |
| Canvas alternatives | The world map, organisms, signals, trails, and several charts are painted to Canvas/WebGL without an equivalent structured description of spatial entities. |
| Keyboard interaction | Pan, organism selection/drag, spawn/feed/cull placement, lane-curve editing, and some genome editing rely on pointer gestures. Global shortcuts are not a complete keyboard alternative. |
| Accessible names/state | Some compact tool-rail controls rely on glyphs and `title` tooltips. Toggle states and panel relationships are not consistently exposed with ARIA state/structure. |
| Focus management | There is no dedicated focus order/management system for opening panels, moving focus into them, closing them, or restoring focus to the invoking control. Explicit `:focus-visible` treatment is not implemented consistently. |
| Motion | The title and recording indicator animate; there is no `prefers-reduced-motion` handling. |
| Contrast and color | The interface is dark and visually dense. Status, species, and call categories often use hue alongside labels, but contrast has not been measured against WCAG thresholds. |
| Responsive use | Several controls and panels are designed for a large viewport. Small screens, zoomed text, and touch-only use have not been formally tested. |
| Screen-reader testing | No screen-reader/browser test matrix or automated accessibility scan is configured. |

## Practical use

- Use **Silent observation** or mute audio when sound is distracting or unavailable.
- Use the HUD and Observatory's DOM text summaries to read population-level values, while noting that the rendered ecosystem itself is not currently narrated or exposed as a semantic data table.
- Browser zoom may help with text, but the fixed canvas experience is not guaranteed to reflow cleanly at high zoom.

If an accessibility barrier prevents you from completing a workflow, file an issue with the browser, assistive technology, input method, viewport, and the exact action that is blocked. See [Contributing](../CONTRIBUTING.md).

## Engineering priorities

The highest-value fixes are to provide named and stateful controls, visible keyboard focus, keyboard equivalents for canvas tools, a reduced-motion mode, and a text/semantic alternative for selected-organism and population data. Then test with keyboard-only interaction and representative screen readers, measure contrast, and record results before making any conformance claim. These are proposed roadmap items, not current features.
