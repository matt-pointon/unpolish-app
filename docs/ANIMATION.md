# Motion notes

Motion was planned with Emil Kowalski's skills, in order: `find-animation-opportunities` → `animate` → `review-animations`. Curves come from the shared vocabulary: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.

## 1. Opportunities kept

| # | Location | Purpose | Frequency | Motion |
| --- | --- | --- | --- | --- |
| 1 | Panel opened from the launcher (`unpolish.js`, `.panel.anim`) | Spatial consistency | Occasional | `scale(0.96)` + `opacity: 0` → settled, 180ms `--ease-out`, `transform-origin` at the launcher corner. Close: 130ms to `scale(0.98)` |
| 2 | *Edit theme* and *Review link* views (`reveal()`); editor group and website disclosure chevrons rotate 200ms | Preventing a jarring change | Occasional | height + opacity, 200ms `--ease-out` (accordion exception); chevron rotates 200ms |
| 3 | Buttons, theme tiles, launcher (`:active`) | Feedback | Tens/day | `scale(0.95–0.97)`, 160ms `--ease-out` |
| 4 | Copy feedback (panel toast, site toast, button label) | State indication | Occasional | toast: opacity + `translateY(4px)` (panel) / `16px` (site), 180–200ms transition, leaves the way it came; label swaps instantly |
| 5 | Website hero | Delight (first view, marketing) | Rare | 520ms rise, 50ms stagger, `--ease-out`; never blocks interaction |

## 2. Rejected

- **Panel open/close via `\` and Esc** — keyboard-initiated, used constantly while presenting. Instant, no animation.
- **Theme switches on the prototype** — keyboard-driven and would move the very thing being reviewed. Switches are instant, and Unpolish pauses the host's own transitions for two frames so nothing crossfades.
- **Panel edit controls** (sliders, swatches, segmented options) — direct manipulation; the prototype follows with no easing.
- **Direct-shortcut HUD** — appears instantly (keyboard-triggered); only a 150ms fade on the way out.
- **Theme tile selection** — tens per session; colour/ring change only (150ms `ease`), no movement.

## 3. Review verdict

Checked against the ten standards: no `transition: all`, no `scale(0)`, no `ease-in`, every UI duration ≤ 200ms, hover effects gated behind `(hover: hover) and (pointer: fine)`, transitions (not keyframes) for anything re-triggerable, only `transform`/`opacity` animated apart from the accordion height. Fixes applied during review: press scales raised from 0.94 to 0.95; removed an unused animation rule.

`prefers-reduced-motion: reduce` keeps opacity and colour changes, drops scale/translate (panel, toast, presses), skips the accordion height animation and smooth scrolling, and turns the hero rise into a fade. **Approve.** Feel-check left for a human: the panel entry at 2–5× speed, and the copy toast on a real phone.
