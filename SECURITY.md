# Security and privacy

GelFigure v2.0.1 processes local images and exports in the browser. In the AI review workspace, clicking Send uploads the analysis image for the selected task to the configured HTTPS endpoint. In AI automatic processing, choosing both an image and a marker starts two requests to that endpoint. The first sends the input analysis PNG for lane geometry. The second sends the rectified PNG and the selected marker model for band labelling. Expanding the correction area runs in the browser. The analysis image is not limited to the red figure crop. API requests omit cookies, reject redirects, and include only the protocol payload; API keys are sent only as authorization to that endpoint.

Keys stay in page memory by default. Optional browser persistence is plaintext local storage on that computer/origin; never use it on a shared machine. Keys, endpoints and raw AI responses are not placed in projects, processing records or image exports. The service provider controls retention of images uploaded to it.

There is no third-party feedback forwarding, payment destination or sponsorship QR code in the active application. Explicit feedback/Star links open https://github.com/BiosickQiuence/GelFigure. Posting an issue is the user's own GitHub action, not an automatic app submission. Do not post keys, private gel images or unpublished data publicly.

Browser-local data can include preferences, custom marker models and autosaved projects with originals/annotations/exposures. Local caches are not permanent backups and are not embedded in downloaded HTML. Save `.gelfig` and marker-library backups separately before clearing site data or changing browsers.

## Reporting security concerns

Use this repository's [Security tab](https://github.com/BiosickQiuence/GelFigure/security). If private vulnerability reporting is available, use it for sensitive reports. If it is not available, do not post credentials, confidential data or a sensitive exploit publicly; contact the maintainer through GitHub first.
