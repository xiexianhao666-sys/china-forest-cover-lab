import { $ } from "./ui.js";
import { boundaryMap, features } from "./map.js";
const share = (r) => r?.forest_share_of_valid_classified_area_pct;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function mountAnalysis(ctx, data, state, selectRegion) {
  const regions = data.regions || [];
  for (const id of ["rankingPanel", "comparison"]) $(id).hidden = false;
  $("sort").disabled = false;
  document.querySelector("#rankingPanel .panel-note").textContent =
    "省级分类占比差；缺失或质量不足的区域不参与排序。非真实森林增减。";
  document.querySelector("#comparison .panel-note").textContent =
    "两期采用相同分类色标；灰白缺失区不表示非森林。";
  document.querySelector(".compare-legend").textContent =
    "绿色：森林类 · 浅灰：其他陆地 · 蓝色：水体";
  $("sort").onchange = () => render();
  function series() {
    const s = state();
    return s.region === "all"
      ? data.records
      : regions.find((r) => r.region_id === s.region)?.records || [];
  }
  function label() {
    return state().region === "all"
      ? "全国"
      : regions.find((r) => r.region_id === state().region)?.name_zh || "区域";
  }
  function trend() {
    const s = state(),
      records = [...series()].sort((a, b) => a.year - b.year),
      good = records.filter((r) => Number.isFinite(share(r)));
    const cmpId = s.compare && s.compare !== s.region ? s.compare : null;
    const cmpRegion = cmpId ? regions.find((r) => r.region_id === cmpId) : null;
    const cmpGood = cmpRegion
      ? [...cmpRegion.records]
          .filter((r) => Number.isFinite(share(r)))
          .sort((a, b) => a.year - b.year)
      : [];
    $("trendSubtitle").textContent =
      label() +
      (cmpRegion ? " 对比 " + cmpRegion.name_zh : "") +
      " · 年度分类占比";
    $("chartExport").title = "导出年度趋势图";
    $("chartExport").disabled = !good.length;
    if (!good.length) {
      $("trend").innerHTML = '<p class="api-empty">该区域年度统计待完成。</p>';
      return;
    }
    const W = innerWidth <= 600 ? 340 : 600;
    const first = data.records[0].year,
      last = data.records.at(-1).year;
    const allShares = [...good, ...cmpGood].map(share);
    const max = Math.min(
      100,
      Math.max(10, Math.ceil((Math.max(...allShares) * 1.15) / 10) * 10),
    );
    const x = (y) =>
        first === last ? W / 2 : 45 + ((y - first) / (last - first)) * (W - 65),
      y = (v) => 190 - (v / max) * 160;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 235" role="img" aria-label="${esc(label())}年度分类占比趋势"><rect x="45" y="30" width="${W - 65}" height="160" fill="#f7faff"/><rect x="${x(s.baseline)}" y="30" width="${Math.max(0, x(s.year) - x(s.baseline))}" height="160" fill="#e6effb"/>`;
    for (let i = 0; i <= 4; i++) {
      const v = (max * i) / 4;
      svg += `<line x1="45" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="white"/><text x="38" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#526575">${v}%</text>`;
    }
    let pen = false,
      previous = null,
      d = "";
    for (const r of records) {
      if (!Number.isFinite(share(r))) {
        pen = false;
        continue;
      }
      d +=
        (pen && r.year === previous + 1 ? "L" : "M") +
        x(r.year) +
        "," +
        y(share(r)) +
        " ";
      pen = true;
      previous = r.year;
    }
    svg += `<path class="tl-line" d="${d}" fill="none" stroke="#2868bc" stroke-width="2" pathLength="1"/>`;
    for (const r of good)
      svg += `<circle class="tl-dot" cx="${x(r.year)}" cy="${y(share(r))}" r="${r.year === s.year ? 4 : 2}" fill="${r.year === s.year ? "white" : "#2868bc"}" stroke="#2868bc"><title>${r.year}年 ${share(r).toFixed(2)}%</title></circle>`;
    if (cmpGood.length) {
      let cpen = false,
        cprev = null,
        cd = "";
      for (const r of cmpGood) {
        if (!Number.isFinite(share(r))) {
          cpen = false;
          continue;
        }
        cd +=
          (cpen && r.year === cprev + 1 ? "L" : "M") +
          x(r.year) +
          "," +
          y(share(r)) +
          " ";
        cpen = true;
        cprev = r.year;
      }
      svg += `<path class="tl-line cmp" d="${cd}" fill="none" stroke="#be6926" stroke-width="2" stroke-dasharray="5 4"/>`;
      for (const r of cmpGood)
        svg += `<circle class="tl-dot cmp" cx="${x(r.year)}" cy="${y(share(r))}" r="2" fill="#be6926"><title>${r.year}年 ${share(r).toFixed(2)}%</title></circle>`;
      svg += `<g font-size="10" fill="#526575"><line x1="52" y1="20" x2="76" y2="20" stroke="#2868bc" stroke-width="2"/><text x="82" y="23">${esc(label())}</text><line x1="150" y1="20" x2="174" y2="20" stroke="#be6926" stroke-width="2" stroke-dasharray="5 4"/><text x="180" y="23">${esc(cmpRegion.name_zh)}</text></g>`;
    }
    const ticks = [first, last];
    for (let year = Math.ceil(first / 5) * 5; year < last; year += 5)
      if (year - first >= 2 && last - year >= 2) ticks.push(year);
    for (const year of [...new Set(ticks)])
      svg += `<text x="${x(year)}" y="209" text-anchor="middle" font-size="10" fill="#526575">${year}</text>`;
    svg += "</svg>";
    $("trend").innerHTML = svg;
  }
  function difference(region) {
    const s = state(),
      a = region.records.find((r) => r.year === s.baseline),
      b = region.records.find((r) => r.year === s.year);
    return Number.isFinite(share(a)) && Number.isFinite(share(b))
      ? share(b) - share(a)
      : null;
  }
  function ranking() {
    const s = state();
    $("rankingPeriod").textContent = `${s.baseline}—${s.year} · 百分点`;
    if (s.baseline === s.year) {
      $("ranking").innerHTML =
        '<p class="api-empty">请选择两个不同年度查看区域变化比较。</p>';
      return;
    }
    const list = regions
      .map((r) => ({ ...r, delta: difference(r) }))
      .filter((r) => r.delta !== null)
      .sort(
        (a, b) => ($("sort").value === "asc" ? 1 : -1) * (a.delta - b.delta),
      );
    if (!list.length) {
      $("ranking").innerHTML =
        '<p class="api-empty">省级两期统计待完成；全国数据不能代替省级结果。</p>';
      return;
    }
    const max = Math.max(0.01, ...list.map((r) => Math.abs(r.delta)));
    $("ranking").innerHTML =
      '<div class="real-ranking">' +
      list
        .map(
          (r) =>
            `<button class="real-rank-row" data-region="${r.region_id}" aria-label="查看${esc(r.name_zh)}"><span>${esc(r.name_zh)}</span><span class="rank-track"><i style="width:${(Math.abs(r.delta) / max) * 100}%;background:${r.delta < 0 ? "#aa5a31" : "#7851a9"}"></i></span><b>${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)}</b></button>`,
        )
        .join("") +
      "</div>";
    $("ranking")
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => selectRegion(b.dataset.region)));
  }
  function comparison() {
    const s = state();
    for (const [id, year] of [
      ["miniStart", s.baseline],
      ["miniEnd", s.year],
    ]) {
      $(id).innerHTML = boundaryMap();
      const svg = $(id).querySelector("svg");
      svg.querySelector("#boundaryClip").id = id + "Clip";
      svg.querySelector("g").setAttribute("clip-path", `url(#${id}Clip)`);
      svg.setAttribute("aria-label", year + "年真实分类分布");
      if (data.records.some((r) => r.year === year)) {
        const image = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "image",
        );
        for (const [k, v] of Object.entries({
          x: 0,
          y: 0,
          width: 650,
          height: 480,
          href: `forest-${year}.png`,
          preserveAspectRatio: "none",
        }))
          image.setAttribute(k, v);
        svg.insertBefore(image, svg.querySelector("g"));
        svg
          .querySelectorAll("g > path")
          .forEach((p) => p.setAttribute("fill", "none"));
        [...svg.querySelectorAll("g > path")].forEach((p, i) => {
          if (String(features[i].properties.adcode) === s.region) {
            p.style.stroke = "#164f38";
            p.style.strokeWidth = "2";
          }
        });
      }
    }
    $("compareStart").textContent = s.baseline + "年";
    $("compareEnd").textContent = s.year + "年";
  }
  function map() {
    const s = state(),
      svg = $("map").querySelector("svg");
    for (const [i, path] of [
      ...svg.querySelectorAll("g > path.province"),
    ].entries()) {
      const id = String(features[i].properties.adcode),
        r = regions.find((r) => r.region_id === id);
      path.dataset.id = id;
      path.style.strokeWidth = id === s.region ? "2" : ".35";

      path.style.strokeDasharray =
        s.compare && id === s.compare && id !== s.region ? "5 3" : "none";
      path.style.opacity = "1";
      if (r) {
        path.setAttribute("role", "button");
        path.setAttribute("tabindex", "0");
        const v =
          s.mode === "change"
            ? difference(r)
            : share(r.records.find((row) => row.year === s.year));
        const tip =
          r.name_zh +
          " · " +
          s.year +
          "年\n" +
          (Number.isFinite(v)
            ? v.toFixed(2) +
              (s.mode === "change" ? " 个百分点（分类占比差）" : "% 森林类占比")
            : "数据不足，不计算占比差") +
          "\n点击查看该区域 · Shift+点击叠加对比";
        path.setAttribute("aria-label", tip);
        path.style.pointerEvents = "all";
        path.onclick = (event) => {
          $("tooltip").style.display = "none";
          selectRegion(id, Boolean(event && event.shiftKey));
        };
        path.onmousemove = (e) => {
          const t = $("tooltip");
          t.textContent = tip;
          t.style.display = "block";
          t.style.left =
            Math.max(
              8,
              Math.min(e.clientX + 12, innerWidth - t.offsetWidth - 8),
            ) + "px";
          t.style.top =
            Math.max(
              8,
              Math.min(e.clientY + 12, innerHeight - t.offsetHeight - 8),
            ) + "px";
        };
        path.onmouseleave = () => ($("tooltip").style.display = "none");
        path.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectRegion(id);
          }
        };
      }
      if (s.mode === "change") {
        const d = r ? difference(r) : null;
        path.setAttribute(
          "fill",
          d === null
            ? "#cdd4da"
            : d < 0
              ? "#b56c41"
              : d > 0
                ? "#268168"
                : "#f0f1ed",
        );
        path.style.fillOpacity =
          d === null ? 1 : Math.min(1, 0.2 + Math.abs(d) / 5);
      } else path.style.fillOpacity = "1";
    }
    for (const image of svg.querySelectorAll(".real-raster"))
      image.style.display = s.mode === "change" ? "none" : "";
    for (const [id, mode] of [
      ["rateMode", "rate"],
      ["changeMode", "change"],
    ]) {
      $(id).classList.toggle("selected", s.mode === mode);
      $(id).setAttribute("aria-pressed", String(s.mode === mode));
    }
    if (s.mode === "change") {
      $("mapTitle").textContent = `${s.baseline}—${s.year}年省级分类占比差`;
      $("mapSubtitle").textContent = "";
      svg.setAttribute("aria-label", $("mapTitle").textContent);
      svg.querySelector("title").textContent =
        "省级独立年度分类占比差，不作真实森林增减判定";
      $("mapLegend").innerHTML =
        '<span class="change-scale"><i class="change-scale-bar"></i><span class="change-scale-ticks"><b>−5</b><b>0</b><b>+5</b></span></span><span class="change-scale-unit">个百分点</span>';
    } else
      $("mapLegend").innerHTML =
        '<span><i style="background:#20704e"></i>森林类1—5</span><span><i style="background:#e2e6dc"></i>其他陆地类</span><span><i style="background:#9ec3d6"></i>水体</span>';
  }
  function render() {
    trend();
    ranking();
    comparison();
    map();
  }
  return { render };
}
