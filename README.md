# 中国森林遥感调查

基于 NASA AppEEARS 的森林类面积调查学习项目，包含可视化网页和 Python 数据处理程序。

- 网页：https://china-forest-cover-lab.lushchub35.chatgpt.site/
- 真实模式：2025年森林类分布、全国研究范围统计、质量筛选及JSON导出。
- 样品模式：在网址后添加 ?demo=1；数值是明确标注的合成数据。
- 历史任务：2001—2024年已提交，尚未在当前发布快照中形成完整年度序列。

## 项目结构

- dist/：可直接打开的静态网页和已发布的非敏感数据快照。
- integrations/appeears/：认证、提交、下载校验、质量筛选、面积统计和地图导出程序。
- integrations/appeears/boundaries/：版本固定的研究边界及来源记录。
- qa.cjs：浏览器交互、桌面与手机布局检查。
- scripts/：GitHub同步和凭据检查。
- CHANGELOG.md：主要更新说明，详细变更见Git提交历史。

## 本地使用

直接打开 dist/index.html 查看网页。数据处理需要Python及依赖：

    python -m venv integrations/appeears/.venv
    integrations/appeears/.venv/Scripts/python.exe -m pip install -r integrations/appeears/requirements.txt

本地认证由 integrations/appeears/appeears.py connect 完成；当前凭据保存使用Windows DPAPI。不要把密码或令牌写入源文件。详细处理命令见 integrations/appeears/README.md。

## 统计口径与局限

将MCD12Q1.061的LC_Type1 1—5类定义为森林类。主指标分母是研究范围内通过质量筛选的有效分类面积，包含水体。2025年这一比例约12.35%，有效数据覆盖约99.92%；前者不是官方森林覆盖率，后者不是分类准确率。

面积在原生MODIS等面积投影中计算。geoBoundaries概化研究边界并非官方完整国土边界，未充分表示狭小岛屿及南海岛礁。年度分类差异不能直接判定真实森林增减；2026年完整年度数据未接入。

来源：NASA MCD12Q1.061（https://doi.org/10.5067/MODIS/MCD12Q1.061）；geoBoundaries/Wikimedia Commons（来源标注Public Domain，详见边界元数据）；DataV省界仅作网页定位，不参与面积统计。第三方数据沿用各自来源许可。

## 每次更新的记录规则

本仓库保留既有网页历史。后续每次项目更新都应补充说明，完成相应检查，再提交并推送GitHub；GitHub上传与Sites网页发布是两个独立步骤。

当前工作区中，Sites源码在 ../outputs/forest-cover-demo，运行中的数据程序在 ../integrations/appeears。本仓库的同步入口为：

    ./scripts/Sync-and-push.ps1 -Message '说明本次改动与验证'

该脚本按允许名单复制文件、检查凭据、提交并推送；不是后台自动监听服务。删除文件时也应同步删除仓库对应文件。独立克隆本仓库时可以直接编辑、git add、git commit和git push，无需该工作区专用同步脚本。

排除项：账户令牌、加密凭据、环境变量文件、浏览器配置、虚拟环境、原始栅格下载与runtime缓存。已公开展示的统计及地图快照可跟随版本记录。
