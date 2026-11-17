# GelFigure v1.0.0

**Prepare editable DNA/protein gel figures in your browser, with local processing and optional AI lane/Marker review.**

[简体中文完整教程](README.zh-CN.md) · [Open the web app](https://biosickqiuence.github.io/GelFigure/) · [Download the complete offline HTML](https://github.com/BiosickQiuence/GelFigure/releases/download/v1.0.0/GelFigure-v1.0.0.html) · [Release downloads](https://github.com/BiosickQiuence/GelFigure/releases/tag/v1.0.0)

> No programming is required. Local editing, manual correction and exports need no API account, Python or Node.js. A vision API is needed only if you choose AI recognition.

## Open a gel and prepare a figure

1. Open the web app, or download **GelFigure-v1.0.0.html** from Releases and double-click it in Chrome, Edge, Firefox or Safari. Do not download only the repository’s `index.html`: that file depends on neighbouring folders.
2. Drop a gel image into the window or select Open image. Common images and TIFF are supported; multiple exposures can be imported together.
3. Check Gel type. This release follows a colour rule: sufficient blue selects protein; monochrome selects DNA. Manual selection remains available, so choose protein yourself for a monochrome protein gel.
4. New imports retain original colours and tones. Select Grayscale explicitly if adjustments are needed; saved projects retain their saved appearance.
5. Check the crop, lanes and Marker, then edit names, groups and annotations and export.
6. Save a `.gelfig` project to continue later. A PNG is not an editable project; browser caches are not permanent backups.

## Features

- Manual four-corner perspective correction, orientation, rotation, crop and lane/annotation editing.
- Optional AI lane correction with editable positions, blank/uncertain proposals and explicit adoption.
- One top-of-workspace Marker model choice shared by local and AI recognition; selected sizes, exact positions and label visibility remain editable.
- Sequential top-to-bottom / largest-to-smallest size pairing. Missing positions stay empty; surplus positions remain stored but hidden. Counts are disclosed; bands are not invented.
- Correctly fitted figure preview on return from review, preserving DPI and preview zoom.
- Undo, recent projects, appearance-only templates, PNG/TIFF/SVG/editable PPTX and review ZIP packages with originals, projects, processing records and hashes.

Review weak bands, empty lanes, model choices and mismatches yourself. This is not a band-repair, background-subtraction or quantitative-analysis tool.

<a id="api-setup"></a>
## First-time AI setup: three fields, no code

An API lets GelFigure ask your chosen service to inspect an image. Choose **one provider**, then obtain all three fields from that same provider. Access to a chat website or a chat subscription is not an API key or proof of API quota; check the provider’s API console.

| GelFigure setting | What to enter | Common mistake |
|---|---|---|
| API address | An HTTPS **OpenAI-compatible Chat Completions** base URL from the table below | A chat website, account dashboard, `/responses` or native `/messages` endpoint |
| Vision model name | The exact API ID, for example `qwen3-vl-plus` | A marketing label, translated display name or text-only model |
| API key | The complete key created in that provider’s API console | A login password, verification code, project ID or another provider’s key |

![English API settings example: the three fields](docs/api-settings-en.png)

### Step 1: obtain a provider key

**Option A — Alibaba Cloud Model Studio.** Sign in to the [console](https://bailian.console.aliyun.com/), enable the model service and select a region. The simple example below uses **China North 2 (Beijing)**. Create a key with access to the chosen model/workspace using the [official key guide](https://help.aliyun.com/zh/model-studio/get-api-key). A new key may be fully visible only once, so save it securely yourself. Check quota/billing and that `qwen3-vl-plus` is available to your account. Keys, models and endpoints must belong to the same region. If your console supplies a workspace-specific base URL, use that complete value; do not paste a literal `{WorkspaceId}` placeholder. The official compatibility guide states that the existing DashScope host remains usable.

**Option B — OpenAI API.** Sign in to [API Platform](https://platform.openai.com/), choose/create an API project, create a project key under API Keys and check the API quota/billing page. Use `https://api.openai.com/v1` with `gpt-5.4-mini`, or another model from the table if your account has access. The [official quickstart](https://developers.openai.com/api/docs/quickstart) explains key creation; GelFigure already contains the calling code, so you do **not** need to run its programming commands.

**Option C — Google Gemini API.** Open [Google AI Studio API Keys](https://aistudio.google.com/apikey), choose/create a project and follow the [official key guide](https://aistudio.google.com/docs/api-key). Confirm model access and quota/billing. School/organization accounts may require project administrator permissions. Use the **OpenAI-compatible base** below, not the Gemini chat site or a native `:generateContent` URL. `gemini-4-hydrogen` is one explicit model choice.

### Step 2: enter the settings in GelFigure

1. Click **Settings** in the top-right corner. No image is required yet.
2. Paste the provider’s API address, exact model ID and key into the three fields. Enter the key itself, without `Bearer `, quotation marks or whitespace.
3. Click **Save API settings**. Lane correction and Marker review share this configuration.
4. Leave Remember key unchecked initially. The key then stays in page memory and must be re-entered after closing the page; address/model settings can be saved.
5. Remember key is optional **local plaintext browser storage**. Use it only on a private computer, not shared lab machines. Clear key removes the stored key. Keys are not included in projects or figures.

### Step 3: try one non-confidential gel

1. Import a gel you are allowed to upload and check type/orientation.
2. Open AI Marker, select the Marker model **at the top**, then click **Send image and recognize**. Opening settings, selecting a model and generating a local comparison do not upload an image.
3. Check the returned lane mapping, sizes and exact positions. Adjust selections/coordinates and choose Apply this result. Recognition does not automatically adopt the result.
4. AI lane correction uses the same settings: inspect corners, lanes, blank/uncertain proposals and the adoption summary first.
5. On return, the main figure is fitted immediately. Save your project and export the chosen format.

## Explicit vision-model IDs

Choose an image-understanding model that returns text/JSON, **not an image-generation model**. The following exact IDs have official documentation for image input and the interface form needed here, checked on **2026-11-17**. You only need one row/provider.

| Provider | API address example | Exact model ID | Official evidence / note |
|---|---|---|---|
| Alibaba Model Studio, Beijing | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3-vl-plus` | Used in the [official OpenAI Vision compatibility example](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai). Match the key’s region. |
| Alibaba Model Studio, Beijing | Same, or the console’s same-region workspace base | `qwen4-max` | Used by the [official vision-understanding example](https://help.aliyun.com/zh/model-studio/vision). Check account access. |
| OpenAI | `https://api.openai.com/v1` | `gpt-5.4-mini` | [Model card](https://developers.openai.com/api/docs/models/gpt-5.4-mini): image input and Chat Completions. |
| OpenAI | `https://api.openai.com/v1` | `gpt-5.4` | [Model card](https://developers.openai.com/api/docs/models/gpt-5.4): the required input/interface capabilities. |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen` | Used by the [official compatible image-understanding example](https://aistudio.google.com/docs/openai#image-understanding). |
| Google Gemini | Same | `gemini-3.5-flash-lite` | [Model card](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite): image input, text output; use the compatible endpoint above. |

A trailing `/` is optional. GelFigure adds `/chat/completions`; you may also enter the complete URL already ending in that path. Deprecated legacy IDs are not presented as defaults for new users.

**What compatibility verification means:** official model/interface capabilities were checked, and unauthenticated, image-free browser CORS preflights to the three example endpoints allowed this web app’s origin. This is not a paid-key, model-by-model gel-accuracy benchmark. Actual calls still require account access, quota, supported region, provider policy and valid JSON output. Compatibility does not establish scientific correctness.

For a lab gateway or third-party service, ask its administrator for the complete HTTPS base, an image-capable model ID, a key and browser-origin support. “OpenAI compatible” alone is insufficient: it must accept Base64 `image_url`, non-streaming Chat Completions and standard `choices[].message.content` text/JSON responses. Native Claude `/messages`, native DashScope/Gemini and image-generation endpoints cannot be pasted directly into this app.

## Troubleshooting

| Error / symptom | Check first |
|---|---|
| 401 / invalid key | Complete key, no whitespace/quotes, correct provider, not expired. |
| 403 / permission | Account region, project/model access and key/endpoint region. |
| 404 / model not found | Missing `/v1` or Gemini `/openai`, misspelled ID, or inaccessible model. |
| 429 / quota | Provider quota, billing and rate limits; do not repeatedly click Send. |
| Network / CORS / certificate / redirect | Try the official base and the web app. Ask gateway administrators to allow the web origin and `Origin: null` for local HTML. Do not disable browser security. |
| Unsupported image / invalid parameter | A text-only, audio or image-generation model, or the wrong native protocol; match one table row’s provider, ID and key. |
| 90-second timeout | The app cancelled without automatic retry. Try a smaller separately saved input, check service load/network and retry explicitly; preserve the experimental original. |
| Invalid JSON, truncation, coordinates or model | Nothing was adopted. Use a vision model with reliable instruction/text-structure support or contact the provider. |
| Stale draft / project changed | A source/project/orientation/model change invalidated the old result. Run recognition again. |
| Wrong lanes, bands or model | Check type, orientation, selected sizes and coordinates manually. A successful connection does not mean a correct interpretation. |

Use the app’s GitHub feedback entry or [this repository’s Issues](https://github.com/BiosickQiuence/GelFigure/issues/new/choose), which requires a GitHub account. Include browser/error/reproduction details with sensitive data removed. Never post API keys, confidential gels or unpublished data publicly.

## Images, privacy and exports

- Editing, traditional local detection, project restoration and exports run in the browser. An explicit AI request sends the complete analysis PNG and the selected model entry, or the current gel-type catalogue if unspecified, to the endpoint you entered.
- The analysis image follows perspective/orientation/rotation, but **is not limited to the red figure crop**. It excludes UI, lane names, text annotations and project files. Check the entire input before uploading.
- Keys never enter projects, processing records or image exports. Provider retention policies govern uploaded images.
- Original file bytes are retained. Geometry and lane removals are disclosed in processing records. Export-file DPI and the gel’s effective DPI are different: check effective DPI when assessing source resolution.
- There are no payment links, sponsorship QR codes, third-party feedback forwarding or in-app release-history popups. Feedback and Star open this repository on GitHub only after an explicit click.

## Development and validation

The app has no runtime dependencies. Development tests use Node.js 22+ and Playwright:

```text
npm ci
npx playwright install chromium firefox webkit
npm test
node scripts/bundle-onefile.mjs
```

The standalone build is `dist/GelFigure.html`. Regression coverage includes colour/type rules, AI protocol, manual protections, undo/projects, preview fit, exports and simulated phones. Tests use synthetic gels and intercepted responses; they do not claim measured accuracy on real gels or every provider. See [CHANGELOG](CHANGELOG.md) and [SECURITY](SECURITY.md).

## Acknowledgements

This project builds on [poplarity/GelFigure](https://github.com/poplarity/GelFigure). Thank you for its gel-processing, annotation and export foundation. BiosickQiuence maintains the v1.0.0 adaptations and release in this repository; original copyright notices and the MIT terms are retained in [LICENSE](LICENSE).
