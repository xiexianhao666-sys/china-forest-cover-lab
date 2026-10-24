#!/usr/bin/env python3
"""china-forest-cover-lab 本地启动器。

零依赖（仅标准库）：启动一个只读静态 HTTP 服务，把 dist/ 交给浏览器。
项目前端使用 ES 模块，直接双击 dist/index.html 无法加载脚本，
必须通过 HTTP 访问，本程序就是这一步的最薄实现。

用法：
    python launcher.py                     打开真实数据快照  /
    python launcher.py --demo              打开合成样品      /?demo=1
    python launcher.py --pending           打开接入等待      /?mode=pending
    python launcher.py --port 8080 --no-browser
    python launcher.py --root "D:\\GitHub\\china-forest-cover-lab\\dist"
    python launcher.py --self-test         只做自检，不开浏览器

退出码：0 正常；2 未找到 dist；3 端口耗尽。
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 3000
PORT_ATTEMPTS = 20
BROWSER_DELAY = 0.8

MIME_OVERRIDES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".geojson": "application/geo+json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
}

ENTRY_FILES = ("index.html",)
DATA_FILES = ("real-data.js", "national-statistics.json")

AUTH_ROOT = Path(__file__).resolve().parent.parent / "integrations" / "appeears"
AUTH_GET = "/api/auth/status"
AUTH_POST = ("/api/auth/login", "/api/auth/token")
LOCAL_ORIGINS = {"127.0.0.1", "localhost", "::1"}


def auth_modules():
    """按需加载 integrations/appeears 下的令牌存储与 API 客户端。"""
    if not AUTH_ROOT.is_dir():
        raise RuntimeError("未找到 integrations/appeears，无法读写本地令牌缓存。")
    if str(AUTH_ROOT) not in sys.path:
        sys.path.insert(0, str(AUTH_ROOT))
    import credential_store as store  # noqa: PLC0415 - 延迟导入避免影响静态模式
    import appeears as client  # noqa: PLC0415

    return store, client


def token_expiration(token: str) -> str | None:
    """从 JWT 的 exp 声明推出到期时间；非 JWT 返回 None。"""
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        exp = int(payload["exp"])
    except (ValueError, KeyError, TypeError):
        return None
    return datetime.fromtimestamp(exp, timezone.utc).isoformat()


def auth_state() -> dict:
    """返回密钥状态；只在当前 Windows 用户能解密时给出 valid/expired。"""
    if os.name != "nt":
        return {"state": "unavailable", "reason": "DPAPI 仅在 Windows 可用"}
    try:
        store, _ = auth_modules()
    except RuntimeError as error:
        return {"state": "unavailable", "reason": str(error)}
    if not store.CACHE.exists():
        return {"state": "none"}
    try:
        content = json.loads(store.crypt(store.CACHE.read_bytes(), decrypt=True))
        expires = store.parse_expiration(content["expiration"])
    except Exception:
        return {"state": "none"}
    now = datetime.now(timezone.utc)
    remaining = math.ceil((expires - now).total_seconds() / 86400)
    return {
        "state": "expired" if expires <= now else "valid",
        "expires_at": expires.isoformat(),
        "remaining_days": remaining,
        "verified_at": datetime.fromtimestamp(
            store.CACHE.stat().st_mtime, timezone.utc
        ).isoformat(),
    }


def log(message: str = "") -> None:
    sys.stdout.write(message + "\n")
    sys.stdout.flush()


def die(message: str, code: int) -> "NoReturn":  # noqa: F821 - 仅类型标注
    sys.stderr.write(message + "\n")
    sys.stderr.flush()
    raise SystemExit(code)


def candidate_roots(explicit: str | None) -> list[Path]:
    """按优先级列出可能的数据目录。"""
    if explicit:
        return [Path(explicit).expanduser()]
    here = Path(__file__).resolve().parent
    roots: list[Path] = []
    if getattr(sys, "frozen", False):
        bundle = getattr(sys, "_MEIPASS", None)
        if bundle:
            roots.append(Path(bundle) / "dist")
        roots.append(Path(sys.executable).resolve().parent / "dist")
    roots.append(here / "dist")
    roots.append(here.parent / "dist")
    return roots


def resolve_root(explicit: str | None) -> Path:
    tried: list[Path] = []
    for candidate in candidate_roots(explicit):
        path = candidate.resolve()
        tried.append(path)
        if (path / ENTRY_FILES[0]).is_file():
            return path
    lines = ["错误：未找到可用的 dist 目录（必须包含 index.html）。已尝试："]
    lines += [f"  - {item}" for item in tried]
    lines += [
        "",
        "请用 --root 指定项目的数据目录，例如：",
        '  python launcher.py --root "D:\\GitHub\\china-forest-cover-lab\\dist"',
    ]
    die("\n".join(lines), 2)
    raise AssertionError("unreachable")


def can_bind(host: str, port: int) -> bool:
    # 不设置 SO_REUSEADDR：Windows 上该选项会允许与已监听的端口重复绑定，导致误判空闲。
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def pick_port(host: str, preferred: int) -> int:
    for port in range(preferred, min(preferred + PORT_ATTEMPTS, 65535) + 1):
        if can_bind(host, port):
            return port
    die(f"错误：{preferred}–{preferred + PORT_ATTEMPTS} 范围内没有可用端口，请用 --port 指定。", 3)
    raise AssertionError("unreachable")


class StaticHandler(SimpleHTTPRequestHandler):
    """只读静态文件服务：限制在 dist/ 内，禁止目录穿越，禁用缓存。"""

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **MIME_OVERRIDES}
    server_version = "forest-lab-launcher"

    def __init__(self, *args, directory: Path, **kwargs):
        super().__init__(*args, directory=str(directory), **kwargs)

    def translate_path(self, path: str) -> str:
        decoded = path.replace("%2e", ".").replace("%2E", ".")
        if ".." in decoded:
            return str(Path(self.directory) / "__forbidden__")
        return super().translate_path(path)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_request(self, code="-", size="-") -> None:
        sys.stderr.write(f"  {self.command} {self.path} → {code}\n")
        sys.stderr.flush()

    def log_error(self, format: str, *args) -> None:
        """错误已由 log_request 输出，这里不再重复打印。"""

    # --- 本地密钥接口（仅 127.0.0.1 / localhost 页面可调用） ---

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def origin_allowed(self) -> bool:
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if not origin:
            return True
        return urllib.parse.urlsplit(origin).hostname in LOCAL_ORIGINS


    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 8192:
            raise ValueError("请求体为空或过大。")
        payload = json.loads(self.rfile.read(length))
        if not isinstance(payload, dict):
            raise ValueError("请求体必须是 JSON 对象。")
        return payload

    def do_GET(self) -> None:  # noqa: N802 - 覆盖基类方法
        if self.path.split("?", 1)[0] == AUTH_GET:
            self.send_json(auth_state())
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - 覆盖基类方法
        path = self.path.split("?", 1)[0]
        if path not in AUTH_POST:
            self.send_error(405, "Method Not Allowed")
            return
        if not self.origin_allowed():
            self.send_json({"error": "只接受来自本机 127.0.0.1 的请求。"}, 403)
            return
        try:
            payload = self.read_json()
            store, client = auth_modules()
            if path == "/api/auth/login":
                username = str(payload.get("username") or "").strip()
                password = str(payload.get("password") or "")
                if not username or not password:
                    raise ValueError("未填写 Earthdata 用户名或密码。")
                basic = base64.b64encode(
                    f"{username}:{password}".encode()
                ).decode()
                app = client.AppEEARS()
                result = app.request("/login", method="POST", basic=basic)
                if not isinstance(result, dict) or not result.get("token"):
                    raise ValueError("登录响应缺少 AppEEARS 令牌。")
                expires = result.get("expiration") or token_expiration(
                    result["token"]
                )
                if not expires:
                    raise ValueError("登录响应缺少到期时间，未保存令牌。")
                store.write_token(result["token"], expires)
            else:
                token = str(payload.get("token") or "").strip()
                expires = payload.get("expiration") or token_expiration(token)
                if not token:
                    raise ValueError("未填写令牌。")
                if not expires:
                    raise ValueError("令牌不是 JWT，请同时填写到期时间。")
                store.write_token(token, str(expires))
            self.send_json(auth_state())
        except Exception as error:  # noqa: BLE001 - 统一回显安全文案
            message = str(error) or "密钥操作失败。"
            self.send_json({"error": message}, 400)


def make_server(host: str, port: int, root: Path) -> ThreadingHTTPServer:
    handler = partial(StaticHandler, directory=root)
    server = ThreadingHTTPServer((host, port), handler)
    server.daemon_threads = True
    return server


def build_url(host: str, port: int, query: str = "") -> str:
    return f"http://{host}:{port}/{query}"


def fetch(url: str) -> tuple[int, str, int]:
    request = urllib.request.Request(url, headers={"User-Agent": "launcher-self-test"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, response.headers.get("Content-Type", ""), len(response.read())
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get("Content-Type", ""), 0
    except urllib.error.URLError as error:
        return 0, str(error.reason), 0


def self_test(server: ThreadingHTTPServer, host: str, port: int, root: Path) -> int:
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.3)
    cases: list[tuple[str, int, str]] = [
        ("/", 200, "text/html"),
        ("/index.html", 200, "text/html"),
        ("/app.js", 200, "text/javascript"),
        ("/style.css", 200, "text/css"),
        ("/api/auth/status", 200, "application/json"),
        ("/national-statistics.json", 200, "application/json"),
        ("/?demo=1", 200, "text/html"),
        ("/%2e%2e/AGENTS.md", 404, ""),
        ("/nope.js", 404, ""),
    ]
    assets = (("forest-2025.png", "image/png"), ("china-data.js", "text/javascript"))
    for name, mime in assets:
        if (root / name).is_file():
            cases.insert(5, (f"/{name}", 200, mime))
    failures = 0
    log(f"{'路径':<30} {'状态':>5}  {'类型':<32} 结果")
    for path, expected_status, expected_type in cases:
        status, content_type, size = fetch(build_url(host, port, path.lstrip("/")))
        ok = status == expected_status and content_type.startswith(expected_type)
        failures += 0 if ok else 1
        mark = "通过" if ok else "失败"
        log(f"{path:<30} {status:>5}  {content_type[:32]:<32} {mark}")
    server.shutdown()
    log()
    if failures:
        log(f"自检失败：{failures} 项不符合预期。")
        return 1
    log(f"自检通过：{len(cases)} 项全部符合预期。")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="china-forest-cover-lab 本地启动器：起静态服务并用浏览器打开。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "示例：\n"
            "  python launcher.py                 # 真实数据快照 /\n"
            "  python launcher.py --demo          # 合成样品 /?demo=1\n"
            "  python launcher.py --pending       # 接入等待 /?mode=pending\n"
            "  python launcher.py --self-test     # 只做接口自检\n"
        ),
    )
    parser.add_argument("--root", help="dist 目录；默认自动查找（见 --help 说明）")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"起始端口，默认 {DEFAULT_PORT}")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"监听地址，默认 {DEFAULT_HOST}")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    parser.add_argument("--self-test", action="store_true", help="启动后自检若干 URL 并退出")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--demo", action="store_true", help="打开合成样品 /?demo=1")
    mode.add_argument("--pending", action="store_true", help="打开接入等待 /?mode=pending")
    args = parser.parse_args(argv)

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    root = resolve_root(args.root)
    missing_data = [name for name in DATA_FILES if not (root / name).is_file()]
    port = pick_port(args.host, args.port)
    server = make_server(args.host, port, root)
    query = "?demo=1" if args.demo else ("?mode=pending" if args.pending else "")
    mode_label = "合成样品（?demo=1）" if args.demo else ("接入等待（?mode=pending）" if args.pending else "真实数据快照（默认）")
    url = build_url(args.host, port, query)

    if args.self_test:
        log(f"自检模式：{root}")
        return self_test(server, args.host, port, root)

    log("china-forest-cover-lab 本地启动器")
    log(f"  数据目录  {root}")
    log(f"  访问地址  {url}")
    log(f"  模式      {mode_label}")
    if port != args.port:
        log(f"  端口      {args.port} 被占用，已改用 {port}")
    if missing_data:
        log(f"  提示      缺少 {', '.join(missing_data)}，页面会回落到接入等待态")
    log("  停止      按 Ctrl+C")
    log()

    if not args.no_browser:
        threading.Timer(BROWSER_DELAY, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("\n已停止。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
