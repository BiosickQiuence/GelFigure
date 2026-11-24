# GelFigure v2.0.1 入门

打开 https://biosickqiuence.github.io/GelFigure/，或在 https://github.com/BiosickQiuence/GelFigure/releases/tag/v2.0.1 下载 `GelFigure-v2.0.1.html`，双击使用。普通本地整理无需 API，无需安装开发工具。

导入胶图 → 核对类型/方向 → 校正裁切与泳道 → 确认 Marker 与逐条配对 → 填名称与标注 → 保存 `.gelfig` 并导出。

需要 AI 时，请按 [README 的完整 API 配置教程](../README.zh-CN.md#api-setup) 从同一家平台取得 HTTPS 兼容基址、视觉模型 ID 和 API Key，再在右上角设置中填入。先用允许上传的图测试，识别后人工复核再应用。

使用 **AI 全自动处理** 时，先保存 API 配置并打开全自动页面。拖入一张胶图，选择所用的 Marker 型号。程序先发送输入图进行泳道校正，再发送校正图进行 Marker 标记，随后打开可编辑的成图。
