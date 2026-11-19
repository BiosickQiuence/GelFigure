/* Short bilingual release summaries, newest first. Keep the first version equal to App.VERSION.
 * Detailed history lives in CHANGELOG.md; this small local catalogue also works in offline HTML. */
window.GelFigureReleases = Object.freeze([
  {version:'1.5.0',date:'2026-11-20',zh:[
    '新增样本表（支持直接从 Excel 复制 TSV 或上传 .csv，按列映射泳道名、分组横线与 +/- 条件行并实时预览）以及历史泳道名自动补全。',
    '右侧待核对清单底部新增「复制图注」，一键生成并复制中/英文投稿图注草稿。',
    '历史项目弹窗新增按项目名/文件名/泳道名搜索与按日期分组（今天 / 昨天 / 本周 / 更早）；新增多图串行批量处理（执行前明示 AI N×2 次调用，支持逐张清单核对与统一套用版式打包 ZIP）。'
  ],en:[
    'Add Sample Table (Excel TSV paste or .csv import with column mapping for lane names, groups, and +/- condition rows) plus historical lane-name autocomplete.',
    'Add one-click “Copy legend” in the Review Checklist footer with ZH / EN toggle.',
    'Add search and date grouping (Today / Yesterday / This week / Earlier) to Recent Projects, plus sequential multi-gel Batch Processing with N×2 AI call disclosure, per-gel checklist review, and unified ZIP export.'
  ]},
  {version:'1.4.0',date:'2026-11-20',zh:[
    '成图为主画布与顶部视图切换：默认展示大图成图并支持一键切换「成图 / 原图（调泳道·裁切）」，进入校正步骤自动切回原图。',
    '左侧重构为 4 步手风琴面板（① 校正 ② Marker ③ 命名与标注 ④ 版式与导出）与底部「高级」折叠区，非当前步自动折叠为一行摘要。',
    '整合顶栏「AI 助手」与可搜索 Marker 组合框，重命名离线对比为「本地识别（离线）」；手机精简版上线 4 标签底栏与顶部待核对摘要条。'
  ],en:[
    'Figure-first main stage with top segmented switcher (Figure / Raw image) that auto-switches to Raw during Step 1 correction.',
    'Left panel refactored into a 4-step mutually exclusive accordion (Correct / Marker / Names & Labels / Layout & Export) plus collapsible Advanced drawer.',
    'Unified AI Assistant modal with searchable Marker combobox, renamed local fallback to “Local detection (offline)”, and launched 4-tab Mobile Lite.'
  ]},
  {version:'1.3.0',date:'2026-11-20',zh:[
    '新增全屏欢迎页、4 步 API 配置向导与离线预录 AI 示例体验，无 Key 也可体验完整流程。',
    '支持每浏览器首次隐私同意、拖图即开始 AI 全自动与三步进度浮层，可随时切换本地处理或后台运行。',
    '新增右侧常驻待核对清单与画布紫色编号定位，以及 IndexedDB 结果缓存、自动重试 1 次、结构化报错修复卡片与 5 标签设置中心。'
  ],en:[
    'Add full-screen Welcome Page, 4-step API Setup Wizard, and offline pre-recorded AI Demo without needing a key.',
    'Add per-browser privacy consent, drop-to-start AI Auto-Flow with 3-step progress overlay, local fallback, and background mode.',
    'Add persistent Review Checklist with purple canvas badges, IndexedDB AI caching, 1x transient auto-retry, structured error repair cards, and tabbed Settings Center.'
  ]},
  {version:'1.2.0',date:'2026-11-20',zh:[
    '启用方案 C 牛津蓝与暗胶片画布视觉体系、3 杠金带品牌标志与全套 1.8px 矢量图标。',
    '精简顶栏并引入统一通知通道、交互式 5 步上手引导、可搜索帮助与 ? 快捷键面板。',
    '优化 DNA Marker 简写单位与三选项预览、统一泳道名计数文案，并引入设计令牌与类型检查工程脚手架。'
  ],en:[
    'Adopt the Oxford Blue visual system with dark gel canvas, 3-bar gold-band brand mark and 1.8px vector icon set.',
    'Slim down the top bar with a unified toast channel, interactive 5-step onboarding tour, searchable Help and ? shortcuts.',
    'Default DNA markers to kb shorthand with a 3-option preview, standardize lane-name counts and add token/typecheck tooling.'
  ]},
  {version:'1.1.1',date:'2026-11-20',zh:[
    '历史项目不记录示例图、按原图 SHA-256 合并重复项并显示缩略图。',
    '新增顶栏导出前检查状态角标；优化 AI 复核返回按钮与泳道名编辑条避让位置。',
    '补充详细视觉模型目录 docs/models.md，并将离线构建备份移至仓库外。'
  ],en:[
    'Project history skips demo gels, merges duplicate imports by SHA-256 and shows thumbnails.',
    'Add an always-visible export readiness badge, clearer AI review back button and non-overlapping lane name toolbar.',
    'Move full vision-model inventory into docs/models.md and keep single-file build backups outside the repository.'
  ]},
  {version:'1.1.0',date:'2026-11-19',zh:[
    '新增 AI 全自动处理，拖入胶图并选择 Marker 后即可完成泳道校正和条带标记。',
    '自动扩大偏小的四角，在原图内保留有带及不确定泳道，随后打开可编辑的成图。'
  ],en:[
    'Drop a gel and choose its marker model to run automatic lane correction and band labelling.',
    'Tight correction corners expand within the image to retain active and uncertain lanes before the figure opens for editing.'
  ]},
  {version:'1.0.0',date:'2026-11-17',zh:[
    '发布 AI 复核工作台、原色与胶类型规则、统一 Marker 型号选择及预览适配修正。',
    '提供中英双语 API 入门教程；移除网页更新历史和原赞助/反馈转发入口。',
    '保留本地编辑、项目恢复、四点校正和多格式导出。'
  ],en:[
    'AI review workspace, original appearance, colour-based gel typing, shared Marker selection and preview refitting.',
    'Beginner bilingual API tutorials; remove in-app release-history and legacy sponsorship/feedback forwarding.',
    'Local editing, project restoration, perspective correction and multi-format exports remain available.'
  ]},
  {version:'0.6.15',date:'2026-11-11',zh:[
    '改进桌面 Safari 的编辑高亮和控件显示，统一逐项字重菜单；支持直接粘贴胶图。',
    'Marker 面板可选逐条单位；新增可拖动的多行文本框、引导箭头和侧边文字自由旋转。',
    '修复泳道编号导出缺失，并改进可靠匹配后淡蛋白 Marker 条带的恢复。'
  ],en:[
    'Desktop Safari editing highlights and controls, consistent per-item font weights, and clipboard image paste.',
    'Inline marker units, draggable multiline text boxes with leader arrows, and freely rotated side text.',
    'Lane numbers survive export; faint protein-marker peaks can be recovered after a reliable ladder match.'
  ]},
  {version:'0.6.14',date:'2026-10-28',zh:[
    '新增整图方向：水平/垂直翻转、顺时针/逆时针 90°，导入后直接摆正。',
    '泳道名紧贴胶图，条件行在其上方；增加条件行不再把 Marker 名称推离图片。',
    '侧边文字可沿胶边任意移动；新增 Pierce 26610 蛋白 Ladder。'
  ],en:[
    'Whole-image orientation: mirror horizontally or vertically, turn 90° either way, right after import.',
    'Lane names now sit against the gel with condition rows above them, so a new row no longer pushes a marker label away.',
    'Side text can be placed anywhere along the gel edge; added the Pierce 26610 protein ladder.'
  ]},
  {version:'0.6.13',date:'2026-10-27',zh:[
    '文字、箭头、区域框和 Marker 支持标红，图片及可编辑 PPT 导出保留颜色。',
    '左侧“版式”与其他设置同级，图宽、换行和编号默认展开。',
    '新版首次打开提示本次更新，可随时查看历次更新日志。'
  ],en:[
    'Red text, arrows, region boxes and marker labels, preserved in image and editable PowerPoint exports.',
    'Layout is an expanded sidebar section with figure width, wrapping and numbering directly available.',
    'A one-time notice introduces each new version; release history is always available.'
  ]},
  {version:'0.6.12',date:'2026-10-26',zh:[
    '泳道名支持单独字号、角度，以及局部斜体、上标、下标。',
    '反馈与赞助有固定入口；可在工具内填写反馈，无需 GitHub 账号。',
    '修复隐藏 Marker 标签后箭头旁出现大间隙的问题。'
  ],en:[
    'Individual lane-name sizes and angles, plus selected-text italic, superscript and subscript.',
    'Permanent feedback and support entries, with an in-app feedback form requiring no GitHub account.',
    'Hidden marker labels no longer leave a large blank gap beside arrows.'
  ]},
  {version:'0.6.11',date:'2026-10-24',zh:[
    '修复较窄电脑窗口中顶部导出按钮偏移，始终靠右显示。',
    '泳道名可选自动角度，或通过预设、滑块和数字调节 0–90°。'
  ],en:[
    'Desktop export controls stay at the upper right in narrower windows.',
    'Lane-name angles support automatic layout, presets and a 0–90° slider or numeric input.'
  ]},
  {version:'0.6.10',date:'2026-10-23',zh:[
    '泳道默认等距联动，拖首尾线即可对齐；裁切框内可一起重新识别泳道和 Marker。',
    'Marker 图例与编辑面板更紧凑，可拖动移开；双击已有 Marker 泳道即可编辑。',
    '自定义 Marker 和收藏独立缓存，可备份迁移；新图默认灰度，仍可切换原色。'
  ],en:[
    'Linked lane spacing, endpoint alignment and combined lane/marker re-detection inside the crop.',
    'Compact, movable marker references and editors; double-click an existing marker lane to edit.',
    'Persistent custom-marker libraries with backup/import; grayscale imports with optional original colour.'
  ]},
  {version:'0.6.9',date:'2026-10-23',zh:[
    '新增本机历史项目，自动保存原图、标注和全部曝光。',
    '可恢复、改名或删除历史；缓存失败时提示另存项目文件。'
  ],en:[
    'Local project history automatically caches original images, annotations and all exposures.',
    'Restore, rename or delete projects; storage failures prompt a project-file backup.'
  ]},
  {version:'0.6.8',date:'2026-10-22',zh:[
    '支持保留蛋白胶和彩色 Marker 的原色，彩色图片和 PPT 同步导出。',
    '新增 Arial、新罗马等五种系统字体，无需下载字体文件。',
    'bp／kDa 单位固定在胶图侧边上沿，条件行布局更紧凑。'
  ],en:[
    'Original-colour gels and markers, retained in image and PowerPoint exports.',
    'Five system fonts including Arial and Times New Roman, with no font downloads.',
    'Compact bp/kDa headings stay beside the gel instead of moving above condition rows.'
  ]},
  {version:'0.6.7',date:'2026-10-22',zh:[
    '新增 PowerPoint 导出，文字、箭头、方框等保持可编辑。',
    '打开即呈现当前成图，并保留可在 PPT 内重新调整的图片裁切。'
  ],en:[
    'PowerPoint export keeps text, arrows and other annotations editable.',
    'Slides open as the finished figure while preserving adjustable native image crops.'
  ]},
  {version:'0.6.6',date:'2026-10-22',zh:[
    '支持调色板 TIFF，兼容索引灰度、伪彩色和染色胶扫描图。',
    '支持 1／2／4 位存储，导入时说明所做的转换。'
  ],en:[
    'Palette TIFF support covers indexed grayscale, false-colour and stained-gel scans.',
    'Packed 1/2/4-bit input is supported, with conversion notes shown on import.'
  ]},
  {version:'0.6.5',date:'2026-10-22',zh:[
    '分组文字自动换行或错层，也可选择缩小字号、保持一行。',
    '支持手动换行，每条标注可单独设字号；导出前检查实际最小字号。'
  ],en:[
    'Group labels wrap or move up a tier to avoid overlap, with shrink and single-line options.',
    'Manual line breaks, per-annotation sizes and minimum-font checks before export.'
  ]},
  {version:'0.6.4',date:'2026-10-22',zh:[
    '重做手机操作：底部切换原图、成图、设置，导出提供全部格式和分辨率。',
    '支持长按存图、系统分享和触屏编辑，并改进离线版下载指引。'
  ],en:[
    'Reworked phone navigation, with Image/Figure/Settings tabs and all export formats/resolutions.',
    'Long-press image saving, system sharing, touch editing and clearer offline-download guidance.'
  ]},
  {version:'0.6.3',date:'2026-10-21',zh:[
    '新增单文件 HTML 离线版，下载后双击即可使用。',
    '修复手机顶栏内容显示不全的问题。'
  ],en:[
    'A single HTML download runs offline by double-clicking, with no installation or extraction.',
    'Phone top-bar controls no longer overflow the screen.'
  ]},
  {version:'0.6.2',date:'2026-10-21',zh:[
    '新增手机单列布局，原图、成图和设置分为三个页签。',
    '支持触屏裁切、泳道调整和标注编辑。'
  ],en:[
    'Responsive single-column phone layout with separate Image, Figure and Settings tabs.',
    'Touch controls for cropping, lane alignment and annotations.'
  ]},
  {version:'0.6.1',date:'2026-10-20',zh:[
    '改进纯化胶、裂解液胶上的 Marker 判断，减少额外误识别。',
    '修复撤销、图注提示、处理记录和 TIFF 兼容性问题。'
  ],en:[
    'Improved marker identification on purification and lysate gels reduces false extra markers.',
    'Fixes for undo, legend hints, processing logs and TIFF compatibility.'
  ]},
  {version:'0.6.0',date:'2026-10-20',zh:[
    '新增独立蛋白胶模式，自动判断胶种并切换 bp／kDa，可手动纠正。',
    '内置 41 种蛋白 Marker，新增区域框、放大图、括号与侧边文字。',
    '改进泳道对齐、反色和 Marker 收藏、显示操作。'
  ],en:[
    'Protein-gel mode with automatic gel-type and bp/kDa selection, plus a manual override.',
    '41 protein ladders, region boxes, zoom insets, side brackets and side text.',
    'Improved lane alignment, inversion and marker favourites/visibility controls.'
  ]},
  {version:'0.5.0',date:'2026-10-19',zh:[
    '首个开源版本：DNA 胶自动转正、裁切、识别泳道和 Marker。',
    '支持直接编辑标注及图片、矢量图导出；图像全程本地处理。'
  ],en:[
    'First public release: automatic DNA-gel straightening, cropping, lanes and ladder labels.',
    'Direct annotation editing and image/vector exports, with local image processing.'
  ]}
]);
