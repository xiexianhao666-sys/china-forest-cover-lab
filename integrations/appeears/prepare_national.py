"""Generate annual extraction requests without submitting them."""
import argparse
import hashlib
import json
from pathlib import Path
from appeears import validate_task, save

ROOT = Path(__file__).resolve().parent

def make_task(geo, year):
    task = {"task_type": "area", "task_name": f"China_MCD12Q1_061_{year}",
            "params": {"geo": geo,
                       "dates": [{"startDate": f"01-01-{year}", "endDate": f"12-31-{year}"}],
                       "layers": [{"product": "MCD12Q1.061", "layer": x} for x in ("LC_Type1", "QC", "LW")],
                       "output": {"format": {"type": "geotiff"}, "projection": "native"}}}
    validate_task(task)
    return task

def main():
    p = argparse.ArgumentParser(description="准备全国年度提取任务，不自动提交")
    p.add_argument("--boundary", required=True, type=Path, help="经核实的全国WGS84 GeoJSON")
    p.add_argument("--start", type=int, default=2001)
    p.add_argument("--end", required=True, type=int)
    a = p.parse_args()
    if not 2001 <= a.start <= a.end <= 2025:
        p.error("当前候选范围2001—2025；不代表每年全国数据完整性已经核实")
    raw = a.boundary.read_bytes()
    geo = json.loads(raw.decode("utf-8-sig"))
    if geo.get("crs"):
        p.error("请先导出为WGS84/RFC7946 GeoJSON")
    tasks = [make_task(geo, y) for y in range(a.start, a.end + 1)]
    out = ROOT / "requests"
    for task in tasks:
        save(out / (task["task_name"] + ".json"), task)
    save(out / "manifest.json", {
        "boundary_sha256": hashlib.sha256(raw).hexdigest(),
        "years": list(range(a.start, a.end + 1)),
        "status": "prepared_not_submitted",
        "national_boundary_validation": "requires_researcher_review",
        "national_data_completeness": "not_verified",
        "purpose": "年度分类组成与接口验证，不直接用于证明真实森林覆盖率变化"
    })
    print(f"已准备{len(tasks)}个年度请求：{out}。未提交。")

if __name__ == "__main__":
    main()
