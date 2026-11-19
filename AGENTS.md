# GelFigure v1.0.0 — developer handover

## Repository and release scope

- Current repository: `https://github.com/BiosickQiuence/GelFigure`; Pages: `https://biosickqiuence.github.io/GelFigure/`. Never push changes to the original project's repository as part of this fork's work.
- Current version/build is `1.0.0` / `v1.0.0`. New commits and annotated tags use `BiosickQiuence <114460892+BiosickQiuence@users.noreply.github.com>`. Preserve inherited history and MIT copyright notices.
- The user has explicitly authorized publishing this v1.0 release and website on 2026-11-17. Future releases still require an actual user release request. Prepare/test/review before pushing. Do not overwrite existing tags or force-push branches. Preserve the old main tip under a release backup branch first.
- README.md and README.zh-CN.md are complete parallel English/Chinese guides. Provider model IDs and API instructions require current official sources. README attribution to the original project appears only in the final acknowledgements; LICENSE retains mandatory notices.

## File and data safety

Follow the parent/user AGENTS rules: never delete files, keep unique verified pre-edit backups, preserve source inputs and prior deliverables, and do not publish private images, credentials, machine-local receipts or generated test data. Backups and evidence stay outside the source checkout; test writers preload `tests/backup-outputs.cjs`.

## Runtime

The app is dependency-free `index.html`, CSS and ordered plain scripts. It runs from file:// and a bundled HTML. `scripts/bundle-onefile.mjs` must match HTML script order. No automatic external requests occur. Only explicit AI recognition uploads an analysis PNG to the configured HTTPS endpoint; feedback and Star are explicit links to this repository. There are no donation/forwarded-feedback destinations or release-history UI. `js/releases.js` remains build-time metadata and is not loaded in the app; `js/updates.js` is a retained legacy source, not a runtime script.

- `app.js`: serializable `App.S`, processing, history, source bytes/pixels, templates and project persistence. Pixel buffers and API configuration never enter state snapshots.
- `tiff.js`, `engine.js`, `colour.js`: decoding, grayscale analysis, geometry/peaks and genuine RGB display. Colour evidence is decisive: sampled blue ≥0.5% selects protein; monochrome selects DNA. Other colour cases retain geometry rules; users can override manually.
- `App.isOriginal()` chooses identity display levels for new originals, including monochrome; `App.isColour()` means actual RGB. Saved explicit modes and legacy project meaning are preserved. Default appearance presets do not force new imports into adjusted grayscale.
- Source changes install bytes and decoded pixels together. Visited sources remain in page memory for synchronous undo; serialized projects contain the current source. `resetBaseline` is explicit adopted state. Preserve asynchronous source-generation guards.
- `Perspective.apply` builds a candidate and rolls back all state/caches on failure. Original bytes remain intact. The selected raw-source quadrilateral and interpolation are disclosed.
- `marker-ai.js`: credential ownership, request validation, session-only local/AI drafts, chosen model and adoption. Top `session.ladderId` constrains `App.autoMarkers(ladderId)` and the AI catalogue. Changes cancel stale requests and never send implicitly.
- AI positions are fixed: no local peak repair or silent coordinate refinement. Selected sizes pair descending with ascending positions, missing positions remain null, surplus positions remain unassigned/hidden, and count mismatch stays visible. Opening adopted/manual pairing preserves it until a deliberate selection change or re-pair.
- `auto-flow.js`: the configured automatic page starts when both a file and an explicit ladder are supplied. The layout and marker calls use separate input/rectified PNGs. Only the fully validated pair is installed as a new project, using the selected ladder type. The source and raw-image undo snapshot are retained.
- `ai-workspace.js`: shared inline Marker/layout host. Commits while `#stage` is hidden see zero bounds; close must reveal it, resize the raw canvas and call `UI.updatePreview()` before returning focus. Preserve DPI and `figZoom`; do not simulate a DPI change.
- `gel-ai-beta.js`: explicit AI geometry proposals, conservative uncertain lanes, review/draft edits, source-plane corners, ROI tightening and one-step adoption. Layout application records provenance and uses validated AI centres without local rediscovery. Public feature names need not expose the internal Beta global/file name.
- `render.js` and `pptx.js`: pt-based figure geometry and editable DrawingML. Keep export bounds, labels, crop/splices, colour and per-item formatting consistent. Never export editor overlays or preview placeholders.
- `export.js`: figures, original bytes, project/review ZIPs and processing records. Review ZIP guards against async project changes and excludes API configuration/raw responses.
- `library.js`, `ladder-cache.js`: browser persistence with queued writes; custom models, originals and history must retain identity and survive storage failures without losing edits.
- `ui.js`, `editor.js`, `figedit.js`, `mobile.js`: shared desktop/mobile state. Phone query in CSS and JS must match. Hidden views and inline tasks must preserve controls and restore preview fit. Text/shape edits must not mutate source pixels.

## Validation and release

Use Node.js 22+ and Playwright. `npm test` is the full three-engine suite; `--browser=chromium,firefox,webkit` selects engines. `test/test.html` and `js/uitest.js` cover engine/base interactions; focused suites cover AI, workspace, colour, history, templates, type/model selection, exports, source races and preview fit. Update tests when explicitly retired UI behavior changes; test the replacement routing and privacy rather than preserving removed payments or popups.

Keep `App.VERSION`, package/lock versions, CITATION, index/help/download links, `js/releases.js` first entry and CHANGELOG release section aligned. `scripts/check-updates.mjs` validates release metadata; it no longer implies a visible release-history feature. Build and inspect the actual offline artifact, review for correctness/simplicity/security/performance, and ensure no secrets or private data are staged.

Publish to the user's `dev`/`main` with a fast-forward, wait for CI and Pages on the actual new commit, then create an immutable annotated `v1.0.0` tag and verify the release workflow/assets. The existing generic workflows build CI, Pages and release downloads. Never claim a stale or still-running workflow passed. Verify live VERSION, language/help, removed history/payment UI, current download links and source-matched release HTML after publication.
