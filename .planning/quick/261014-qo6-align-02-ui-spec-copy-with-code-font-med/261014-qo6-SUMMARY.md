---
quick_id: 261014-qo6
status: complete
commits: [1de6396, 908a5b3, 4892dd6]
---

# Quick 261014-qo6 Summary

- **IN-10 (1de6396):** `formatSignedPoints` renamed `formatSignedInt` (goal +/- in unit tables); both it and `formatPointsDelta` call a private `signed(value, zero)`, so the Δ formatter no longer string-compares the base helper's zero. The panel header-stat test now asserts with `formatPointsDelta`, the formatter the panel uses.
- **Chrome (908a5b3):** `/research` h1 and active team/window links `font-semibold` -> `font-medium` (user decision over recording an exception).
- **Spec (4892dd6):** 02-UI-SPEC records the shipped show-all wording (D-28), close `aria-label` `Close player detail: {name}`, `formatPointsDelta` for the header PP Δ, and the chrome change; the 24px h1 is noted as inherited page chrome.
- 02-REVIEW-DISPOSITION: IN-10 fixed; IN-11 remains open.
- `npm test` 555/555, `tsc --noEmit` and eslint clean. Not checked in a browser.
