# FinanceFlow motion

This presentation-only layer uses CSS and vanilla JavaScript without dependencies. The dark theme, data models, calculations, auth and import/export paths are unchanged.

## System

Shared CSS tokens define 120ms interaction, 220ms navigation and 280ms summary durations, the same ease-out curve, and an 8px navigation distance. JavaScript reads the duration/easing tokens. Navigation switches the existing views immediately; only the visible view fades subtly from 88% opacity and moves 8px. Scroll positions are remembered per section and existing heading focus remains intact. No outgoing view is held open or cross-faded over the new content.

At most eight cards enter on a section's first visit, with 4px movement, near-full opacity and a capped 110ms stagger. Normal data refreshes do not invoke section entrances. Charts fade subtly on navigation; they do not replay on every filter change. Progress bars interpolate using transform scale rather than width transitions. Button press, hover, tab/filter selection, form-border and card-border feedback share the tokens. Focus outlines remain immediate.

Native dialogs use CSS opening/closing transitions with `@starting-style` and discrete display/overlay support. Unsupported browsers close immediately. There is no timeout delaying close(), Escape or focus restoration; a closed dialog cannot intercept pointer events. Toasts receive the same restrained entrance/exit treatment, and a repeated toast cancels its previous hide timer. Errors appear immediately with only a brief opacity refinement, not shaking or delayed display.

## Trustworthy summaries

Only selected existing finance/Work summary nodes interpolate between previously known nonzero values on the same node. There is no initial count from zero, no animation of weight/nutrition records, and no repeated balance reveal when entering a section. EUR remains en-IE formatted; hours remain HH:MM. The exact canonical text is always in the DOM, available for copying/accessibility; only a CSS visual overlay interpolates. Its generated content has an empty accessibility alternative. Browsers lacking that CSS feature skip interpolation entirely. The overlay disappears at the end, on navigation, account-state reset, or reduced-motion changes. Cached formatting and requestAnimationFrame keep per-frame work small.

## Accessibility and tradeoffs

`prefers-reduced-motion: reduce` removes CSS transitions and skips/cancels Web Animations and number overlays, while preserving focus and semantic state feedback. No layout animations, continuous spinners, bounces, balance-from-zero effects, or forced update reloads were added. A sliding navigation pill was skipped because mobile/desktop layouts and wrapping labels make a persistent moving overlay less robust than the selected-background transition. Chart path drawing and animated filter rebuilds were skipped to preserve immediate readability and avoid repeated data-motion. Dialog exit animation is progressive enhancement, never a prerequisite for closing.

## Verification

Run `npm run build:shell`, `npm test`, `npm run test:browser`, `npm run test:pwa`, and `npm run check:shell`. The existing visual suite also checks all 42 section/viewport combinations and reduced-motion keyboard behavior. Added browser assertions check exact summary text after animation, reduced-motion cancellation/HH:MM values and immediate native Escape close. Existing finance, nutrition, shifts, auth, imports/exports and offline/upgrade workflows remain enabled. CSP and the locally pinned Supabase dependency retain their existing policy/integrity boundaries; new/changed local assets receive generated SRI and immutable filenames.

Physical-device frame-rate profiling and assistive-technology inspection remain useful release checks. No merge, deployment or production-data operation is performed.

During development a mobile-dialog test initially targeted the hidden desktop More button; its viewport setup was corrected. The PWA suite's offline `DOMContentLoaded` wait timed out in two combined runs, including one on a stable shell. Standalone and other combined PWA runs passed. Additional diagnostics remain in the test; this intermittent harness/navigation failure is not claimed resolved and should be monitored in CI. No worker/cache behavior was weakened or replaced to bypass it.
