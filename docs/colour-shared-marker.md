# 原色与统一 Marker 选择 / Original appearance and shared Marker model

本地 build：`colour-shared-marker-20261117`。在 2026-11-17 复核工作台交付上修改，基础版本仍为 v0.6.15；未推送或发布上游。

## 胶类型与显示

- 新图的可靠蓝色采样占比达到 0.5% 即按蛋白胶处理，用 kDa 和蛋白 Marker 库；黑白图按 DNA 胶处理，用 bp 和 DNA Marker 库。颜色规则先于泳道识别，不会被条带形状、收藏或后续迁移曲线改判。0.5% 阈值用于避免孤立蓝色噪点触发；非蓝色的其他彩图沿用既有判断。仍可手动指定类型。
- 所有新导入和新曝光组默认“保留原色”。有 RGB 时显示原色；纯黑白源保持原始明暗，不应用灰度色阶、反色、Gamma。灰度分析继续供泳道和条带检测使用，不改写源像素。
- 手动选“灰度”后可调整色阶和反色。已保存项目、历史和显式应用的模板恢复它们保存的模式；旧项目没有模式字段时沿用灰度兼容行为。实验室默认版式不会把新图改回灰度。
- 原始文件字节保留。原色显示仍沿用原有自动裁切、去倾斜和可选透视几何；处理日志区分 `original-colour`、`original-grayscale` 与 `grayscale`。

## Marker 工作区

1. 在标题下方、识别按钮上方的“Marker 型号（本地 / AI 共用）”选一次型号，当前图的 Marker 泳道共同使用它。
2. “生成本地比较结果”将本地算法的候选和匹配限制到该型号；“发送图像并识别”只发送该型号目录，不再要求两栏分别选择。
3. 未指定时可先识别，结果行显示识别得到的型号名；需要统一修改时回到顶部选择。结果行保留逐带大小、坐标、显示和勾选顺序配对，去掉重复的型号下拉框。
4. 改选型号会取消当前请求、重新生成已有本地草稿，并按新型号重配 AI 大小；AI 已知 Y 坐标保持不动。此操作只更新比较草稿，不应用到主图，也不发送新的 API 请求。
5. 应用、覆盖保护、缺失/多余条带提示、单步撤销、导出和项目恢复沿用复核工作台规则。型号选择留在当前比较会话；最终采用的型号随项目保存。

## 验证

新增 `tests/colour-marker.mjs` 覆盖颜色优先级、RGB/黑白原始显示像素、灰度主动切换、默认版式、新旧项目语义、统一型号对本地匹配及 AI 目录的约束、坐标不变、请求取消、采用/撤销和手机中英界面，并集成 `npm test`。旧版的相关故障已通过同一专项复现。实际运行结果见本次交付的验证说明与原始日志。

测试使用合成图和拦截的 HTTPS 响应；没有真实视觉服务调用或真实胶图识别准确率评估。颜色规则是本次用户指定的分类规则，不能用于证明生物学类型；例如黑白蛋白胶需要手动切到蛋白胶。手机验证为模拟视口，PPTX 沿用结构检查。

## English

New imports retain original source colours/tones. Sufficient sampled blue (0.5%) decides protein; monochrome decides DNA before lane discovery. Other coloured images keep the existing rules. Manual type selection remains available. Original grayscale uses identity display levels without inventing RGB or changing analysis precision. Saved explicit display choices retain their meaning.

One model selector above both recognition buttons is shared by local detection and AI. A chosen model restricts local catalogue scoring and the AI request/validation catalogue. Changing it cancels a pending request, updates drafts and re-pairs AI sizes without changing known Y positions or sending another request. Result rows show read-only model names, with independent per-band size/position/visibility controls. This is an independent local build, not an upstream release.
