# AppEEARS 全国森林类面积统计

已跑通认证、任务提交、下载、SHA-256校验、质量筛选、等面积统计和网页快照导出。2001—2025年全国结果位于 runtime/national-年份.json，省级结果位于 runtime/regions。网页发布快照提供25个真实年度；2026完整年度尚未接入。

## 连接

短期令牌由Windows当前用户DPAPI加密保存在 .secrets/appeears.dpapi。密码不保存，令牌不进入网页。到期后在本机执行 python appeears.py connect；有效期内无需重新登录。

## 已提交任务（不要重复提交）

- 2025：07f981c3-2213-4306-98d0-126a5836cb39
- 2001—2024：dba4e581-9acf-43cc-9140-3d06fb764ce2

检查并处理历史任务，最多轮询10分钟：

    .venv/Scripts/python.exe process_task.py --task-id dba4e581-9acf-43cc-9140-3d06fb764ce2 --year 2001 --end-year 2024 --wait-seconds 600

重复运行会复用已通过文件大小和SHA-256校验的下载。API重定向不转发账户Authorization。任务未完成时只记录状态，不产生虚假统计。

国家年度统计完成后，使用同一批LC_Type1与QC文件生成34个省级单元的年度序列：

    .venv/Scripts/python.exe summarize_regions.py

按固定shapeID/行政代码映射来源边界，每个单元继续使用原生等面积像元中心和相同QC规则。结果保存在runtime/regions，可断点续算；不重新提交NASA任务。网页导出会同时收录国家和省级序列，公开快照去除本机文件路径。

网页保留年度趋势、区域变化比较、两期空间对比，并新增独立饼图。排序和变化地图表示两个独立年度的分类占比差（百分点），没有进行共同有效像元下的逐像元增减归因；缺失或覆盖不足的结果不参与差值比较。

## 统计定义

MCD12Q1.061 的 LC_Type1 1—5类计为森林类。主指标分母为QC通过的有效分类面积（1—17类，含水体）。另存排除水体的土地分母结果及以固定范围为分母的观测下界。它不是官方森林覆盖率。

QC保留0、2、4、5、6、7、8、9；8和9单独记录。未分类、缺少水掩膜及填充值不计入有效分类。LW下载保存但不改变LC分类。有效分类面积覆盖不足99%时不输出主比例；这个覆盖率不是分类准确率。

面积在原生MODIS Sinusoidal等面积投影中按实际仿射行列式计算，像元边长约463.3米，不按标称500米平方估算。像元中心落在研究边界内才计数。部分瓦片和非原生投影会被拒绝。PNG近邻降采样仅用于显示。

边界为geoBoundaries版本9469f09的2019年CHN ADM1共34单元合并，来源和哈希见 boundaries/provenance.json。它是概化研究边界，不是官方完整国土边界；狭小岛屿和南海岛礁未充分表示。

年度分类差异不能直接判定真实森林增长或损失。未实现共同有效像元掩膜下的变化分析，未做独立精度验证。2026完整年度数据未接入。

## 网页快照

    .venv/Scripts/python.exe publish_snapshot.py

在此目录运行时，默认输出到当前仓库的dist，可用--site指定另一个仓库根目录。生成无凭据、无本地路径的JSON/JS快照及年度PNG。导出不等于发布，仍需Sites源码同步和部署。网页不访问本地令牌，也不会自动更新后台统计。旧合成样品仅在 ?demo=1 中展示。

## 测试

    .venv/Scripts/python.exe -W ignore -m unittest test_summarize_rasters test_download_task

覆盖面积分母、孔洞和边界掩膜、缺失值、QC、投影、部分瓦片、路径安全和损坏文件校验。网站目录 node qa.cjs 检查交互及桌面、手机布局。

独立克隆后需按仓库根目录README安装依赖：rasterio、numpy、shapely、pyproj、requests。认证脚本仅依赖Python标准库。

来源：[NASA API](https://appeears.earthdatacloud.nasa.gov/api/)；[产品指南](https://lpdaac.usgs.gov/documents/1409/MCD12_User_Guide_V61.pdf)。
