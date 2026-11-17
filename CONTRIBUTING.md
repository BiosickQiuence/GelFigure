# Contributing to GelFigure

Use https://github.com/BiosickQiuence/GelFigure for issues and contributions. New UI text must be bilingual; figures and processing records use English. Preserve original bytes, whole-image processing integrity, explicit adoption, undo, and offline single-file operation. No runtime dependencies or automatic model/service switching are introduced.

AI recognition is an explicit user action through an HTTPS OpenAI-compatible Chat Completions vision API. Keys remain separate from serializable application state. Treat model output as untrusted: validate format, coordinate bounds, gel type and catalogue sizes before adoption. Real or unpublished gels must not be committed; tests and documentation images use synthetic data only.

Read `AGENTS.md` for current architecture and release conventions. With Node.js 22+, run `npm ci`, install Playwright's Chromium/Firefox/WebKit, and run `npm test`. Validate the standalone artifact using `node scripts/bundle-onefile.mjs`. Keep current version, package metadata, citation, download URLs, catalogue and changelog synchronized.

Add meaningful regression coverage for changed behavior. Never turn an expected absent/unknown band into an invented known coordinate. Keep manual protections, source/project restoration, fixed AI positions and exported geometry consistent.

Marker catalogue additions require an exact manufacturer model, size list, reference bands and a source in `docs/ladders.md`. Never add an unsourced scientific size list. Contributions use the MIT terms in `LICENSE`.
