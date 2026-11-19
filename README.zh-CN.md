# GelFigure v1.5.0

**把 DNA 胶、蛋白胶整理成可编辑、可导出的实验图。支持本地编辑、AI 复核，以及从泳道校正到 Marker 标记的全自动处理。**

[English](README.md) · [打开网页版](https://biosickqiuence.github.io/GelFigure/) · [下载完整离线 HTML](https://github.com/BiosickQiuence/GelFigure/releases/download/v1.5.0/GelFigure-v1.5.0.html) · [全部下载](https://github.com/BiosickQiuence/GelFigure/releases/tag/v1.5.0)

> 不会编程也能用。普通整理、手动校正和导出不需要 API，也不需要安装 Python、Node.js 或其他软件。只有使用 AI 看图时，才需要准备自己的视觉 API。

## 先打开，再导入胶图

1. 直接打开上面的网页版；或者在 Release 中下载 **GelFigure-v1.5.0.html**，双击，用 Chrome、Edge、Firefox 或 Safari 打开。不要只另存仓库中的 `index.html`，它依赖旁边的其他文件。
2. 将胶图拖进窗口，或点“打开图片”。支持常见图片及 TIFF；多张曝光可一起导入再比较。
3. 核对左侧“胶的类型”。本版按颜色规则判断：检测到可靠蓝色时按蛋白胶，黑白图按 DNA 胶；仍可手动切换。黑白蛋白胶应自行选择“蛋白胶”。
4. 新图默认保留原色和原始明暗。需要灰度调整时再主动切换。已有项目恢复其保存的显示选择。
5. 核对裁切红框、泳道数与 Marker，填写泳道名、分组或标注，再导出。
6. 继续编辑请保存 `.gelfig` 项目。PNG 等成图不能替代项目文件；关闭网页前先保存。浏览器缓存不等于永久备份。

## 本版可以做什么

- 手动四点透视校正，适用于斜拍胶图；支持方向、旋转、裁切、泳道与逐条标注编辑。
- 可选 AI 泳道校正与 AI 全自动处理：定位四角与泳道、标记 Marker 条带并打开可编辑成图。
- AI Marker 与本地比较共用工作区：顶部选一次型号，两种识别共同使用；顺序配对且不补造条带。
- 顶栏常显导出前检查状态角标；历史项目带缩略图、按原图 SHA-256 去重且不记录示例图。
- 支持撤销、仅版式模板、PNG / TIFF / SVG / 可编辑 PPTX，以及含原图、项目、记录和校验清单的审阅 ZIP。

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

- **阿里云百炼 / Model Studio**：登录[百炼控制台](https://bailian.console.aliyun.com/)，确认地域（如华北 2 北京），按[官方 API Key 教程](https://help.aliyun.com/zh/model-studio/get-api-key)创建 Key。Key、模型权限和接口地域必须对应。
- **OpenAI API**：登录 [OpenAI API Platform](https://platform.openai.com/)，在 API Keys 页面创建项目 Key（参见[官方入门](https://developers.openai.com/api/docs/quickstart)），并确认 API 额度。无需运行编程命令。
- **Google Gemini API**：打开 [Google AI Studio API Key](https://aistudio.google.com/apikey)（参见[官方教程](https://aistudio.google.com/docs/api-key)），接口请填写下方 OpenAI 兼容基址。

### 第二步：在 GelFigure 中填入并保存

1. 点击右上角**“设置”**，选择服务商预设并粘贴 API 密钥。
2. 点击**“保存接口配置”**，可点**“测试连接”**验证连通性。
3. 共享电脑请勿勾选“在当前浏览器记住密钥”（仅保留在当前页面内存，项目与成图均不包含 Key）。

### 推荐视觉模型

每家服务商任选其一即可（OpenAI Astra/Sol/Terra/Luna 完整选型、旧版兼容 ID、Responses-only 不可直连型号、停用计划与第三方网关要求见 **[docs/models.md](docs/models.md)**）：

| 服务商 | 接口地址 | 推荐模型 ID | 说明 |
|---|---|---|---|
| 阿里云百炼（北京） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3-vl-plus`、`qwen4-max` | Key 与地域须一致 |
| OpenAI | `https://api.openai.com/v1` | `gpt-6.2-sol`、`gpt-6.2-astra` | 日常首选 Sol；质量优先选 Astra |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-4-hydrogen`、`gemini-3.5-flash-lite` | 须使用 OpenAI 兼容基址 |

基址结尾的 `/` 可有可无，工具会自动补齐 `/chat/completions`。

### AI 全自动处理与复核

保存接口配置后，点击**“AI 全自动处理”**，拖入胶图并选择 Marker 型号。程序会自动定位四角与泳道（偏小四角在本地自动扩大以保留贴边泳道）、标记 Marker 条带并打开可编辑成图。手动编辑与 AI 复核界面仍可随时使用。

## 配置失败排查

| 提示或现象 | 优先检查什么 |
|---|---|
| 401 / invalid API key | Key 是否完整、是否误带空格/引号，是否属于当前接口平台，是否失效。 |
| 403 / 无权限 | 账号地区、项目权限、模型权限与 Key 地域是否匹配。 |
| 404 / model not found | 基址是否少了 `/v1` 或 Gemini 的 `/openai`，模型 ID 是否拼错。 |
| 429 / quota | 到服务商控制台检查额度、账单和调用频率；不要连续点击。 |
| 网络、CORS 或证书错误 | 先试官方基址与网页版；中转网关需允许当前网页来源及离线文件 `Origin: null`。 |
| 90 秒超时 | 先用较小副本检查网络与服务负载，再重试。 |
| 识别位置/型号不对 | 核对原图方向、胶类型、型号和条带勾选，再人工微调。 |

遇到问题可通过网页“GitHub 反馈”或[本仓库 Issues](https://github.com/BiosickQiuence/GelFigure/issues/new/choose)反馈；**切勿公开 API Key、保密胶图或未发表数据**。

## 图像、隐私与导出

- 日常编辑、本地识别、项目恢复和导出都在浏览器内进行；只有你主动触发 AI 处理时才会上传分析图 PNG。
- Key 不会进入项目、处理记录或图像导出。
- 原始文件字节保留；几何校正和剪道均在记录中披露。评估原图分辨率请查看“胶图有效 DPI”。

## 开发与验证

网页运行无需依赖；仅开发测试需要 Node.js 22+ 与 Playwright：

```text
npm ci
npx playwright install chromium firefox webkit
npm test
node scripts/bundle-onefile.mjs
```

单文件构建产物为 `dist/GelFigure.html`。详见 [CHANGELOG](CHANGELOG.md)、[docs/models.md](docs/models.md) 与 [SECURITY](SECURITY.md)。

## 致谢

本项目基于 [poplarity/GelFigure](https://github.com/poplarity/GelFigure) 改进。本仓库由 BiosickQiuence 维护 v1.x 改造与发布，原始版权声明和 MIT 许可保留在 [LICENSE](LICENSE)。
