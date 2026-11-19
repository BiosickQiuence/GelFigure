# Vision Models Reference · 视觉模型完整目录

GelFigure uses **OpenAI-compatible Chat Completions** (`POST .../chat/completions`) with Base64 `image_url` input and non-streaming text/JSON output.

GelFigure 使用兼容 **OpenAI Chat Completions** 格式的视觉理解接口（Base64 `image_url` 输入、非流式文本/JSON 输出）。

> **Verification dates / 核对日期**：OpenAI catalog checked through GPT-6.2 Astra / Sol on **2026-11-18**; Alibaba Model Studio & Google Gemini checked on **2026-11-17**. Actual availability depends on your account quota, region, and provider policy.

---

## 1. Quick Provider Table · 常用服务商速查

| Provider / 服务商 | API Base URL / 接口地址 | Recommended Models / 推荐模型 | Notes / 说明 |
|---|---|---|---|
| Alibaba Model Studio (Beijing) / 阿里云百炼（北京） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3-vl-plus`, `qwen4-max` | Region must match API key. Official docs: [OpenAI Vision compatibility](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai), [Vision](https://help.aliyun.com/zh/model-studio/vision). |
| OpenAI | `https://api.openai.com/v1` | `gpt-6.2-sol`, `gpt-6.2-astra` | Quality first: `gpt-6.2-astra`; everyday balance: `gpt-6.2-sol`. |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen`, `gemini-3.5-flash-lite` | Use the OpenAI-compatible base, not native `:generateContent`. [Docs](https://aistudio.google.com/docs/openai#image-understanding). |

A trailing `/` is optional; GelFigure appends `/chat/completions` automatically unless already present.

---

## 2. OpenAI Complete Compatible Inventory (Astra → Sol → Terra → Luna)

### Primary Choices · 主力档位

| Priority / 档位 | Exact Model ID | Task Fit / 适用场景 | Trade-off / 取舍 |
|---|---|---|---|
| 1 · Quality first / 质量优先 | [`gpt-6.2-astra`](https://developers.openai.com/api/docs/models/gpt-6.2-astra) | Demanding or ambiguous gels; second review of important results | Highest capability tier and cost; human review still required |
| 2 · Everyday balance / 日常首选 | [`gpt-6.2-sol`](https://developers.openai.com/api/docs/models/gpt-6.2-sol) | Routine lane & Marker recognition | Balanced capability, cost, and latency |
| 3 · Lighter visual work / 轻量视觉 | [`gpt-6.1-terra`](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | Initial lane/label layout on clear images | Efficient visual reasoning; use higher tier for crowded gels |
| 4 · Cost first / 费用优先 | [`gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna) | Simple bounded triage or verifying API connectivity | Lowest cost; inspect weak/crowded bands carefully |

> **Compatibility note**: GPT-6.2 Astra / Sol reject `reasoning_effort: none`. GelFigure omits `reasoning_effort`, `temperature`, `top_p`, and `logprobs`. If a third-party gateway injects them and returns HTTP 400, see the [official migration guide](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart).

### Other Non-Deprecated Compatible Models · 其余当前目录兼容型号

Prefer newer generations within each family (`Astra 6.2 → 6`, `Sol 6.2 → 6.1 → 6 → 5.6`, `Terra 6.1 → 5.6`, `Luna 6 → 5.6`).

| Exact Model ID | Position / 定位 | Interface / 接口支持 |
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

### Vision Models Not Directly Supported (Responses API Only) · 不可直连型号

GelFigure calls Chat Completions; changing only the model ID or appending `/responses` will not work for these models:

| Model ID | Status |
|---|---|
| [`gpt-5.5-pro`](https://developers.openai.com/api/docs/models/gpt-5.5-pro) | Responses API only |
| [`gpt-5.4-pro`](https://developers.openai.com/api/docs/models/gpt-5.4-pro) | Responses API only |
| [`gpt-5.2-pro`](https://developers.openai.com/api/docs/models/gpt-5.2-pro) | Responses API only |

### Deprecated Models Before Shutdown · 已弃用过渡型号

Per the [official retirement schedule](https://developers.openai.com/api/docs/deprecations) (checked 2026-11-18). Not recommended for new setups:

| Older Model ID | Interface | Scheduled Shutdown |
|---|---|---|
| [`gpt-5.4-nano`](https://developers.openai.com/api/docs/models/gpt-5.4-nano) | Image + Chat Completions | 2027-04-01 |
| [`gpt-5.1`](https://developers.openai.com/api/docs/models/gpt-5.1) | Image + Chat Completions | 2027-04-01 |
| [`gpt-5`](https://developers.openai.com/api/docs/models/gpt-5) | Image + Chat Completions | 2026-12-11 |
| [`gpt-5-mini`](https://developers.openai.com/api/docs/models/gpt-5-mini) | Image + Chat Completions | 2026-12-11 |
| [`gpt-5-nano`](https://developers.openai.com/api/docs/models/gpt-5-nano) | Image + Chat Completions | 2026-12-11 |
| [`o3`](https://developers.openai.com/api/docs/models/o3) | Image + Chat Completions | 2026-12-11 |
| [`gpt-4o-2024-08-06`](https://developers.openai.com/api/docs/models/gpt-4o) | Image + Chat Completions | 2027-01-14 |
| [`gpt-4o-2024-11-20`](https://developers.openai.com/api/docs/models/gpt-4o) | Image + Chat Completions | 2027-01-14 |
| [`gpt-4o-mini-2024-07-18`](https://developers.openai.com/api/docs/models/gpt-4o-mini) | Image + Chat Completions | 2027-01-14 |
| [`gpt-4.1-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1) | Image + Chat Completions | 2027-01-14 |
| [`gpt-4.1-mini-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1-mini) | Image + Chat Completions | 2027-01-14 |
| [`gpt-5-pro`](https://developers.openai.com/api/docs/models/gpt-5-pro) | Responses API only | 2026-12-11 |
| [`o3-pro`](https://developers.openai.com/api/docs/models/o3-pro) | Responses API only | 2026-12-11 |
| [`gpt-5.3-codex`](https://developers.openai.com/api/docs/models/gpt-5.3-codex) | Responses API only | 2027-04-01 |

---

## 3. Custom / Lab Gateways · 实验室网关与第三方中转

Ask your gateway administrator for:
1. Full HTTPS OpenAI-compatible base URL.
2. Exact vision model ID supporting Base64 `image_url`.
3. API key.
4. CORS headers permitting your web origin (and `Origin: null` if running the offline `GelFigure.html` file).
