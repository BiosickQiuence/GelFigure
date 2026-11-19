# GelFigure v1.1.0

**把 DNA 胶、蛋白胶整理成可编辑、可导出的实验图。支持本地编辑、AI 复核，以及从泳道校正到 Marker 标记的全自动处理。**

[English](README.md) · [打开网页版](https://biosickqiuence.github.io/GelFigure/) · [下载完整离线 HTML](https://github.com/BiosickQiuence/GelFigure/releases/download/v1.1.0/GelFigure-v1.1.0.html) · [全部下载](https://github.com/BiosickQiuence/GelFigure/releases/tag/v1.1.0)

> 不会编程也能用。普通整理、手动校正和导出不需要 API，也不需要安装 Python、Node.js 或其他软件。只有使用 AI 看图时，才需要准备自己的视觉 API。

## 先打开，再导入胶图

1. 直接打开上面的网页版；或者在 Release 中下载 **GelFigure-v1.1.0.html**，双击，用 Chrome、Edge、Firefox 或 Safari 打开。不要只另存仓库中的 `index.html`，它依赖旁边的其他文件。
2. 将胶图拖进窗口，或点“打开图片”。支持常见图片及 TIFF；多张曝光可一起导入再比较。
3. 核对左侧“胶的类型”。本版按用户选定的颜色规则处理：检测到可靠蓝色时按蛋白胶，黑白图按 DNA 胶；仍可手动切换。黑白蛋白胶应自行选择“蛋白胶”。
4. 新图默认保留原色和原始明暗。需要灰度调整时再主动切换。已有项目恢复其保存的显示选择。
5. 核对裁切红框、泳道数与 Marker，填写泳道名、分组或标注，再导出。
6. 继续编辑请保存 `.gelfig` 项目。PNG 等成图不能替代项目文件；关闭网页前先保存。浏览器缓存不等于永久备份。

## 本版可以做什么

- 手动四点透视校正，适用于斜拍胶图；支持方向、旋转、裁切、泳道与逐条标注编辑。
- 可选 AI 泳道校正：先给出位置和空道建议，人工检查后再应用。
- AI Marker 与本地比较共用工作区：顶部选一次型号，两种识别共同使用。可选择需要标注的大小、修改真实坐标、隐藏某条标签。
- 默认按条带从上到下、大小从大到小顺序配对。缺失的位置留空，多余的位置保留但不显示，并提示数量不一致；不会补造条带。
- 应用结果后自动返回主界面并适配预览，无需重新选择 DPI；保留预览缩放、DPI 与 Marker 坐标。
- 支持撤销、历史项目、仅版式模板、PNG / TIFF / SVG / 可编辑 PPTX，以及含原图、项目、记录和校验清单的审阅 ZIP。

AI 建议需要人工复核，尤其是弱带、空道、型号、缺失条带和误匹配；本工具不提供条带修补、背景扣除或定量分析。

<a id="api-setup"></a>
## 第一次配置 AI：只需要填写三个格子

“API”可以理解为 GelFigure 向你选择的 AI 服务请求看图的通道。请先选定一家服务商，再从**同一家服务商**取得下面三项。网页版、聊天软件会员和 API 控制台是不同入口；能在聊天网页看图，不代表已经有可用的 API Key 或 API 额度。

| GelFigure 设置中的字段 | 应填写什么 | 常见错误 |
|---|---|---|
| 接口地址 | 服务商提供的 HTTPS **OpenAI 兼容 Chat Completions** 基址，示例见下表 | 填成聊天网站、控制台网址、`/responses` 或原生 `/messages` 接口 |
| 视觉模型名称 | 完整、大小写准确的 API 模型 ID，如 `qwen3-vl-plus` | 填模型的中文显示名，或使用不支持图片的文本模型 |
| API 密钥 | 从该服务商 API 控制台创建的完整 Key | 填登录密码、手机验证码、项目 ID，或另一家服务商的 Key |

![GelFigure 中文 API 设置示例：三个输入框](docs/api-settings-zh.png)

### 第一步：选一家服务商，获得 Key

**方式 A：阿里云百炼 / Model Studio。**

1. 打开[百炼控制台](https://bailian.console.aliyun.com/)，登录并按平台提示开通模型服务。
2. 先确认地域。下面的简单示例使用**华北 2（北京）**，API Key、模型权限和接口地域必须对应。
3. 进入 API Key 管理，创建 Key，选择有相应模型权限的业务空间。按[官方 API Key 教程](https://help.aliyun.com/zh/model-studio/get-api-key)完成；新 Key 可能只完整显示一次，应在创建时自行妥善保存。
4. 到控制台确认自己有可用额度或计费设置，并能使用 `qwen3-vl-plus`。费用、免费额度和可用地区以平台控制台为准。
5. 将北京区兼容基址、模型 ID 和 Key 填入 GelFigure。若控制台给出业务空间专属域名，请优先使用控制台的完整基址；**不要原样复制带 `{WorkspaceId}` 的占位地址**。官方说明现有 `dashscope.aliyuncs.com` 域名仍可使用。

**方式 B：OpenAI API。**

1. 打开 [OpenAI API Platform](https://platform.openai.com/)，登录，选择或建立自己的 API 项目。
2. 在 API Keys 页面创建项目 Key，并在 API 计费/额度页面确认能发起模型请求。不要把聊天会员登录信息当成 API Key。
3. 接口填 `https://api.openai.com/v1`，质量优先时模型填 `gpt-6.2-astra`，日常兼顾费用时填 `gpt-6.2-sol`，Key 填刚创建的值。[下方 OpenAI 选型表](#openai-models)列出截至 GPT-6.2 的全部当前兼容通用看图型号、旧型号与接口限制；实际权限以自己的 API 项目为准。
4. 参考[官方 API 入门](https://developers.openai.com/api/docs/quickstart)。本工具已经完成调用代码，**你不需要执行教程里的编程命令**。

**方式 C：Google Gemini API。**

1. 打开 [Google AI Studio 的 API Key 页面](https://aistudio.google.com/apikey)，按页面提示选择或创建项目并取得 Gemini API Key；参见[官方密钥教程](https://aistudio.google.com/docs/api-key)。
2. 在项目中确认模型可用及额度/计费状态。学校或机构账号可能需要管理员开放项目权限。
3. 接口一定使用下表的 **OpenAI 兼容基址**，不要填 Gemini 聊天网页或原生 `:generateContent` URL。模型可填 `gemini-4-hydrogen`。

### 第二步：在 GelFigure 中填入并保存

1. 打开 GelFigure，点击**右上角“设置”**。不需要先导入图片。
2. 将选定服务商的接口地址、完整模型 ID 和 Key 分别粘贴进三个输入框。不要在 Key 前加 `Bearer `，不要加引号、空格或换行。
3. 点击**“保存接口配置”**。布局与 Marker 共用这套配置。
4. 初次使用建议不勾选“在当前浏览器记住密钥”。此时 Key 只保存在当前页面内存，关页后需重填；接口地址和模型名称可以保存。
5. 在自己的私人电脑上可主动选择记住，但这是浏览器本地明文存储。共享电脑不要勾选；需要时点“清除密钥”。项目和成图不会携带 Key。

### AI 全自动处理

保存格式有效的 HTTPS 地址、视觉模型名称和密钥后，在设置或主界面侧栏点击**“AI 全自动处理”**。拖入一张胶图（也可点击选图），选择实验使用的 DNA 或蛋白 Marker。两项先后顺序均可。两项齐全后，程序先发送输入图的分析副本以定位胶面和泳道，再发送校正图及所选的单一型号以标记条带。如果四角漏掉有带或不确定的泳道，程序会在原图边界内自动扩大校正范围，再继续标记。扩框在本地完成。处理完成后直接打开可编辑的成图。任一步失败时，自动页面会说明原因，原项目仍保留。

### 第三步：用一张不保密的胶图试用复核工作区

1. 导入一张允许上传的胶图，核对胶类型与方向。
2. 打开 AI Marker，先在**最上方**选择 Marker 型号，再点**“发送图像并识别”**。选择型号、打开设置和生成本地比较结果本身都不会上传。
3. 等待结果，再核对泳道、每条大小与坐标。必要时修改勾选或坐标，再点“应用这份结果”。识别完成不等于已经应用。
4. AI 泳道校正也使用同一配置：先复核角点、泳道、空道和不确定项，再按页内提示应用。
5. 应用后直接返回正常大小的主预览，再保存项目或导出。

## 可以填写哪些看图模型？

本工具使用能接收图片并返回文字/JSON 的视觉理解模型。**OpenAI 清单已核对到 GPT-6.2 Astra / Sol，核对日期为 2026-11-18**；百炼与 Gemini 保留 2026-11-17 已核对的示例。先选一家服务商即可。

| 服务商 | “接口地址”示例 | 可直接填写的模型 ID | 使用提示 / 官方出处 |
|---|---|---|---|
| 阿里云百炼（北京） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3-vl-plus` | [官方 Vision 兼容示例](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai)直接使用此 ID；Key 和地域要一致。 |
| 阿里云百炼（北京） | 同上，或控制台提供的同地域业务空间基址 | `qwen4-max` | [官方视觉理解示例](https://help.aliyun.com/zh/model-studio/vision)使用的图像输入模型；先确认账号权限。 |
| OpenAI | `https://api.openai.com/v1` | `gpt-6.2-astra` | 质量优先；[官方模型卡](https://developers.openai.com/api/docs/models/gpt-6.2-astra)。完整选型顺序见下方。 |
| OpenAI | `https://api.openai.com/v1` | `gpt-6.2-sol` | 日常使用、兼顾费用；[官方模型卡](https://developers.openai.com/api/docs/models/gpt-6.2-sol)。 |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen` | [官方兼容接口的图像示例](https://aistudio.google.com/docs/openai#image-understanding)使用此 ID。 |
| Google Gemini | 同上 | `gemini-3.5-flash-lite` | [官方模型卡](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite)确认 Image 输入、Text 输出；走上述兼容接口。 |

基址结尾的 `/` 可有可无，工具会补上 `/chat/completions`；也可以填写以该路径结尾的完整地址。下面所有可用于本版的 OpenAI 型号共用基址 `https://api.openai.com/v1` 和你自己的 OpenAI API Key，只需修改“视觉模型名称”。

<a id="openai-models"></a>
### OpenAI：按任务选择，优先 Astra → Sol → Terra → Luna

**质量优先选 `gpt-6.2-astra`；日常兼顾费用选 `gpt-6.2-sol`；轻量视觉整理选 `gpt-6.1-terra`；最低费用的简单初筛选 `gpt-6-luna`。** 这四档顺序依据[官方模型定位](https://developers.openai.com/api/docs/models)给出，是人工选型建议，尚未做胶图专用准确率排名。泳道、弱带、型号和坐标仍需人工复核。

| 使用顺序 | 完整模型 ID / 官方模型卡 | 适合的任务 | 取舍 |
|---|---|---|---|
| 1 · 质量优先 | [`gpt-6.2-astra`](https://developers.openai.com/api/docs/models/gpt-6.2-astra) | 复杂或难判断的胶图、重要结果的第二次复核；预算与等待时间允许时优先。 | 综合能力最高档，费用较高；不能保证解决原图模糊或缺失的信息。 |
| 2 · 日常首选 | [`gpt-6.2-sol`](https://developers.openai.com/api/docs/models/gpt-6.2-sol) | 日常泳道与 Marker 识别，兼顾能力、费用和响应时间。 | 相较 Astra 更经济；时间或预算有限时可直接从这里开始。 |
| 3 · 轻量视觉任务 | [`gpt-6.1-terra`](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | 清晰胶图中的位置、泳道和标签初步整理。 | 官方定位为视觉推理与高效任务；复杂结果可手动交给更高档型号复核。 |
| 4 · 费用优先 | [`gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna) | 清晰、简单、边界明确的图片初筛，或先验证接口配置。 | 费用最低档；弱带、密集条带和模糊结果需要更仔细的人工核对。 |

实际操作：打开右上角“设置”，接口填 `https://api.openai.com/v1`，模型先填 `gpt-6.2-astra`，密钥填自己的 OpenAI API Key，点击“保存接口配置”。需要降低费用或缩短等待时，可自己把模型改为 `gpt-6.2-sol` 后重新发送。模型名称只填表中的完整 ID。复核模式每次点击发送一条请求。全自动处理的两步均使用你配置的模型。请求失败后可以手动重试。

GPT-6.2 Astra / Sol 不接受 `reasoning_effort: none`。GelFigure v1.1.0 的识别请求省略该参数，也不发送 `temperature`、`top_p` 或 `logprobs`，可沿用现有设置界面。如果中转服务擅自补入这些参数而报 400，请让服务管理员按[官方迁移说明](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart)修正。耗时仍受本工具 90 秒超时限制；超时后需自己决定是否重试。

#### 其余仍在官方当前目录中的可用型号

加上上表四个型号，下面共列出 **14 个未弃用、支持图片输入与 Chat Completions 的通用型号**。旧配置需要继续使用时，可填写对应 ID；新配置优先选择上面的当前主力型号。同系列优先新版：Astra 6.2 → 6；Sol 6.2 → 6.1 → 6 → 5.6；Terra 6.1 → 5.6；Luna 6 → 5.6。

| 完整模型 ID / 官方模型卡 | 定位 | 本版接口 |
|---|---|---|
| [`gpt-6-astra`](https://developers.openai.com/api/docs/models/gpt-6-astra) | 旧代 Astra | 支持图片 + Chat Completions |
| [`gpt-6.1-sol`](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | 旧代 Sol | 支持图片 + Chat Completions |
| [`gpt-6-sol`](https://developers.openai.com/api/docs/models/gpt-6-sol) | 旧代 Sol | 支持图片 + Chat Completions |
| [`gpt-5.6-sol`](https://developers.openai.com/api/docs/models/gpt-5.6-sol) | 旧代 Sol | 支持图片 + Chat Completions |
| [`gpt-5.6-terra`](https://developers.openai.com/api/docs/models/gpt-5.6-terra) | 旧代 Terra | 支持图片 + Chat Completions |
| [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna) | 旧代 Luna | 支持图片 + Chat Completions |
| [`gpt-5.5`](https://developers.openai.com/api/docs/models/gpt-5.5) | 旧代通用模型 | 支持图片 + Chat Completions |
| [`gpt-5.4`](https://developers.openai.com/api/docs/models/gpt-5.4) | 旧代通用模型 | 支持图片 + Chat Completions |
| [`gpt-5.4-mini`](https://developers.openai.com/api/docs/models/gpt-5.4-mini) | 旧代轻量模型 | 支持图片 + Chat Completions |
| [`gpt-5.2`](https://developers.openai.com/api/docs/models/gpt-5.2) | 旧代通用模型 | 支持图片 + Chat Completions |

#### 支持看图，但本版接口不能直接使用的型号

下面三种仍在官方目录中，均为 **Responses API 专用**。GelFigure v1.1.0 使用 Chat Completions，不能仅修改模型名称或把地址改为 `/responses` 来调用它们。

| 型号 / 官方模型卡 | 本版能否直接填写 |
|---|---|
| [`gpt-5.5-pro`](https://developers.openai.com/api/docs/models/gpt-5.5-pro) | 不能；仅支持 Responses API |
| [`gpt-5.4-pro`](https://developers.openai.com/api/docs/models/gpt-5.4-pro) | 不能；仅支持 Responses API |
| [`gpt-5.2-pro`](https://developers.openai.com/api/docs/models/gpt-5.2-pro) | 不能；仅支持 Responses API |

<details>
<summary>旧配置附录：已弃用但尚未到停用日期的视觉型号</summary>

按 2026-11-18 的[官方停用计划](https://developers.openai.com/api/docs/deprecations)，以下旧型号仍处于过渡期；可用性依赖账户权限和具体快照，不作为学生新配置的推荐。4o / 4.1 系列按停用表列出明确快照，不重复列别名。

| 旧型号 / 官方模型卡 | 本版接口 | 官方计划停用日 |
|---|---|---|
| [`gpt-5.4-nano`](https://developers.openai.com/api/docs/models/gpt-5.4-nano) | 支持图片 + Chat Completions | 2027-04-01 |
| [`gpt-5.1`](https://developers.openai.com/api/docs/models/gpt-5.1) | 支持图片 + Chat Completions | 2027-04-01 |
| [`gpt-5`](https://developers.openai.com/api/docs/models/gpt-5) | 支持图片 + Chat Completions | 2026-12-11 |
| [`gpt-5-mini`](https://developers.openai.com/api/docs/models/gpt-5-mini) | 支持图片 + Chat Completions | 2026-12-11 |
| [`gpt-5-nano`](https://developers.openai.com/api/docs/models/gpt-5-nano) | 支持图片 + Chat Completions | 2026-12-11 |
| [`o3`](https://developers.openai.com/api/docs/models/o3) | 支持图片 + Chat Completions | 2026-12-11 |
| [`gpt-4o-2024-08-06`](https://developers.openai.com/api/docs/models/gpt-4o) | 支持图片 + Chat Completions | 2027-01-14 |
| [`gpt-4o-2024-11-20`](https://developers.openai.com/api/docs/models/gpt-4o) | 支持图片 + Chat Completions | 2027-01-14 |
| [`gpt-4o-mini-2024-07-18`](https://developers.openai.com/api/docs/models/gpt-4o-mini) | 支持图片 + Chat Completions | 2027-01-14 |
| [`gpt-4.1-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1) | 支持图片 + Chat Completions | 2027-01-14 |
| [`gpt-4.1-mini-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1-mini) | 支持图片 + Chat Completions | 2027-01-14 |
| [`gpt-5-pro`](https://developers.openai.com/api/docs/models/gpt-5-pro) | 不能；仅支持 Responses API | 2026-12-11 |
| [`o3-pro`](https://developers.openai.com/api/docs/models/o3-pro) | 不能；仅支持 Responses API | 2026-12-11 |
| [`gpt-5.3-codex`](https://developers.openai.com/api/docs/models/gpt-5.3-codex) | 不能；仅支持 Responses API | 2027-04-01 |

停用计划可能调整，应以服务商当前页面为准。已停用的型号未列入可用清单。

</details>

**兼容验证范围：** 已逐项核对 OpenAI 模型卡的图片输入和接口支持情况，并参考[完整模型目录](https://developers.openai.com/api/docs/models/all)。上述三家示例基址在 2026-11-17 做过不带 Key、无图像的浏览器跨域预检，允许本项目网页版来源。尚未用付费 Key 逐一实测这些型号的胶图准确率；实际调用还取决于账号权限、额度、地区、服务商策略和有效 JSON 输出。

第三方中转或实验室自建服务也可配置，请向管理员索取完整 HTTPS 基址、支持 Base64 `image_url` 的模型 ID、Key，以及允许浏览器访问的说明。还需支持非流式 Chat Completions 和标准 `choices[].message.content` 文字/JSON 回复；原生 Claude、DashScope、Gemini 或文生图接口应由服务管理员提供兼容接口后再使用。

## 配置失败时，先按这个表排查

| 提示或现象 | 优先检查什么 |
|---|---|
| 401 / invalid API key | Key 是否完整、是否误带空格/引号，是否属于当前接口平台，是否失效。 |
| 403 / 无权限 | 账号地区、项目权限、模型权限与 Key 地域是否匹配。 |
| 404 / model not found | 基址是否少了 `/v1` 或 Gemini 的 `/openai`，模型 ID 是否拼错，账号是否可用此模型。 |
| 429 / quota | 到服务商控制台检查额度、账单和调用频率；不要连续点击。 |
| 网络、CORS、证书或重定向错误 | 先试官方基址；尝试网页版。向中转/自建服务管理员确认支持当前网页来源和离线文件的 `Origin: null`。不要关闭浏览器安全设置。 |
| 图片不支持 / 参数无效 | 可能选了纯文本、语音、文生图模型，或用了不兼容协议。按模型表重新配齐同一家的三项。 |
| 90 秒超时 | 本工具已取消，不会自动重试。先用较小的另存副本检查网络和服务负载，再主动重试；不要覆盖实验原图。 |
| 不是 JSON、截断、坐标/型号校验失败 | 尚未应用。换用支持指令与结构化文字输出的视觉模型，或联系接口提供方；不要把错误输出强行当结果。 |
| “项目已变化，草稿过期” | 识别期间改图、旋转、切项目或改型号后，旧结果不能再应用，需要重新识别。 |
| 识别位置/型号不对 | 先核对原图方向、胶类型、型号和条带勾选，再人工微调。连通成功不代表识别正确。 |

遇到问题，可从网页“GitHub 反馈”或[本仓库 Issues](https://github.com/BiosickQiuence/GelFigure/issues/new/choose)提交说明，需要 GitHub 账号。可提供浏览器、报错文字与去敏后的步骤；**不要公开 API Key、保密胶图或未发表数据**。

## 图像、隐私与导出

- 日常编辑、传统本地识别、项目恢复和导出在浏览器内进行。Marker 复核发送完整分析图 PNG 及所选型号（未指定时为当前类型目录）。全自动处理会向同一接口依次发送输入图和校正图的分析副本。
- AI 的“完整分析图”经过当前透视、方向和旋转处理，但**不等同于只发送红框内区域**，不包含界面、泳道名、文字标注或项目文件。上传前检查整张输入图是否允许分享。
- Key 不进入项目、处理记录或图像导出。外部服务如何保留图像由其政策决定。
- 原始文件字节保留；几何校正、剪道和相关处理在记录中说明。PNG/TIFF 的文件 DPI 与胶图有效 DPI 是不同指标；看“胶图有效 DPI”评估原图分辨率。
- 网页不再提供赞助二维码、支付链接或第三方反馈转发，也不弹出版本新增功能/历史界面。反馈和 Star 只在主动点击后打开本仓库 GitHub 页面。

## 开发与验证

网页运行无需依赖；仅开发测试需要 Node.js 22+ 与 Playwright：

```text
npm ci
npx playwright install chromium firefox webkit
npm test
node scripts/bundle-onefile.mjs
```

`dist/GelFigure.html` 是构建后的单文件。v1.1.0 包括四角偏小与贴边泳道的自动校正、颜色/显示、AI 协议、人工保护、撤销、项目、预览适配、导出和手机模拟回归；测试使用合成图与拦截响应，不宣称真实胶图或每家视觉 API 的实测准确率。详细发布记录见 [CHANGELOG](CHANGELOG.md)，安全说明见 [SECURITY](SECURITY.md)。

## 致谢

本项目基于 [poplarity/GelFigure](https://github.com/poplarity/GelFigure) 改进，感谢原项目提供的胶图处理、标注和导出基础。本仓库由 BiosickQiuence 维护 v1.1.0 的改造与发布，原始版权声明和 MIT 许可保留在 [LICENSE](LICENSE)。
