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
    $("trendSubtitle").textContent = label() + " · 年度分类占比";
    $("chartExport").title = "导出年度趋势图";
    $("chartExport").disabled = !good.length;
    if (!good.length) {
      $("trend").innerHTML = '<p class="api-empty">该区域年度统计待完成。</p>';
      return;
    }
    const first = data.records[0].year,
      last = data.records.at(-1).year;
    const max = Math.min(
      100,
      Math.max(10, Math.ceil((Math.max(...good.map(share)) * 1.15) / 10) * 10),
    );
    const x = (y) =>
        first === last ? 190 : 45 + ((y - first) / (last - first)) * 275,
      y = (v) => 190 - (v / max) * 160;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 235" role="img" aria-label="${esc(label())}年度分类占比趋势"><rect x="45" y="30" width="275" height="160" fill="#f0f3f5"/><rect x="${x(s.baseline)}" y="30" width="${Math.max(0, x(s.year) - x(s.baseline))}" height="160" fill="#deeee5"/>`;
    for (let i = 0; i <= 4; i++) {
      const v = (max * i) / 4;
      svg += `<line x1="45" x2="320" y1="${y(v)}" y2="${y(v)}" stroke="white"/><text x="38" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#526575">${v}%</text>`;
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
    svg += `<path d="${d}" fill="none" stroke="#20704e" stroke-width="2"/>`;
    for (const r of good)
      svg += `<circle cx="${x(r.year)}" cy="${y(share(r))}" r="${r.year === s.year ? 4 : 2}" fill="${r.year === s.year ? "white" : "#20704e"}" stroke="#20704e"><title>${r.year}年 ${share(r).toFixed(2)}%</title></circle>`;
    const ticks = [first, last];
    for (let year = Math.ceil(first / 5) * 5; year < last; year += 5)
      if (year - first >= 2 && last - year >= 2) ticks.push(year);
    for (const year of [...new Set(ticks)])
      svg += `<text x="${x(year)}" y="209" text-anchor="middle" font-size="10" fill="#526575">${year}</text>`;
    svg += `<text x="170" y="230" text-anchor="middle" font-size="10" fill="#526575">${first === last ? "仅1个年度，不连接为趋势线" : "分类占比差异不等同于真实森林增减"}</text></svg>`;
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
            `<button class="real-rank-row" data-region="${r.region_id}" aria-label="查看${esc(r.name_zh)}"><span>${esc(r.name_zh)}</span><span class="rank-track"><i style="width:${(Math.abs(r.delta) / max) * 100}%;background:${r.delta < 0 ? "#aa5a31" : "#20704e"}"></i></span><b>${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)}</b></button>`,
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
          "\n点击查看该区域";
        path.setAttribute("aria-label", tip);
        path.style.pointerEvents = "all";
        path.onclick = () => {
          $("tooltip").style.display = "none";
          selectRegion(id);
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
      $("mapSubtitle").textContent =
        "百分点 · 独立年度分类统计差，非森林增减判定";
      svg.setAttribute("aria-label", $("mapTitle").textContent);
      svg.querySelector("title").textContent =
        "省级独立年度分类占比差，不作真实森林增减判定";
      $("mapLegend").innerHTML =
        "<span>棕：减少</span><span>绿：增加</span><span>灰：数据不足</span><span>颜色随差值绝对值加深（5个百分点封顶）</span>";
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
