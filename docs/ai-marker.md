> **Current model selection:** one selector above both recognition buttons drives local matching and the AI catalogue. Result rows display the model name without separate model menus. See [colour/shared-model update](colour-shared-marker.md).

> **Current local build (2026-11-17):** API configuration is in top-right Settings and Marker review is an inline task. Reset baselines are explicitly bound to the adopted state/source; historical provenance is retained separately from current results. The protocol and protection rules below remain applicable. See [current workflow](refactor-20261117.md).

# AI Marker v2.0.1

本说明介绍 BiosickQiuence/GelFigure v2.0.1 的 Marker 复核界面。使用全自动页面时，拖入图片并选择型号即可依次进行泳道校正和 Marker 标记。首次使用请先按 README 的 API 教程配置；网页与离线单文件使用同一套识别协议。

## 按型号大小顺序配对（本轮更新）

先在工作区最上方选择一次 Marker 型号，本地和 AI 识别共用；然后在 AI 栏勾选本图要标注的大小，默认全选。已知跑出胶或缺失的条带可取消。系统按真实位置从上到下、所选大小从大到小配对，不改变任何 Y 坐标。数量相等时直接对应；位置少时先对应上方条带，剩余较小大小留空，不补造位置；位置多时额外的下方坐标保留但不显示、不参与校准。数量不等仍允许应用，并在预览、应用提示、Marker 卡片和日志中记录数量不一致。

这是用户选定大小的顺序标注规则；数量相等也不代表 AI 已确认型号或生物学匹配。中间条带缺失时，请取消相应大小或逐条微调。旧项目已采用的手动配对在打开时保留；改变大小勾选或按“重新配对”才替换。型号未确认时仍不猜型号。下方逐条“显示”仅控制标签，与上方决定配对顺序的大小勾选不同。

## 使用步骤

1. 双击交付的单文件 HTML，导入 DNA 或蛋白胶。核对胶类型；斜拍图仍需手选四点拉正。
2. 在 Marker 面板点 **AI Marker · 比较 / 设置**，先在工作区顶部选择 Marker 型号。该型号用于本图各 Marker 泳道，本地和 AI 无需分别选择；也可先识别，再在顶部统一确认。
3. 填入支持视觉的 OpenAI 兼容 Chat Completions HTTPS 接口、完整模型名称和密钥。可填 `https://example.com/v1` 或完整 `https://example.com/v1/chat/completions`，基址会补上 `/chat/completions`。不接受 HTTP、URL 用户名密码、查询参数和片段。没有预设供应商或模型。
4. **生成本地比较结果**在浏览器内运行原代码，不发送请求。**发送图像并识别**才向所填接口发送一次请求。识别不会直接应用。
5. 左右预览本地和 AI 结果。在顶部统一确认型号后，在 AI 栏的“本图要标注的型号条带”中勾选大小，默认全选；改变勾选会自动将大小从大到小对应到位置从上到下，不必逐条选择。少的位置保留空项，多的位置不显示，并提示识别数与已选数。下方逐条位置、大小和“显示”控件只供微调；其中取消显示仅隐藏数字，仍保留校准。已有项目的配对在打开时保留，需要时点击“按所选大小重新配对”。高级文本编辑仍可展开，未知位置写 `?`。型号未确定时先确认型号，不会自动选择候选的第一个。
6. 点相应的 **应用这份结果**。有效应用后自动关闭比较窗口并返回主界面；手机切到成图。应用数量、未确定项和保护跳过数量在主界面提示。无效或过期结果保留错误提示，不关闭窗口。默认保留人工指定泳道/型号、手动条带、排除的 Marker 和已剪除泳道。只有主动勾选 **允许覆盖…** 才能替换这些选择。未保护的旧 Marker 在该结果范围内被替换；本地范围是当前红框，AI 范围是整图。应用支持一次撤销。
7. 选择应用后的两份草稿仍可比较切换。其他项目编辑、旋转、透视、撤销/重做、换图或恢复项目后，旧草稿停止应用，需重新生成。比较草稿不写入项目、不跨页面会话恢复。
8. 最终选好结果后照常保存 `.gelfig` 或导出 PNG / TIFF / SVG / PPTX。人工修订沿用原识别来源，同时记录已人工编辑；本地结果不会因为再次编辑被标为 AI。项目保存最终采用的 Marker、未确定条带及最小来源记录（本地/AI、时间、协议版本、是否人工编辑）；即使采用空结果也记录来源。使用过比较应用的项目文件与本地历史不保存含旧识别的导入时重置快照，重新打开后的“全部重置”以保存的采用状态为基准；当前页面的撤销链不受影响。

已采用的 AI 条带使用固定坐标。Marker 卡片显示来源；**编辑坐标 / 未确定条带**可重新打开人工编辑。原有参考图仍可手动指定大小和位置。AI 条带的“本地识别/重新匹配”按钮停用，旋转仅做坐标变换，框内重新识别保留固定结果。改用本地算法请在比较窗口明确生成并应用本地结果。切换 DNA / 蛋白类型时，AI 位置保留为未确定大小，型号清为未确定，不拿另一类库自动猜测。四点重新校正及 90° 转向沿用原版的显式重新识别/重置语义；原始图像和撤销保留。

## 上传内容与隐私

- 仅主动点击发送识别时上传：当前透视校正、方向和旋转后的**完整分析图副本**，编码为 PNG；有原色时保留原色，不随灰度显示模式丢掉颜色。灰度图使用未做显示对比度/反相的灰度分析数据。发送图像不受出图红框裁切，不包含界面和已有标注。
- 同时发送顶部所选型号的目录条目（ID、名称、大小、参考带）；未指定时发送当前 DNA 或蛋白胶的内置和自定义 Marker 型号目录。自定义型号名称也会发给所选服务；上传前请确认其中没有不希望外传的实验信息。
- 不附加原始文件字节、文件名、泳道名、分组、条件、项目或浏览器缓存。图像拍摄时已经存在的文字仍属于图像像素，无法自动删除。
- 密钥在 Authorization 请求头中发送，仅发给所填 HTTPS 接口。请求不携带浏览器 cookies、不附带 referrer、不跟随重定向；无重试，无自动更换服务、模型、代理或本地识别。
- 默认密钥仅留在当前页面内存。主动勾选记住后，密钥以明文保存在当前浏览器对该页面的独立 localStorage 项中；与项目、日志、图像导出及 Marker 库分开。可取消勾选或点 **清除密钥**。不支持持久存储时明确提示，并可继续本次使用。不同浏览器、文件路径和浏览器对 `file://` 的存储规则可能影响记忆范围。
- 页面 CSP 的 `connect-src` 允许 HTTPS，以支持用户自填 API。脚本和图像来源仍限制为本地资源；网络控制主要由应用显式识别入口实现。加载、导入、旋转、预览、应用、撤销、项目恢复及导出均不自动调用识图接口。原有文字反馈仍只在主动提交时发送。
- 所填 API 必须接受浏览器 CORS 及视觉 data URL；双击单文件通常使用 `Origin: null`。若服务拒绝此来源，请按服务方设置调整；页面不会引入转发服务器或切换线路。
- 90 秒超时、HTTP 错误、网络/CORS/证书/重定向错误、响应过大、JSON 无效、拒绝或截断、非法坐标/型号/条带均明确报错。服务端错误正文不回显，防止其回显密钥。未应用的识别不能改动项目。
- 完整上传 PNG 限 32 MB；接口响应限 2 MB。不会暗中缩图；超过限制请换较小的输入。视觉模型自身可能缩放图像，因此坐标误差仍需人工核对。

## 协议与校验

请求使用标准 Chat Completions `messages`，文本和 `image_url` 多模态内容，`stream: false`。不绑定具体服务或模型，不使用厂商 SDK。接口兼容性由用户实际服务决定。协议结构参考 [OpenAI Chat Completions 官方说明](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。

要求助手返回 JSON（可包在单个 JSON 代码块中）：

```json
{
  "schema_version": 1,
  "gel_type": "dna",
  "image": {"width": 1000, "height": 700},
  "markers": [{
    "x": 0.08,
    "ladder_id": null,
    "candidates": [{"id": "neb1kb", "confidence": 0.6}],
    "bands": [{"y": 0.25, "size": null}, {"y": null, "size": null}]
  }]
}
```

坐标为整张上传图的 0–1 归一化坐标，本地按 `x*(width-1)` 和 `y*(height-1)` 映射回像素。未确定用 JSON `null`，不转换为 0。仅接受请求时同类型目录中的型号和大小；检查尺寸、数字类型、范围、重复和迁移顺序。多个候选保持多个候选，无法确定的型号不自动选第一个。需要同时已知位置和库内大小才参与后续大小估算。后续估算复用原代码的对数插值/外推。

AI 坐标不进入本地峰值匹配器。手工修订也不会触发本地补峰。无已知校准点的 Marker 不参与大小估算；局部峰检测没有权力把 AI 的未知条带补成已知。

## 开发验证

```text
node scripts/check-updates.mjs
node scripts/bundle-onefile.mjs
node tests/check-ai-marker.mjs chromium firefox webkit
node tests/check-ai-band-controls.mjs chromium firefox webkit
npm test
```

测试依赖 Node.js 22+ 与 Playwright 三浏览器；网页运行本身无依赖。合成图与本地拦截的模拟响应只验证请求、错误、状态、坐标、保护、映射、撤销、恢复、密钥隔离和离线运行，不证明真实胶图识别准确率，也不证明某个第三方 API 可连通。实际运行记录见交付中的验证说明与原始日志。

## English summary

This local-only trial adds optional, user-configured HTTPS Chat Completions vision recognition to the four-corner GelFigure fork. DNA and protein catalogues include built-in and custom models. An explicit click sends one complete, geometrically processed analysis-image PNG (original RGB when available), without UI or annotations. Failure is explicit; no retry, service/model/proxy switch or automatic local recognition occurs.

Local and AI drafts remain session-only, with preview, editable lane mapping/new lanes, model choice and band coordinates. Unknown models and unlocated positions remain unknown. For a chosen model, selected sizes pair sequentially; mismatches are warned, missing positions stay null and surplus positions stay hidden. AI coordinates never run through local peak matching. Applying preserves manual confirmations by default, supports explicit overwrite and undo, and remaps lane metadata consistently. Stale requests/results cannot change a changed project. Projects keep adopted results and minimal provenance only. Keys are separate; remembering them in browser plaintext storage is opt-in and reversible. CORS (often null origin for a local HTML) must be supported by the configured API. Tests use synthetic data and mocked responses, with no claims of recognition accuracy or real-service connectivity.
