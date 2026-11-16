# 四点透视校正 / Four-point perspective correction

用于把斜拍的平面胶图拉正为矩形。所有图像处理在本地浏览器内完成。

1. 导入胶图后，在「泳道对齐」区点击「四点透视校正」。手机端从「设置」进入，随后自动切换到「原图」。
2. 拖动四角：1 左上、2 右上、3 右下、4 左下，让四边贴合胶图的平面边界。角点可独立移动；不要交叉或组成凹四边形。
3. 滚轮或双指缩放，拖空白处平移。网格用于观察校正后的方向。
4. 点击「应用校正」，核对确认提示。原来的泳道名、标注、分组、条件和剪除设置会清空，重新识别泳道与 Marker，因此建议先校正再命名。对比度、显示模式、胶类型和版式保留。
5. 检查识别结果，再像平时一样拖红框裁切、命名、标注和导出。`Ctrl/⌘+Z` 撤销整次校正，重做可恢复。取消或 `Esc` 不改变图像和项目。

原始文件字节保留在项目中，可单独导出。项目文件和本地历史保存原始图上的四点及输出尺寸。再次校正仍从原始数据取样；不会对上次校正的结果重复插值。灰度保持 Float32 精度，原色显示使用相同几何。

输出宽度取上下两边的较长者，高度取左右两边的较长者，四舍五入后加一个像素；没有物理尺寸或相机标定信息时，不声称恢复真实长宽比。输出图不包含四边形外的像素。「未裁切图」导出的是校正后、当前矩形裁切之前的图像；完整拍摄范围请用「原始数据」导出。

处理日志记录原始四点、原始尺寸、输出尺寸和双线性插值，图注提示说明用了透视变换。校正是几何重采样，会改变局部尺度与像素强度；定量分析应使用原始数据，并遵循实验记录要求。该功能矫正平面透视，不能修复弯曲胶面或镜头畸变。

## English

Use **Lane alignment → Four-point perspective correction**. Drag corners 1–4 in top-left, top-right, bottom-right, bottom-left order. Zoom with the wheel/pinch and pan away from the handles, then apply. The confirmation explains that names, annotations, groups, conditions and lane removals are cleared before lane/marker re-detection. Correct the image before annotating it. Undo restores the complete prior state; Cancel/Escape leaves the project untouched.

The saved transform maps directly to decoded-source pixels. Float32 grayscale and RGB use the same projective geometry with bilinear interpolation; repeated corrections sample the original rather than an already corrected raster. Original bytes, undo/redo, projects, local history and same-size exposure changes retain their intended roles. The processing log and legend disclose rectification. “Uncropped image” means the corrected image before the ordinary rectangular crop; export “Original data” for the complete photograph.

Output width/height use the longer opposing edge lengths, rounded plus one pixel. A photograph without known dimensions/calibration cannot establish the physical aspect ratio. This is planar perspective correction, not lens or curved-surface correction. Use original data for quantitative analysis.

Validation uses synthetic gels and analytic image ramps; mobile interaction is tested in emulated viewports, not on physical phones.
