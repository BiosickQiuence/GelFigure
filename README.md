# GelFigure v1.1.0

**Prepare editable DNA/protein gel figures in your browser, with local editing, AI-assisted review and automatic lane correction and marker labelling.**

[简体中文完整教程](README.zh-CN.md) · [Open the web app](https://biosickqiuence.github.io/GelFigure/) · [Download the complete offline HTML](https://github.com/BiosickQiuence/GelFigure/releases/download/v1.1.0/GelFigure-v1.1.0.html) · [Release downloads](https://github.com/BiosickQiuence/GelFigure/releases/tag/v1.1.0)

> No programming is required. Local editing, manual correction and exports need no API account, Python or Node.js. A vision API is needed only if you choose AI recognition.

## Open a gel and prepare a figure

1. Open the web app, or download **GelFigure-v1.1.0.html** from Releases and double-click it in Chrome, Edge, Firefox or Safari. Do not download only the repository’s `index.html`: that file depends on neighbouring folders.
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

![English API settings example using gpt-6.2-astra: the three fields](docs/api-settings-en.png)

### Step 1: obtain a provider key

**Option A — Alibaba Cloud Model Studio.** Sign in to the [console](https://bailian.console.aliyun.com/), enable the model service and select a region. The simple example below uses **China North 2 (Beijing)**. Create a key with access to the chosen model/workspace using the [official key guide](https://help.aliyun.com/zh/model-studio/get-api-key). A new key may be fully visible only once, so save it securely yourself. Check quota/billing and that `qwen3-vl-plus` is available to your account. Keys, models and endpoints must belong to the same region. If your console supplies a workspace-specific base URL, use that complete value; do not paste a literal `{WorkspaceId}` placeholder. The official compatibility guide states that the existing DashScope host remains usable.

**Option B — OpenAI API.** Sign in to [API Platform](https://platform.openai.com/), choose/create an API project, create a project key under API Keys and check the API quota/billing page. Use `https://api.openai.com/v1` with `gpt-6.2-astra` for quality first, or `gpt-6.2-sol` for everyday balance. The [OpenAI selection guide below](#openai-models) lists every current compatible general vision model through GPT-6.2, older options and interface restrictions. The [official quickstart](https://developers.openai.com/api/docs/quickstart) explains key creation; GelFigure already contains the calling code, so you do **not** need to run its programming commands.

**Option C — Google Gemini API.** Open [Google AI Studio API Keys](https://aistudio.google.com/apikey), choose/create a project and follow the [official key guide](https://aistudio.google.com/docs/api-key). Confirm model access and quota/billing. School/organization accounts may require project administrator permissions. Use the **OpenAI-compatible base** below, not the Gemini chat site or a native `:generateContent` URL. `gemini-4-hydrogen` is one explicit model choice.

### Step 2: enter the settings in GelFigure

1. Click **Settings** in the top-right corner. No image is required yet.
2. Paste the provider’s API address, exact model ID and key into the three fields. Enter the key itself, without `Bearer `, quotation marks or whitespace.
3. Click **Save API settings**. Lane correction and Marker review share this configuration.
4. Leave Remember key unchecked initially. The key then stays in page memory and must be re-entered after closing the page; address/model settings can be saved.
5. Remember key is optional **local plaintext browser storage**. Use it only on a private computer, not shared lab machines. Clear key removes the stored key. Keys are not included in projects or figures.

### AI automatic processing

After saving a valid HTTPS address, vision model and key, open **AI automatic processing** in Settings or the main sidebar. Drop one gel image (or use the file picker) and select the DNA or protein marker used. Either input can come first. Once both are present, the app sends the input analysis PNG for lane geometry and then the rectified PNG with that single marker model for band labelling. If the proposed corners leave out an active or uncertain lane, the app expands the correction area within the image before labelling. This adjustment runs locally. The completed figure opens in the editor. If a stage fails, its message appears on the automatic page and the current project stays open.

### Step 3: try the review workspace with one non-confidential gel

1. Import a gel you are allowed to upload and check type/orientation.
2. Open AI Marker, select the Marker model **at the top**, then click **Send image and recognize**. Opening settings, selecting a model and generating a local comparison do not upload an image.
3. Check the returned lane mapping, sizes and exact positions. Adjust selections/coordinates and choose Apply this result. Recognition does not automatically adopt the result.
4. AI lane correction uses the same settings: inspect corners, lanes, blank/uncertain proposals and the adoption summary first.
5. On return, the main figure is fitted immediately. Save your project and export the chosen format.

## Explicit vision-model IDs

Use an image-understanding model that accepts images and returns text/JSON. **The OpenAI inventory is checked through GPT-6.2 Astra / Sol as of 2026-11-18**; the Alibaba/Gemini examples retain their 2026-11-17 verification date. Choose one provider to start.

| Provider | API address example | Exact model ID | Official evidence / note |
|---|---|---|---|
| Alibaba Model Studio, Beijing | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3-vl-plus` | Used in the [official OpenAI Vision compatibility example](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai). Match the key’s region. |
| Alibaba Model Studio, Beijing | Same, or the console’s same-region workspace base | `qwen4-max` | Used by the [official vision-understanding example](https://help.aliyun.com/zh/model-studio/vision). Check account access. |
| OpenAI | `https://api.openai.com/v1` | `gpt-6.2-astra` | Quality-first choice; [official model card](https://developers.openai.com/api/docs/models/gpt-6.2-astra). See the full OpenAI selection below. |
| OpenAI | `https://api.openai.com/v1` | `gpt-6.2-sol` | Everyday balance; [official model card](https://developers.openai.com/api/docs/models/gpt-6.2-sol). |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen` | Used by the [official compatible image-understanding example](https://aistudio.google.com/docs/openai#image-understanding). |
| Google Gemini | Same | `gemini-3.5-flash-lite` | [Model card](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite): image input, text output; use the compatible endpoint above. |

A trailing `/` is optional. GelFigure adds `/chat/completions`; a complete URL ending in that path also works. Every OpenAI model compatible with this version uses `https://api.openai.com/v1` and your own OpenAI API key; change the Vision model name field to select a model.

<a id="openai-models"></a>
### OpenAI: choose by task, Astra → Sol → Terra → Luna

**Choose `gpt-6.2-astra` for quality first, `gpt-6.2-sol` for everyday balance, `gpt-6.1-terra` for lighter visual work, or `gpt-6-luna` for cost-sensitive simple triage.** This manual selection order follows the [official model positioning](https://developers.openai.com/api/docs/models). Gel-specific accuracy has not been ranked; check lanes, weak bands, model choices and coordinates yourself.

| Selection order | Exact ID / official model card | Task fit | Trade-off |
|---|---|---|---|
| 1 · quality first | [`gpt-6.2-astra`](https://developers.openai.com/api/docs/models/gpt-6.2-astra) | Demanding or ambiguous gels and a second review of important results; choose when quality is the priority. | Highest capability tier, with higher cost; source blur or missing information still needs human review. |
| 2 · everyday balance | [`gpt-6.2-sol`](https://developers.openai.com/api/docs/models/gpt-6.2-sol) | Routine lane/Marker review with a balance of capability, cost and latency. | More economical than Astra; a practical starting point for routine work. |
| 3 · lighter visual work | [`gpt-6.1-terra`](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | Initial position/lane/label review in clear images. | Positioned for efficient visual reasoning; manually choose a higher tier for demanding reviews. |
| 4 · cost first | [`gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna) | Simple, clearly bounded image triage or checking an API setup. | Lowest-cost tier; inspect weak, crowded or ambiguous bands carefully. |

In practice: open Settings, enter `https://api.openai.com/v1`, enter `gpt-6.2-astra` as the model, add your OpenAI API key and save. For a more economical everyday choice, manually change the model to `gpt-6.2-sol` before sending again. Enter only the exact ID in the model field. Review sends one request per click. Automatic processing uses the configured model for both steps. A failed request can be retried explicitly.

GPT-6.2 Astra / Sol reject `reasoning_effort: none`. GelFigure v1.1.0 omits this parameter and sends no `temperature`, `top_p` or `logprobs`, so the existing settings UI can be used. If a gateway inserts incompatible parameters and returns HTTP 400, ask its administrator to follow the [official migration guide](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart). The app’s 90-second timeout still applies; decide yourself whether to retry after a timeout.

#### Other compatible models in the current official catalog

Together with the four choices above, this lists **14 non-deprecated general models with image input and Chat Completions support**. Retain an older ID when an existing configuration needs it; prefer the current models above for new setups. Within each family, prefer the newer generation: Astra 6.2 → 6; Sol 6.2 → 6.1 → 6 → 5.6; Terra 6.1 → 5.6; Luna 6 → 5.6.

| Exact ID / official model card | Position | This app’s interface |
|---|---|---|
| [`gpt-6-astra`](https://developers.openai.com/api/docs/models/gpt-6-astra) | Earlier Astra | Image input + Chat Completions |
| [`gpt-6.1-sol`](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | Earlier Sol | Image input + Chat Completions |
| [`gpt-6-sol`](https://developers.openai.com/api/docs/models/gpt-6-sol) | Earlier Sol | Image input + Chat Completions |
| [`gpt-5.6-sol`](https://developers.openai.com/api/docs/models/gpt-5.6-sol) | Earlier Sol | Image input + Chat Completions |
| [`gpt-5.6-terra`](https://developers.openai.com/api/docs/models/gpt-5.6-terra) | Earlier Terra | Image input + Chat Completions |
| [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna) | Earlier Luna | Image input + Chat Completions |
| [`gpt-5.5`](https://developers.openai.com/api/docs/models/gpt-5.5) | Earlier general model | Image input + Chat Completions |
| [`gpt-5.4`](https://developers.openai.com/api/docs/models/gpt-5.4) | Earlier general model | Image input + Chat Completions |
| [`gpt-5.4-mini`](https://developers.openai.com/api/docs/models/gpt-5.4-mini) | Earlier smaller model | Image input + Chat Completions |
| [`gpt-5.2`](https://developers.openai.com/api/docs/models/gpt-5.2) | Earlier general model | Image input + Chat Completions |

#### Vision models that cannot be used directly by this version

These three models remain in the official catalog but are **Responses-only**. GelFigure v1.1.0 uses Chat Completions; changing only the model name or entering a `/responses` URL does not make them work.

| Model / official model card | Direct use in this version |
|---|---|
| [`gpt-5.5-pro`](https://developers.openai.com/api/docs/models/gpt-5.5-pro) | Unavailable; Responses API only |
| [`gpt-5.4-pro`](https://developers.openai.com/api/docs/models/gpt-5.4-pro) | Unavailable; Responses API only |
| [`gpt-5.2-pro`](https://developers.openai.com/api/docs/models/gpt-5.2-pro) | Unavailable; Responses API only |

<details>
<summary>Older configurations: deprecated vision models before their shutdown dates</summary>

The [official retirement schedule](https://developers.openai.com/api/docs/deprecations), checked on 2026-11-18, lists these models in transition. Access depends on the account and exact snapshot; they are not recommended for new student setups. For 4o / 4.1, the explicit snapshots from the schedule are listed without duplicating their aliases.

| Older ID / official model card | This app’s interface | Scheduled shutdown |
|---|---|---|
| [`gpt-5.4-nano`](https://developers.openai.com/api/docs/models/gpt-5.4-nano) | Image input + Chat Completions | 2027-04-01 |
| [`gpt-5.1`](https://developers.openai.com/api/docs/models/gpt-5.1) | Image input + Chat Completions | 2027-04-01 |
| [`gpt-5`](https://developers.openai.com/api/docs/models/gpt-5) | Image input + Chat Completions | 2026-12-11 |
| [`gpt-5-mini`](https://developers.openai.com/api/docs/models/gpt-5-mini) | Image input + Chat Completions | 2026-12-11 |
| [`gpt-5-nano`](https://developers.openai.com/api/docs/models/gpt-5-nano) | Image input + Chat Completions | 2026-12-11 |
| [`o3`](https://developers.openai.com/api/docs/models/o3) | Image input + Chat Completions | 2026-12-11 |
| [`gpt-4o-2024-08-06`](https://developers.openai.com/api/docs/models/gpt-4o) | Image input + Chat Completions | 2027-01-14 |
| [`gpt-4o-2024-11-20`](https://developers.openai.com/api/docs/models/gpt-4o) | Image input + Chat Completions | 2027-01-14 |
| [`gpt-4o-mini-2024-07-18`](https://developers.openai.com/api/docs/models/gpt-4o-mini) | Image input + Chat Completions | 2027-01-14 |
| [`gpt-4.1-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1) | Image input + Chat Completions | 2027-01-14 |
| [`gpt-4.1-mini-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1-mini) | Image input + Chat Completions | 2027-01-14 |
| [`gpt-5-pro`](https://developers.openai.com/api/docs/models/gpt-5-pro) | Unavailable; Responses API only | 2026-12-11 |
| [`o3-pro`](https://developers.openai.com/api/docs/models/o3-pro) | Unavailable; Responses API only | 2026-12-11 |
| [`gpt-5.3-codex`](https://developers.openai.com/api/docs/models/gpt-5.3-codex) | Unavailable; Responses API only | 2027-04-01 |

Retirement dates can change; the provider’s current notice takes precedence. Models already shut down are omitted from this usable-model inventory.

</details>

**Compatibility verification:** each OpenAI model card’s image-input and endpoint support was checked against the [full catalog](https://developers.openai.com/api/docs/models/all). The three provider bases above passed unauthenticated, image-free CORS preflights for this web app’s origin on 2026-11-17. No paid-key, model-by-model gel-accuracy benchmark was performed. Actual calls still require account access, quota, supported region, provider policy and valid JSON output.

For a lab gateway or third-party service, ask its administrator for the complete HTTPS base, a Base64 `image_url` model ID, a key and browser-origin support. It must accept non-streaming Chat Completions and standard `choices[].message.content` text/JSON responses. Native Claude, DashScope, Gemini or image-generation endpoints require a compatible gateway before use here.

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

- Editing, traditional local detection, project restoration and exports run in the browser. Marker review sends a complete analysis PNG with the selected model entry or the current catalogue. Automatic processing sends the two images described above to the same configured endpoint.
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

The standalone build is `dist/GelFigure.html`. Regression coverage includes automatic correction of undersized corners and edge lanes, colour/type rules, the AI protocol, manual protections, undo/projects, preview fit, exports and simulated phones. Tests use synthetic gels and intercepted responses; they do not claim measured accuracy on real gels or every provider. See [CHANGELOG](CHANGELOG.md) and [SECURITY](SECURITY.md).

## Acknowledgements

This project builds on [poplarity/GelFigure](https://github.com/poplarity/GelFigure). Thank you for its gel-processing, annotation and export foundation. BiosickQiuence maintains the v1.1.0 adaptations and release in this repository; original copyright notices and the MIT terms are retained in [LICENSE](LICENSE).
