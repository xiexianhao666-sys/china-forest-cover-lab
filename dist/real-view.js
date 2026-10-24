import { mountComposition, drawComposition } from "./composition.js";
import { mountAnalysis } from "./real-analysis.js";
import { $, reducedMotion, download, prepareDataLayout } from "./ui.js";
import { boundaryMap } from "./map.js";
import { mountCatalog } from "./catalog.js";
export function mountReal(ctx, data, metadata) {
  const rows = [...data.records].sort((a, b) => a.year - b.year);
  const { animateNumber } = ctx;
  prepareDataLayout();
  mountCatalog(ctx, metadata);
  $("map").innerHTML = boundaryMap();
  document.querySelector(".api-details").open = false;
  $("analysisDock").prepend($("trendPanel"));
  mountComposition();
  $("analysisDock").append(document.querySelector(".api-details"));
  let region = "all",
    compare = null,
    baseline = 0,
    mode = "rate";
  const presetCompare = new URLSearchParams(location.search).get("compare");
  if (presetCompare) compare = presetCompare;
  const regions = data.regions || [];
  const regionRows = () =>
    region === "all"
      ? rows
      : regions.find((r) => r.region_id === region).records;
  const regionName = () =>
    region === "all"
      ? "全国"
      : regions.find((r) => r.region_id === region).name_zh;
  const analysis = mountAnalysis(
    ctx,
    data,
    () => ({
      region,
      compare,
      baseline: rows[baseline].year,
      year: rows[selected].year,
      mode,
    }),
    (id, asCompare) => {
      if (asCompare && id !== region && id !== "all") {
        compare = compare === id ? null : id;
      } else {
        region = id;
        compare = null;
      }
      if (region === "all") compare = null;
      renderReal();
    },
  );
  let selected = rows.length - 1,
    play = null;
  document.title = "中国森林类面积 · AppEEARS实测产品";
  document.querySelector("h1").textContent = "中国森林类面积查询";
  document.querySelector(".edition").textContent =
    "遥感分类统计 · 非官方森林覆盖率";
  document.querySelector(".data-notice strong").textContent = "真实产品";
  $("region").innerHTML =
    '<option value="all">中国 · 研究范围汇总</option>' +
    regions
      .map((r) => `<option value="${r.region_id}">${r.name_zh}</option>`)
      .join("");
  $("region").disabled = !regions.length;
  $("start").innerHTML = rows
    .map((r) => `<option value="${r.year}">${r.year}</option>`)
    .join("");
  $("start").disabled = rows.length < 2;
  $("end").innerHTML = rows
    .map((r) => '<option value="' + r.year + '">' + r.year + "</option>")
    .join("");
  $("end").disabled = rows.length < 2;
  $("rateMode").textContent = "森林类分布";
  $("changeMode").hidden = false;
  $("rateMode").disabled = false;
  $("changeMode").disabled = !regions.length || rows.length < 2;
  $("changeMode").title = "省级分类占比差（百分点），非真实森林增减";
  $("resetBtn").disabled = false;
  const metricLabels = document.querySelectorAll(".map-annotation div > span");
  metricLabels[0].textContent = "森林类占比";
  metricLabels[1].textContent = "有效数据覆盖";
  const periodMetric = document.createElement("div");
  periodMetric.innerHTML =
    '<span>期间分类占比差</span><b id="periodDelta">—</b>';
  $("deltaNote").before(periodMetric);
  $("rate").removeAttribute("data-current");
  $("delta").removeAttribute("data-current");
  document.querySelector("#trendPanel summary").firstChild.textContent =
    "年度趋势";
  document.querySelector(".playback-heading span").textContent = "真实年度";
  document.querySelector(".playback-panel p").textContent =
    "仅播放已完成年度；过渡不生成新观测";
  $("yearSlider").min = 0;
  $("yearSlider").max = rows.length - 1;
  $("yearSlider").step = 1;
  $("yearSlider").disabled = rows.length < 2;
  $("playBtn").disabled = rows.length < 2;
  $("sliderStart").textContent = rows[0].year;
  $("mapLegend").innerHTML =
    '<span><i style="background:#20704e"></i>森林类 1—5</span><span><i style="background:#e2e6dc"></i>其他陆地类</span><span><i style="background:#9ec3d6"></i>水体</span>';
  $("mapLegend").classList.add("real-legend");
  document.querySelector(".map-footnote").innerHTML =
    "<span>栅格：NASA MCD12Q1.061 · 近邻降采样仅用于显示</span><span>概化研究边界 · 非标准地图</span>";
  $("sourceDialog").innerHTML =
    '<div class="dialog-head"><h2>真实数据与统计口径</h2><button id="closeApiDialog" aria-label="关闭">×</button></div><p>数据由本地程序通过 NASA AppEEARS 认证提取，下载文件经过 SHA-256 校验。网页展示已发布的统计快照，账户令牌保留在本地。</p><p><strong>森林类占比不是官方森林覆盖率。</strong>本项目将 LC_Type1 的1—5类计为森林类（树高超过2米、树冠覆盖超过60%的分类定义）。分母为研究范围内通过质量筛选的有效分类面积，包含水体；不包含缺失或未分类像元。</p><p>在原生 MODIS 等面积投影中，以像元中心落入边界为准、按仿射变换计算面积。QC 1、3、10及未知值不计入有效面积；8与9保留并单独记录。有效数据覆盖率不是分类准确率。低于99%时不展示主占比。</p><p>统计边界是 geoBoundaries 2019年34个省级单元的合并概化边界，不能等同于官方完整国土边界；未充分表示狭小岛屿及南海岛礁。底图省界来自 DataV，仅帮助定位，不参与面积计算。</p><p><strong>年度分类差异不能直接认定为森林增长或损失。</strong>产品指南不建议以逐年分类差异判定真实土地覆盖变化。2026年完整年度数据未接入。</p><p><a href="https://lpdaac.usgs.gov/documents/1409/MCD12_User_Guide_V61.pdf" target="_blank" rel="noopener">NASA产品指南</a> · <a href="https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM1/" target="_blank" rel="noopener">边界来源</a> · <a href="national-statistics.json" download>下载统计与口径 JSON</a></p>';
  $("closeApiDialog").onclick = () => $("sourceDialog").close();
  const p = data.pipeline,
    complete = p.statistics_status === "exploratory_estimate";
  const taskText = complete
    ? "已完成"
    : { queued: "排队中", processing: "处理中", done: "提取完成，统计待完成" }[
        p.task_status
      ] || p.task_status;
  document.querySelector(".api-details .panel-note").textContent =
    "认证提取：已验证；已生成 " +
    rows.length +
    " 个年度。" +
    p.year +
    "—" +
    (p.end_year || p.year) +
    "任务：" +
    taskText +
    "。任务状态快照：" +
    new Date(p.checked_at).toLocaleString("zh-CN") +
    "。";
  if (Number.isFinite(p.progress?.summary) && !complete) {
    const progress = document.createElement("p");
    progress.textContent =
      "服务端整体进度 " + p.progress.summary + "%（上述时间的快照）";
    const bar = document.createElement("progress");
    bar.max = 100;
    bar.value = p.progress.summary;
    bar.setAttribute("aria-label", "历史任务处理进度快照");
    bar.style.width = "100%";
    document.querySelector(".api-details .panel-content").append(progress, bar);
  }
  document.querySelector("footer").innerHTML =
    "<span>MCD12Q1.061 · LC_Type1 + QC · 已生成 " +
    rows.length +
    " 个年度</span><span>发布快照 · 原生等面积统计 · 不作真实增减判定</span>";
  const refresh = $("refreshAPI").onclick;
  $("apiStatus").textContent =
    rows.length +
    " 个真实年度已生成；" +
    (complete ? "提取统计完成" : "历史任务" + taskText);
  $("refreshAPI").onclick = refresh;
  $("exportBtn").disabled = false;
  $("exportBtn").onclick = () =>
    download(
      JSON.stringify(data, null, 2),
      "application/json",
      "全国森林类面积-真实产品统计.json",
    );
  $("chartExport").hidden = false;
  $("chartExport").disabled = false;
  $("chartExport").onclick = () =>
    download($("trend").innerHTML, "image/svg+xml", "年度分类占比.svg");
  function renderReal() {
    const r = regionRows().find((r) => r.year === rows[selected].year) || {
      year: rows[selected].year,
      forest_share_of_valid_classified_area_pct: null,
      valid_classified_area_fraction: null,
      forest_area_km2: null,
    };
    $("region").value = region;
    $("regionTitle").textContent = regionName();
    const before = regionRows().find(
      (row) => row.year === rows[baseline].year,
    )?.forest_share_of_valid_classified_area_pct;
    if (
      selected !== baseline &&
      Number.isFinite(before) &&
      Number.isFinite(r.forest_share_of_valid_classified_area_pct)
    )
      animateNumber(
        "periodDelta",
        r.forest_share_of_valid_classified_area_pct - before,
        "个百分点",
        true,
      );
    else $("periodDelta").textContent = "—";
    $("start").value = rows[baseline].year;
    $("sliderStart").textContent = rows[baseline].year;
    [...$("end").options].forEach(
      (o) => (o.disabled = Number(o.value) < rows[baseline].year),
    );
    $("end").value = r.year;
    $("yearSlider").min = baseline;
    $("yearSlider").value = selected;
    $("yearSlider").style.setProperty(
      "--progress",
      (rows.length > 1 ? (selected / (rows.length - 1)) * 100 : 100) + "%",
    );
    $("sliderYear").textContent = r.year;
    $("mapTitle").textContent = r.year + "年森林类空间分布";
    $("mapSubtitle").textContent = "MCD12Q1.061 · LC_Type1 1—5类 · 真实栅格";
    if (r.forest_share_of_valid_classified_area_pct !== null)
      animateNumber("rate", r.forest_share_of_valid_classified_area_pct, "%");
    else $("rate").textContent = "—";
    if (Number.isFinite(r.valid_classified_area_fraction))
      animateNumber("delta", r.valid_classified_area_fraction * 100, "%");
    else $("delta").textContent = "—";
    $("deltaNote").textContent = Number.isFinite(r.forest_area_km2)
      ? "森林类面积 " + (r.forest_area_km2 / 10000).toFixed(2) + " 万km²"
      : "该年度区域统计待完成";
    $("trendSubtitle").textContent = r.year + "年 · 全国研究范围";
    const svg = $("map").querySelector("svg");
    svg.setAttribute("aria-label", r.year + "年真实森林分类分布，非省级覆盖率");
    svg.querySelector("title").textContent =
      "NASA MCD12Q1森林分类；面积为全国研究范围汇总";
    for (const node of svg.querySelectorAll("g > path.province")) {
      node.setAttribute("fill", "none");
      node.style.stroke = "#798887";
      node.style.strokeWidth = ".35";
      node.style.opacity = ".55";
    }
    const image = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "image",
    );
    for (const [key, v] of Object.entries({
      x: 0,
      y: 0,
      width: 650,
      height: 480,
      preserveAspectRatio: "none",
      href: "forest-" + r.year + ".png",
    }))
      image.setAttribute(key, v);
    image.classList.add("real-raster");
    svg.insertBefore(image, svg.querySelector("g"));
    const old = svg.querySelectorAll(".real-raster");
    if (old.length > 1) {
      if (!reducedMotion.matches)
        image.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 650 });
      for (const node of [...old].slice(0, -1))
        ctx.timeout(() => node.remove(), 650);
    }
    $("compositionSubtitle").textContent = r.year + "年 · " + regionName();
    drawComposition(
      r.forest_share_of_valid_classified_area_pct,
      r.year + "年 · " + regionName(),
    );
    analysis.render();
  }
  function pauseReal() {
    ctx.clearInterval(play);
    play = null;
    $("playBtn").textContent = "▶";
    $("playBtn").setAttribute("aria-label", "播放年份");
  }
  $("end").onchange = () => {
    pauseReal();
    selected = rows.findIndex((r) => r.year === Number($("end").value));
    renderReal();
  };
  $("start").onchange = () => {
    pauseReal();
    baseline = rows.findIndex((r) => r.year === Number($("start").value));
    selected = Math.max(baseline, selected);
    renderReal();
  };
  $("region").onchange = () => {
    region = $("region").value;
    renderReal();
  };
  $("rateMode").onclick = () => {
    mode = "rate";
    renderReal();
  };
  $("changeMode").onclick = () => {
    mode = "change";
    renderReal();
  };
  $("yearSlider").oninput = () => {
    pauseReal();
    selected = Number($("yearSlider").value);
    renderReal();
  };
  $("playBtn").onclick = () => {
    if (play) {
      pauseReal();
      return;
    }
    if (selected === rows.length - 1) selected = baseline;
    renderReal();
    $("playBtn").textContent = "Ⅱ";
    $("playBtn").setAttribute("aria-label", "暂停年份");
    play = ctx.interval(() => {
      if (selected >= rows.length - 1) {
        pauseReal();
        return;
      }
      selected++;
      renderReal();
    }, 1400);
  };
  $("resetBtn").onclick = () => {
    pauseReal();
    selected = rows.length - 1;
    baseline = 0;
    region = "all";
    mode = "rate";
    renderReal();
  };
  renderReal();
  return pauseReal;
}
