# 本地启动器（tools/）

前端已改为原生 ES 模块，直接用 `file://` 双击 `dist/index.html` 会被 CORS 拦住，必须经 HTTP 访问。本目录提供两种零 Node 依赖的启动方式，另加一个可选的 exe 打包脚本。

官方入口仍是 `pnpm start`（`scripts/serve.cjs`，需要 Node 22 + pnpm）；本启动器提供同一份静态内容，用于没装 Node 或只想双击查看的场合。

## 文件

| 文件 | 作用 |
|---|---|
| `launcher.py` | 标准库实现，无第三方依赖：起只读静态服务、选端口、开浏览器、`--self-test` 自检 |
| `start-windows.bat` | 双击入口；按 `python` → `py -3` → `E:\python\python.exe` 顺序探测可用解释器 |
| `build_exe.ps1` | 可选：用 PyInstaller 打成内嵌 `dist/` 的 Windows 单文件 exe |

## 用法

```bat
start-windows.bat                 :: 真实数据快照  /
start-windows.bat --demo          :: 合成样品      /?demo=1
start-windows.bat --pending       :: 接入等待      /?mode=pending
start-windows.bat --port 8080     :: 换起始端口（被占用自动 +1 顺延）
start-windows.bat --no-browser    :: 只起服务，不开浏览器
start-windows.bat --self-test     :: 跑 10 项接口自检后退出
```

`launcher.py` 默认数据目录为 `<仓库根>/dist`，可用 `--root` 指向别处：

```bat
python tools\launcher.py --root "D:\china-forest-cover-lab\dist"
```

## 行为约定

- 只监听 `127.0.0.1`，局域网其它机器访问不到；改地址需显式 `--host`。
- 起始端口默认 3000，被占用则在后续 19 个端口内顺延，并在控制台打印实际端口。
- 路径含 `..`（包括 `%2e%2e` 编码）一律 404，不会越出 `dist`。
- 响应带 `Cache-Control: no-store`，数据更新后强刷即生效。
- 缺 `index.html` 退出码 2；端口耗尽退出码 3；缺 `real-data.js` 不阻断，页面回落到接入等待态。

## 密钥接口（仅本地）

起点是“静态站点不能保存凭据”：DPAPI 加密缓存只能由本机 Python 读写，所以密钥入口只存在于本启动器。页面顶部密钥条由 `dist/auth-panel.js` 渲染，静态托管下拿不到接口就整条隐藏。

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/auth/status` | — | `{"state":"valid\|expired\|none\|unavailable","expires_at","remaining_days","verified_at"}` |
| POST | `/api/auth/login` | `{"username","password"}` | 同 status；密码只用于换取 AppEEARS 令牌 |
| POST | `/api/auth/token` | `{"token","expiration"?}` | 同 status；非 JWT 必须显式给到期时间 |

约束：

- `Origin`/`Referer` 存在时，主机必须是 `127.0.0.1`、`localhost` 或 `::1`，否则 403；请求体上限 8 KB，解析失败返回 400。
- 令牌写入 `integrations/appeears/.secrets/appeears.dpapi`（当前 Windows 用户 DPAPI），密码不落盘、不写日志。
- 非 Windows 或缓存损坏时返回 `unavailable`/`none`，前端据此隐藏或提示登录，不回退明文。
- `.secrets/` 已在 `.gitignore` 中；`--self-test` 会用 `/api/auth/status` 断言 200 + `application/json`（无凭据时返回 `none`，同样计入通过）。

## 打包 exe（可选）

前置：`python -m pip install pyinstaller`（约 30 MB）。然后在仓库根执行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\build_exe.ps1
```

产物：`tools/release/china-forest-cover-lab-launcher.exe`，约 25–30 MB，内嵌 `dist/` 全部文件，双击或命令行运行均可，参数与 `launcher.py` 相同。更新 `dist/` 后必须重新打包；`tools/build/` 与 `tools/release/` 已在 `.gitignore` 中，不入库。

## 与 CI 的关系

`check:format` 只检查 `dist/*`、`tests/*.cjs`、`qa.cjs`、`scripts/*.cjs`、`playwright.config.cjs`；`unittest discover` 只扫 `integrations/appeears`。本目录不参与这两条门禁，也不需要改动 `package.json`。
