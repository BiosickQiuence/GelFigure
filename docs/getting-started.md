# Getting started with GelFigure v1.1.0

Open https://biosickqiuence.github.io/GelFigure/ or download `GelFigure-v1.1.0.html` from https://github.com/BiosickQiuence/GelFigure/releases/tag/v1.1.0 and double-click it. Local editing needs no API account or developer tools.

Import → check type/orientation → correct crop/lanes → confirm Marker and per-band pairing → edit labels → save `.gelfig` and export.

For optional AI, follow the [complete README API setup guide](../README.md#api-setup): obtain an HTTPS compatible base, a vision model ID and key from one provider, enter them in top-right Settings, test with an image you are allowed to upload, review the result and explicitly apply it.

To use **AI automatic processing**, save your API settings, open the automatic page, drop one gel and choose its marker model. The app sends the input analysis image for lane correction and then the corrected image for marker labelling. The result opens in the editor.
