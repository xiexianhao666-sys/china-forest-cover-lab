# 中国森林遥感调查

基于NASA AppEEARS的森林类面积调查学习项目。本仓库是唯一开发源，可独立克隆、运行和测试，不依赖任何相邻工作目录。

网页：https://china-forest-cover-lab.lushchub35.chatgpt.site/

## 启动网页

安装Node.js 24、pnpm 11.25.0，然后在仓库根目录运行：

    pnpm install --frozen-lockfile
    pnpm start

访问终端显示的本地地址（默认 http://127.0.0.1:3000）。ES模块通过HTTP加载，不再支持直接双击HTML。可通过PORT环境变量选择端口。

- 默认：展示已发布的真实数据；没有数据时进入待接入模式。
- ?demo=1：合成样品，明确标注非真实值。
- ?mode=pending：检查待接入界面，不触发账户请求。

没有Node时可用零依赖启动器（仅标准库）：双击 `tools/start-windows.bat`，或运行 `python tools\launcher.py`。默认打开真实数据快照，支持 `--demo`、`--pending`、`--port`、`--root`、`--no-browser`、`--self-test`；可选打成内嵌 `dist/` 的单文件exe，见 tools/README.md。

只有这个本地启动器会提供 AppEEARS 密钥入口：页面顶部显示密钥剩余天数，点「登录」输入 Earthdata 账号或直接粘贴令牌，令牌由当前 Windows 用户 DPAPI 加密保存。线上静态站点没有 `/api/auth/*`，密钥条自动隐藏，页面本身不接触任何凭据。接口与安全约束见 tools/README.md。

## 测试与持续集成

    pnpm exec playwright install chromium
    pnpm test
    pnpm run check:format

兼容入口 node qa.cjs 调用同一套测试。Playwright管理浏览器、独立会话和临时HTTP端口；可选BROWSER_PATH环境变量指定本机浏览器。测试覆盖三种模式、重复切换与计时器清理、下载、桌面/手机布局、接口失败及减少动态效果。

GitHub Actions在push和PR时运行网页与Python测试，保存失败截图及trace，不需要NASA认证。依赖由pnpm-lock.yaml锁定。

## Python程序

    python -m venv integrations/appeears/.venv
    integrations/appeears/.venv/Scripts/python.exe -m pip install -r integrations/appeears/requirements.txt
    integrations/appeears/.venv/Scripts/python.exe -m unittest discover -s integrations/appeears -p "test_*.py"

上述激活路径适用于Windows；Linux/macOS使用.venv/bin/python。栅格统计支持这些平台，当前DPAPI凭据缓存仅支持Windows，其加密测试在其他平台跳过。AppEEARS认证、下载和统计命令见 integrations/appeears/README.md。

账户凭据和原始下载不随Git仓库迁移；已有发布快照可直接查看，重新运行提取需在本机配置认证。

## 结构与模式边界

- dist/app.js：唯一入口，选择并挂载demo、pending或real模式；切换时清理旧上下文。
- dist/demo-view.js、api-mode.js、real-view.js：各自负责一种模式，互不调用。
- dist/ui.js、map.js、catalog.js：共享组件、事件/计时器生命周期和几何底图。
- dist/style.css：可读样式源文件，规则顺序保留；pnpm run format统一格式。
- integrations/appeears/：API客户端、质量筛选、面积统计和快照导出。
- boundaries/region-names.json（位于上述目录内）：以固定shapeID映射省级代码、规范名称，同时保留原始标签。原始边界不修改。

## 数据口径

已接入2001—2025年全国及34个省级单元的真实分类统计。年度趋势、区域比较、两期空间对比和独立饼图同时保留；年份和区域选择联动全部分析。页面为已发布快照，不会自动从本机后台刷新。

MCD12Q1.061的LC_Type1 1—5类计为森林类，分母为通过质量筛选的有效分类面积（包含水体）。研究范围内2025年约12.35%，数据完整性约99.92%；前者不是官方森林覆盖率，后者不是分类准确率。面积在原生等面积投影中计算。

概化研究边界未充分表示狭小岛屿及南海岛礁。年度分类差异不能直接证明真实森林增减；2026年完整年度数据未接入。NASA、geoBoundaries及DataV的来源与许可说明保留在数据元信息中。

## 提交与发布

    ./scripts/Sync-and-push.ps1 -Message '描述本次修改及验证'

该命令仅检查并提交当前仓库，推送到GitHub；不会从外部目录复制文件，也不会部署Sites。已运行同样检查时可使用-SkipTests避免重复测试。

Sites发布另按其工具流程执行：打开发布仓库，将本仓库的dist及同一站点hosting配置作为单向发布输入，再同步、打包、部署并核对结果。GitHub开发目录与Sites发布目录用途不同；发布目录不是开发源。

每次更新记录于Git及CHANGELOG.md。凭据、虚拟环境、原始栅格、runtime和浏览器测试缓存不上传。
