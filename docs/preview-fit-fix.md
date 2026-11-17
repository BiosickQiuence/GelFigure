# AI Marker 返回后的成图预览缩小修正

本地 build：`preview-refit-20261117`，基于 `colour-shared-marker-20261117`；基础版本仍为 v0.6.15。

## 问题与修正

应用 AI Marker 后返回主界面，右侧成图预览可能保持很小；重新选择一次 DPI 会恢复。合成回归示例中，原版应用后只有约 78 × 134 像素，重新选择相同 DPI 后为约 470 × 810 像素，项目和导出几何并没有变化。

原因是工作区使用 `.ai-active #stage { display:none }` 隐藏主编辑区。应用结果触发 `App.commit()`，`UI.updatePreview()` 读到零尺寸容器，使用最小缩放。旧的 `AIWorkspace.close()` 只重新适配原图画布，没有更新右侧成图，所以直到 DPI 控件触发下一次刷新才恢复。

修正在共用关闭入口中完成：先显示主编辑区，再调用已有 `UI.updatePreview()` 按当前可见尺寸适配成图。无需重选 DPI，不增加超时或模拟控件操作。Marker、本地比较和 AI 布局的返回及 Escape 共用这一修正。DPI、预览缩放、Marker 坐标、项目历史及导出几何沿用原有设置。

## 验证

新增 `tests/preview-fit.mjs`，用合成图和拦截的 HTTPS 结果覆盖八项：正常 AI 识别/应用、空 AI 结果、本地结果、隐藏状态刷新后关闭、改变窗口尺寸后 Escape、保留预览缩放和 DPI、布局工作区关闭，以及页面错误/请求检查。

核心断言比较“返回后立即显示的尺寸”和“用户重新选择相同 DPI 后的尺寸”，应小于 1 像素差异；同时检查项目快照和导出 SVG 完全一致。该专项在修复前能复现缩小问题，修复后在 Chromium / Firefox / WebKit 通过，并集成完整回归。实际测试记录与截图见交付中的“验证材料”。

测试不调用真实视觉服务；此处验证界面尺寸与状态恢复，不评估识别准确率。前一版原色显示、颜色判断和顶部统一 Marker 型号选择继续保留。

## English

Review hides the main stage. Applying a result commits while the preview container has zero bounds, leaving the SVG at its minimum display scale. The shared close path now reveals the stage and then refits the figure with the existing preview function. No DPI or model changes are required. The regression compares immediate post-return dimensions with dimensions after reselecting the same DPI, while verifying identical project state and export SVG. Synthetic images and intercepted HTTPS results cover normal/empty/local results, Close/Escape, window resizing, retained zoom/DPI and layout review in all three browser engines.
