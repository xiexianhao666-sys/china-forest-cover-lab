"""AppEEARS client: public metadata and authenticated task operations."""
import argparse
import base64
import getpass
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from credential_store import read_token, write_token

BASE = "https://appeears.earthdatacloud.nasa.gov/api"
ROOT = Path(__file__).resolve().parent

class APIError(Exception):
    pass

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward credentials to another host.

class AppEEARS:
    def __init__(self, token=None):
        self.token = token
        self.expiration = None
        self.opener = build_opener(NoRedirect)

    def request(self, endpoint, method="GET", payload=None, auth=False, basic=None):
        if not endpoint.startswith("/") or "://" in endpoint:
            raise APIError("Invalid API endpoint.")
        headers = {"Accept": "application/json", "User-Agent": "ForestResearch/0.1"}
        if auth:
            if not self.token:
                self.token = read_token()
            if not self.token:
                self.login()
            headers["Authorization"] = "Bearer " + self.token
        if basic:
            headers["Authorization"] = "Basic " + basic
        data = None
        if payload is not None:
            data = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        elif method == "POST":
            data = b""
        try:
            with self.opener.open(Request(BASE + endpoint, data=data, headers=headers, method=method), timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            # Never print response bodies or headers which might echo credentials.
            if error.code in (401, 403):
                raise APIError("认证失败或AppEEARS令牌已过期。请重新登录；Earthdata用户令牌不等同于AppEEARS登录令牌。") from None
            raise APIError(f"AppEEARS返回HTTP {error.code}。任务提交不会自动重试，请先检查任务列表。") from None
        except (URLError, TimeoutError, OSError):
            raise APIError("网络连接失败或超时。若在提交时发生，请先查询任务列表，避免重复任务。") from None
        except (ValueError, UnicodeError):
            raise APIError("API返回了无法解析的JSON。") from None

    def login(self):
        user = os.getenv("EARTHDATA_USERNAME") or input("Earthdata用户名：").strip()
        password = os.getenv("EARTHDATA_PASSWORD") or getpass.getpass("Earthdata密码（输入不显示）：")
        basic = base64.b64encode((user + ":" + password).encode()).decode()
        result = self.request("/login", method="POST", basic=basic)
        if not isinstance(result, dict) or not result.get("token"):
            raise APIError("登录响应缺少AppEEARS令牌。")
        self.token = result["token"]
        self.expiration = result.get("expiration")

    def catalog(self):
        records = []
        for offset in range(0, 10000, 100):
            page = self.request(f"/product?limit=100&offset={offset}")
            if not isinstance(page, list):
                raise APIError("产品目录格式异常。")
            records.extend(page)
            if len(page) < 100:
                return records
        raise APIError("目录分页未按预期结束。")

    def layers(self, product):
        return self.request("/product/" + quote(product, safe=""))

    def submit(self, task):
        validate_task(task)
        available = {p["ProductAndVersion"] for p in self.catalog() if p.get("Available")}
        for layer in task["params"]["layers"]:
            if layer["product"] not in available or layer["layer"] not in self.layers(layer["product"]):
                raise APIError("请求包含当前目录不可用的产品或图层。")
        return self.request("/task", "POST", task, auth=True)

def validate_task(task):
    if task.get("task_type") != "area":
        raise APIError("全国面积统计须使用area请求，不能用少量采样点替代。")
    params = task.get("params", {})
    geo = params.get("geo", {})
    if geo.get("type") != "FeatureCollection" or not geo.get("features"):
        raise APIError("请提供经核实的全国GeoJSON FeatureCollection边界。")
    for feature in geo["features"]:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") not in ("Polygon", "MultiPolygon") or not geometry.get("coordinates"):
            raise APIError("边界必须为非空Polygon或MultiPolygon。")
    if not params.get("layers") or not params.get("dates"):
        raise APIError("缺少产品图层或时间范围。")
    for dates in params["dates"]:
        if dates.get("recurring"):
            raise APIError("首版使用明确日期，暂不接受recurring请求。")
        try:
            start = datetime.strptime(dates["startDate"], "%m-%d-%Y")
            end = datetime.strptime(dates["endDate"], "%m-%d-%Y")
        except (KeyError, ValueError):
            raise APIError("日期必须为MM-DD-YYYY。") from None
        if start > end:
            raise APIError("开始日期晚于结束日期。")
    if params.get("output", {}).get("projection") != "native":
        raise APIError("首版要求native输出；统计时还须验证实际CRS与面积计算方式。")

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def main():
    parser = argparse.ArgumentParser(description="NASA AppEEARS全国研究接口")
    parser.add_argument("command", choices=["check", "connect", "tasks", "status", "bundle", "submit"])
    parser.add_argument("--task-id")
    parser.add_argument("--request", type=Path)
    args = parser.parse_args()
    api = AppEEARS(os.getenv("APPEEARS_TOKEN"))
    if args.command == "check":
        products = [p for p in api.catalog() if p.get("ProductAndVersion") in ("MCD12Q1.061", "MOD44B.061")]
        output = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "api_base": BASE, "scope": "中国全国汇总",
            "public_api_status": "connected", "authenticated_tasks_status": "not_checked",
            "statistics_status": "not_generated",
            "products": products,
            "layers": {p["ProductAndVersion"]: api.layers(p["ProductAndVersion"]) for p in products},
            "notes": ["Present不代表2026完整年度已发布。", "MCD12Q1逐年分类差异不宜直接解释为真实变化。",
                      "MOD44B树冠覆盖度不是森林面积比例。", "尚未确定研究边界、分母和QC方案；未提交下载任务。"]
        }
        save(ROOT / "public-metadata.json", output)
        print("公开产品和图层接口连通，已保存 public-metadata.json。")
        for p in products:
            print(p["ProductAndVersion"], p.get("TemporalExtentStart"), "—", p.get("TemporalExtentEnd"))
    elif args.command == "connect":
        api.login()
        tasks = api.request("/task", auth=True)
        write_token(api.token, api.expiration)
        save(ROOT / "runtime" / "connection-status.json", {
            "authenticated_at": datetime.now(timezone.utc).isoformat(),
            "token_expiration": api.expiration, "account_tasks_access": "verified",
            "token_storage": "Windows current-user DPAPI", "password_stored": False
        })
        print("连接已保存（Windows加密）。到期时间：", api.expiration)
        print("任务接口已验证。后续本地命令可复用令牌；未提交数据提取任务。")
    elif args.command == "tasks":
        tasks = api.request("/task", auth=True)
        print("认证成功。任务数：", len(tasks))
        for task in tasks:
            print(json.dumps({k: task.get(k) for k in ("task_id", "task_name", "status")}, ensure_ascii=False))
    elif args.command == "submit":
        if not args.request:
            parser.error("submit需要--request任务JSON路径")
        task = api.submit(json.loads(args.request.read_text(encoding="utf-8")))
        save(ROOT / "runtime" / "last-submission.json", {k: task.get(k) for k in ("task_id", "status")})
        print("已提交任务：", task.get("task_id"))
    else:
        if not args.task_id:
            parser.error("需要--task-id")
        endpoint = "/task/" if args.command == "status" else "/bundle/"
        data = api.request(endpoint + quote(args.task_id, safe=""), auth=True)
        if args.command == "status":
            print(json.dumps({k: data.get(k) for k in ("task_id", "task_name", "status")}, ensure_ascii=False))
        else:
            files = [{k: f.get(k) for k in ("file_id", "file_name", "file_size")} for f in data.get("files", [])]
            save(ROOT / "runtime" / "bundle-files.json", files)
            print("结果文件清单已保存，文件数：", len(files))

if __name__ == "__main__":
    try:
        main()
    except (APIError, RuntimeError, EOFError, KeyboardInterrupt) as error:
        print(str(error) or "操作取消。", file=sys.stderr)
        sys.exit(1)
