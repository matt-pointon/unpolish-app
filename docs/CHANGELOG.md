# Changelog

## 0.1.3

- Maps, images and other heavy widgets are never classified. Sketch paints one hatched placeholder on the container (`Map` / `Image` / `Canvas` / `Media`) and does not restyle descendants. Detected automatically: `img`, `picture`, `video`, `canvas`, `iframe`, `svg` internals, `object`, `embed`; Leaflet, Mapbox, MapLibre, Google Maps, OpenLayers, deck.gl and `[role="application"]`; plus subtrees with a very high absolute-child count or mutation churn.
- Classifier no longer clones ancestor chains into the page to measure. Fresh reads use the live element (strip our tokens, read the batch, write the batch). The 8ms budget wraps those reads, batches are capped, disconnected nodes are dropped, and work is scheduled with `requestIdleCallback` (rAF fallback).
- Resize no longer clears the classify cache: `fullPass` re-decides from stored reads and new boxes.
- Config `include` and `data-unpolish="keep"` opt a skipped region back into classification. `exclude` / `data-unpolish-ignore` still keep the original look with no placeholder.
- New ~12k-node map fixture asserts Sketch stays at ≥50 fps with no long task over 50ms after the first second, placeholders on map/media, and no reclassify storm on resize.

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
