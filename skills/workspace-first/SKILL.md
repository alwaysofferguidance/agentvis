---
name: workspace-first
description: Use whenever doing frontend UI work, including designing, building, modifying, reviewing, or debugging pages, components, layouts, styling, and responsive interactions. Relevant even when wasted space has not been reported; keep the user's working space usable without sacrificing readability or essential controls.
---

# Workspace First

Treat the viewport as working space owned by the user's task. Apply this skill throughout frontend UI work: new interfaces, component changes, styling, responsive adaptations, interaction fixes, reviews, and debugging. Do not wait for a complaint about wasted space. Scale the check to the work: a small component edit needs a local space-and-usability check, not an unrelated application-wide redesign. The target is useful simultaneous work area: the content, results, canvas, editor, table, or conversation the user came to use.

## Why this matters

Chrome consumes more than pixels. When it pushes useful content below the fold or narrows it, users see fewer rows, results, messages, or canvas details at once. They scroll, pan, switch views, or reopen context more often; each interruption makes comparisons and multi-step work harder to keep in working memory. The cost grows on laptop screens, split-screen layouts, and short landscape viewports. Evaluate the task the screen must support, not whether the page looks spacious in isolation.

The workspace may be intentionally empty while waiting for user input or incoming activity. That open canvas is useful capacity and can establish calm, focus, or readiness. Do not fill it with cards, metrics, widgets, decorative copy, or speculative controls merely to make the screenshot look occupied. An empty state should tell the user what is happening or the next useful action, in proportion to its importance, while leaving the work surface available.

## Scope and judgment

- In audit or review mode, inspect and report only. Do not modify files.
- In implementation mode, change only the requested app or surface. Do not turn a viewport fix into an unrelated rebuild, redesign, or feature addition.
- Preserve essential navigation, status, actions, readable type, usable hit targets, and the user's established visual identity. Compactness is not an excuse to cram text, shrink controls, hide necessary functions, or make the interface harder to scan.
- Avoid persistent branding billboards and dashboard thickness. Make the product name legible where useful, but do not give it more persistent area than the user's task warrants.
- Optimize for the actual primary task and states. A layout may need different treatment for an editor, table, monitoring canvas, or conversation; do not apply one fixed density or header size to every app.

## Workflow

1. **Name the task and surface.** Identify what users primarily do on this screen, what information or controls must remain visible, and which area is the working surface. If the request is an audit, stay read-only.
2. **Inspect real layouts.** Measure or capture the current state at the available desktop size and at a narrow and/or short viewport relevant to the app. Include representative populated, loading, and empty states as applicable. Record the viewport dimensions and zoom. Prefer the real application or a faithful running build over assumptions from source alone.
3. **Find persistent overhead.** Rank vertical and horizontal space consumed by the app shell, branding, toolbar/header rows, tab bars, nested max-width wrappers, duplicated padding, fixed overlays, and oversized loading or empty-state content. Note which items are persistent, which appear only in certain states, and which obscure or displace work.
4. **Recover space for the work.** Compact, combine, relocate, or remove low-value chrome within scope. Reduce redundant wrapper layers and padding. Keep the primary task visible sooner and expose more useful content at once. For an empty or waiting state, keep any instruction concise and let the empty canvas remain available. Choose changes based on task value and responsive behavior, not a target pixel count.
5. **Verify the core flow.** Compare before and after at the same viewport, zoom, and app state. Check the primary task with real content, loading/empty state if affected, and relevant narrow/short layout. Confirm keyboard navigation and focus, touch interaction where supported, zoom/text scaling, and that essential controls or content are not clipped, occluded, or made hard to reach.
6. **Report measured evidence.** State the problem, task cost, correction, measured benefit, and verification limits concisely. Separate measured facts from visual judgment and inference; never claim a gain that was not observed.

## Measurement notes

Use actual viewport and element measurements, screenshots, or layout inspection when available. Compare the same viewport dimensions, zoom, scroll position, data volume, and state. Distinguish total browser/app viewport from the area available to work. Avoid double-counting overlapping sticky headers, overlays, or nested wrappers. Useful measures include:

- Height and width occupied by persistent chrome, fixed overlays, and the primary work surface.
- The percentage of viewport height occupied by persistent chrome, with transient loading/empty content reported separately.
- Useful simultaneous content: for example, visible table rows, results, messages, editor lines, or unobstructed canvas dimensions at the same state and zoom.
- Required scroll or pan to reach the first meaningful content or complete the core task.

A 36–48 px toolbar is a starting point to investigate, not a universal rule. Persistent chrome above roughly 10% of viewport height is a prompt to inspect its value, not an automatic failure threshold. Dense professional tools may need more controls; a single-purpose canvas may need far fewer. Use screenshots or approximate visual estimates only when exact measurement is unavailable, and label them accordingly.

## Output

Keep findings actionable and short. Use this order: **problem → task cost → correction → measured benefit → verification and limitations**. Include the compared viewport/state and concrete measures when available. If code or a running app was not available, state that the assessment is visual or source-based and do not imply live-flow verification.

For visual examples, see [references/layout-examples.md](references/layout-examples.md) only when an example helps clarify the intended tradeoff. These examples guide judgment; they are not templates or proof of a universal layout rule.
