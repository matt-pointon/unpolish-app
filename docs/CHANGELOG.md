# Changelog

## 0.1.6

- `skipFilter.maps` / `skipFilter.images` (`theme` default, or `original`) opt skipped maps and/or images out of the skip/hybrid CSS filter without classifying them. Use `"skipFilter": { "maps": "original" }` on always-live Google Maps so the basemap and status-coloured markers stay unfiltered. `data-unpolish-filter="original"` does the same per element. `mapMarkers` still cannot split GMP markers (no pane); turning map skip filters off is the way.
- Sketch hybrid waits ~1.8s of stillness before busy→still (and pins a region that keeps going busy). The busy grayscale is lifted toward Sketch paper so a remaining swap is not a dark↔light strobe.

## 0.1.5

- `?unpolish=` including `original` forces that theme for the session. Persisted `review.active` / local `active` cannot win on load.
- Live classify never calls `getComputedStyle` on the live page: original reads happen on clones inside an isolated iframe, with parent info taken from those clones. Recurring 150–250ms stalls from trickle tagging should stop; tagged count should not swing by hundreds after it settles.

## 0.1.4

- Classify no longer inserts a probe and calls `getComputedStyle` per element. Cached original reads are reused when the attribute signature is unchanged, including across different nodes that share a class/state signature; `fullPass` keeps the memo and invalidates per element. The first pass of many uncached nodes disables the theme sheet once and time-slices reads. Mutation-path classify never disables the sheet: first-seen signatures batch into an exempt probe (insert all, read all, remove all) so a page pays one style recalc per slice. Classify, read and write time counts against a ~50ms task budget; batch size adapts from the measured per-element cost. On localhost, a batch that overruns logs `console.warn('[unpolish] classify batch took Xms')`.
- `?unpolish=` on the URL wins over a persisted theme, including when config loads asynchronously.
- After `init --upgrade`, the installer tells you to restart Vite with `npm run dev -- --force`.

## 0.1.3

- Maps, images and other heavy widgets are never classified. One CSS `filter` is applied on the skipped container so the content stays visible. Descendants are not restyled. Detected automatically: `img`, `picture`, `video`, `canvas`, `iframe`, `svg` internals, `object`, `embed`; Leaflet, Mapbox, MapLibre, Google Maps, OpenLayers, deck.gl and `[role="application"]`; plus subtrees with a very high absolute-child count or mutation churn.
- Sketch skip regions are hybrid: SVG pencil-line edges while still, cheap CSS grayscale while moving (pointer drag, wheel, touch, Leaflet/Mapbox move, DOM/style/transform mutations, playing video, moving markers). One `data-unpolish-busy` attribute on the skip root; back to edges after ~260ms idle. Video and animated canvas that keep changing stay gray. Leaflet applies that filter on the tile pane only. Moving cars keep the tiles gray — leaving the edge filter on during marker motion is ~5 fps, so it is not the default. Marker icons get one cheap CSS filter on the Leaflet marker pane (`mapMarkers: "pane"`, default; ~0.5 fps vs unfiltered at 500 cars). A stylesheet-per-img variant (`"img"`) is slower (~5 fps). `"original"` or `data-unpolish-ignore` on the pane keeps icons full color. Blueprint stays a cheap ink wash on the tiles and the marker pane.
- Classifier no longer clones ancestor chains into the page to measure. Fresh reads use the live element (strip our tokens, read the batch, write the batch). The 8ms budget wraps those reads, batches are capped, disconnected nodes are dropped, and work is scheduled with `requestIdleCallback` (rAF fallback).
- Resize no longer clears the classify cache: `fullPass` re-decides from stored reads and new boxes.
- Config `include` and `data-unpolish="keep"` opt a skipped region back into classification. `exclude` / `data-unpolish-ignore` still keep the original look with no filter.
- New ~12k-node map fixture asserts Sketch stays at ≥50 fps idle (edge) and while panning (gray), with no long task over 50ms, a filter (not a covering overlay) on map/media, and no reclassify storm on resize.

## 0.1.2

- Class and state mutations no longer force a full-document style recalc. Repeating `class` / `aria-*` / `data-state` signatures replay cached tags; first-seen signatures are read from the ignore probe. Mutation-path classify never disables the theme stylesheet.
- Perf fixture now also toggles 10 card classes every frame; Sketch stays within ~80% of Original fps with no long task over 100ms.
- Package README pin example names the current bundle version.

## 0.1.1

- MutationObserver work is coalesced onto animation frames: added and changed nodes go into a set, ancestors are deduped, disconnected nodes are skipped, and classify runs at most once per frame. Newly inserted nodes are tagged without disabling the theme stylesheet (which would restyle the whole page). If a frame would exceed ~8ms, the rest is time-sliced onto the next frames.
- Attribute-only mutations that are only animation (`transform`, `opacity`, `filter`, …) are ignored, as are writes Unpolish itself made (`data-up`, its own nodes).
- Built-in excludes: `[data-unpolish-ignore]`, Google Maps (`gmp-map`, `gmp-advanced-marker`, `.gm-style`, any `gmp-*` element). Canvas, video and iframe internals are not walked. Project `exclude` selectors still add to that list.
- `npx unpolish init` when that exact version is already pinned reports `unpolish <version> already pinned` and no longer suggests `--upgrade` (this CLI change was merged after 0.1.0 was packed; 0.1.1 is the first tarball that includes it).

## 0.1.0

- First public npm release (`unpolish@0.1.0`).
