import { mountComposition, drawComposition } from "./composition.js";
import "./data-core.js";
import { $, reducedMotion, updateSVG, setDock, download } from "./ui.js";
import {
  features,
  CHINA_GEOJSON,
  project,
  path,
  labelPositions,
  graticule,
} from "./map.js";
export function mountDemo(ctx) {
  document.title = "中国森林覆盖变化查询 · 合成样品";
  const D = window.ForestDemo;
  const { animateNumber } = ctx;
  const ids = features.map((f) => String(f.properties.adcode));
  const state = {
    region: "all",
    start: 2000,
    end: 2025,
    mode: "rate",
    sort: "desc",
  };
  let timer = null;
  features.forEach((f) => {
    const o = document.createElement("option");
    o.value = f.properties.adcode;
    o.textContent = f.properties.name;
    $("region").append(o);
  });
  for (let y = 1990; y <= 2025; y++)
    for (const id of ["start", "end"]) {
      const o = document.createElement("option");
      o.value = y;
      o.textContent = y;
      $(id).append(o);
    }
  const name = (id) =>
    id === "all"
      ? "全国"
      : features.find((f) => String(f.properties.adcode) === id)?.properties
          .name || id;
  const shortName = (id) =>
    name(id).replace(/特别行政区|自治区|维吾尔|壮族|回族|省|市/g, "");
  const value = (id, y) => (id === "all" ? D.national(ids, y) : D.rate(id, y));
  const signed = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
  function color(v, change = false) {
    const palette = change
      ? [
          [178, 87, 45],
          [247, 247, 247],
          [33, 102, 172],
        ]
      : [
          [253, 231, 37],
          [94, 201, 98],
          [33, 145, 140],
          [59, 82, 139],
          [68, 1, 84],
        ];
    const t = change
        ? Math.max(0, Math.min(1, (v + 16) / 32))
        : Math.max(0, Math.min(1, v / 100)),
      p = t * (palette.length - 1),
      i = Math.min(palette.length - 2, Math.floor(p)),
      f = p - i;
    return (
      "rgb(" +
      palette[i]
        .map((a, j) => Math.round(a + (palette[i + 1][j] - a) * f))
        .join(",") +
      ")"
    );
  }
  const mapValues = (id, year, change) =>
    change ? D.change(id, state.start, year, ids) : D.rate(id, year);
  function inset(year, change) {
    return (
      '<svg x="548" y="321" width="90" height="133" viewBox="315 360 220 280" preserveAspectRatio="none" overflow="hidden"><rect x="315" y="360" width="220" height="280" fill="white"/>' +
      CHINA_GEOJSON.features
        .filter((f) => f.geometry)
        .map(
          (f) =>
            '<path d="' +
            path(f.geometry) +
            '" fill="' +
            (f.properties.name
              ? color(
                  mapValues(String(f.properties.adcode), year, change),
                  change,
                )
              : "#60717f") +
            '" stroke="#fff" stroke-width=".3"/>',
        )
        .join("") +
      '</svg><rect x="548" y="321" width="90" height="133" fill="none" stroke="#8d9ba5" stroke-width=".7"/><text x="593" y="468" text-anchor="middle" font-size="10" fill="#667580">南海诸岛</text>'
    );
  }
  function mapSVG(year, mini = false) {
    const change = state.mode === "change" && !mini,
      clipId = mini ? "mapClip" + year : "mainMapClip";
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      (mini ? "-8 -8 670 490" : "-46 -12 714 523") +
      '" role="img" aria-label="' +
      year +
      '年省级地图，合成演示数据"><title>合成演示数据，不代表实际森林覆盖率</title>' +
      (mini ? "" : graticule()) +
      '<defs><clipPath id="' +
      clipId +
      '"><rect x="0" y="0" width="650" height="480"/></clipPath></defs><g clip-path="url(#' +
      clipId +
      ')">' +
      features
        .map((f) => {
          const id = String(f.properties.adcode);
          return (
            '<path class="province ' +
            (id === state.region ? "focused" : "") +
            '" data-id="' +
            id +
            '" d="' +
            path(f.geometry) +
            '" fill="' +
            color(mapValues(id, year, change), change) +
            '" ' +
            (mini
              ? ""
              : 'tabindex="0" role="button" aria-label="' +
                f.properties.name +
                '，查看合成示例"') +
            "/>"
          );
        })
        .join("") +
      (mini
        ? ""
        : features
            .filter(
              (f) =>
                f.properties.center &&
                ![110000, 120000, 310000, 810000, 820000].includes(
                  f.properties.adcode,
                ),
            )
            .map((f) => {
              const p = project(
                labelPositions[f.properties.adcode] || f.properties.center,
              );
              return (
                '<text class="province-label" text-anchor="middle" x="' +
                p[0] +
                '" y="' +
                p[1] +
                '">' +
                shortName(String(f.properties.adcode)) +
                "</text>"
              );
            })
            .join("")) +
      "</g>" +
      inset(year, change) +
      "</svg>"
    );
  }
  function selectRegion(id) {
    state.region = id;
    $("region").value = id;
    $("tooltip").style.display = "none";
    render();
  }
  function bindMap() {
    document.querySelectorAll("#map .province").forEach((p) => {
      p.onclick = () => selectRegion(p.dataset.id);
      p.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectRegion(p.dataset.id);
        }
      };
      p.onmousemove = (e) => {
        const id = p.dataset.id,
          t = $("tooltip");
        t.textContent =
          name(id) +
          " · 合成示例\n" +
          state.end +
          "年 " +
          value(id, state.end).toFixed(2) +
          "%\n期间变化 " +
          signed(D.change(id, state.start, state.end, ids)) +
          " 个百分点";
        t.style.display = "block";
        t.style.left =
          Math.max(8, Math.min(e.clientX + 15, window.innerWidth - 235)) + "px";
        t.style.top =
          Math.max(8, Math.min(e.clientY + 15, window.innerHeight - 110)) +
          "px";
      };
      p.onmouseleave = () => ($("tooltip").style.display = "none");
    });
  }
  function trend() {
    const W = innerWidth <= 600 ? 340 : 600,
      H = 244,
      L = 43,
      R = 16,
      T = 26,
      B = 43,
      arr = Array.from({ length: 36 }, (_, i) => ({
        y: i + 1990,
        v: value(state.region, i + 1990),
      }));
    const lo = Math.max(
        0,
        Math.floor(Math.min(...arr.map((a) => a.v)) / 2) * 2 - 2,
      ),
      hi = Math.min(
        100,
        Math.ceil(Math.max(...arr.map((a) => a.v)) / 2) * 2 + 2,
      );
    const x = (y) => L + ((y - 1990) / 35) * (W - L - R),
      z = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
    let s =
      '<rect x="' +
      L +
      '" y="' +
      T +
      '" width="' +
      (W - L - R) +
      '" height="' +
      (H - T - B) +
      '" fill="#f5f6f7"/><rect x="' +
      x(state.start) +
      '" y="' +
      T +
      '" width="' +
      (x(state.end) - x(state.start)) +
      '" height="' +
      (H - T - B) +
      '" fill="#e5edf3"/>';
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4;
      s +=
        '<line x1="' +
        L +
        '" x2="' +
        (W - R) +
        '" y1="' +
        z(v) +
        '" y2="' +
        z(v) +
        '" stroke="#fff" stroke-width="1.4"/><text x="' +
        (L - 6) +
        '" y="' +
        (z(v) + 3) +
        '" text-anchor="end" font-size="10" fill="#667580">' +
        v.toFixed(1) +
        "</text>";
    }
    for (const y of [1990, 2000, 2010, 2020, 2025])
      s +=
        '<line x1="' +
        x(y) +
        '" x2="' +
        x(y) +
        '" y1="' +
        T +
        '" y2="' +
        (H - B) +
        '" stroke="#fff" stroke-width="1.4"/><text x="' +
        x(y) +
        '" y="' +
        (H - B + 17) +
        '" text-anchor="middle" font-size="9" fill="#667580">' +
        y +
        "</text>";
    const line = arr
      .map((p, i) => (i ? "L" : "M") + x(p.y) + "," + z(p.v))
      .join(" ");
    s +=
      '<path d="' +
      line +
      '" fill="none" stroke="#2868bc" stroke-width="2"/>' +
      arr
        .map(
          (p) =>
            '<circle cx="' +
            x(p.y) +
            '" cy="' +
            z(p.v) +
            '" r="1.8" fill="#2868bc"><title>' +
            p.y +
            "年：" +
            p.v.toFixed(2) +
            "%（合成演示）</title></circle>",
        )
        .join("");
    for (const y of [...new Set([state.start, state.end])])
      s +=
        '<circle cx="' +
        x(y) +
        '" cy="' +
        z(value(state.region, y)) +
        '" r="4" fill="#fff" stroke="#245b7d" stroke-width="1.6"/>';
    s +=
      '<text x="' +
      Math.min(x(state.end), W - 49) +
      '" y="' +
      (z(value(state.region, state.end)) - 10) +
      '" font-size="11" fill="#245b7d">' +
      value(state.region, state.end).toFixed(2) +
      "%</text>";
    s +=
      '<line x1="' +
      L +
      '" x2="' +
      (W - R) +
      '" y1="' +
      (H - B) +
      '" y2="' +
      (H - B) +
      '" stroke="#9eabb5"/><text x="' +
      L +
      '" y="14" font-size="10" fill="#506471">覆盖比例（%）</text><text x="300" y="240" font-size="10" text-anchor="middle" fill="#74838d">年份 · 合成演示</text>';
    updateSVG(
      "trend",
      '<svg id="trendSVG" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        W +
        " " +
        H +
        '" role="img" aria-label="' +
        name(state.region) +
        '年度趋势（合成演示）" font-family="Microsoft YaHei, sans-serif"><title>' +
        name(state.region) +
        ' · 合成演示，非实际数据</title><rect width="' +
        W +
        '" height="' +
        H +
        '" fill="white"/>' +
        s +
        "</svg>",
    );
  }
  function rankings() {
    const arr = ids
      .map((id) => ({ id, v: D.change(id, state.start, state.end, ids) }))
      .sort((a, b) => (state.sort === "desc" ? b.v - a.v : a.v - b.v))
      .slice(0, 8);
    const lo = Math.min(
        0,
        Math.floor(Math.min(...arr.map((a) => a.v)) / 2) * 2,
      ),
      hi = Math.max(2, Math.ceil(Math.max(...arr.map((a) => a.v)) / 2) * 2),
      L = 56,
      R = 282,
      T = 23,
      H = 265,
      x = (v) => L + ((v - lo) / (hi - lo)) * (R - L);
    let s =
      '<rect x="' +
      L +
      '" y="12" width="' +
      (R - L) +
      '" height="213" fill="#f3f5f6"/>';
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4;
      s +=
        '<line x1="' +
        x(v) +
        '" x2="' +
        x(v) +
        '" y1="12" y2="225" stroke="#fff" stroke-width="1.4"/><text x="' +
        x(v) +
        '" y="240" text-anchor="middle" fill="#6a7984" font-size="10">' +
        v.toFixed(1) +
        "</text>";
    }
    s +=
      '<line x1="' +
      x(0) +
      '" x2="' +
      x(0) +
      '" y1="12" y2="225" stroke="#8c9ba6" stroke-width="1"/>';
    s += arr
      .map((a, i) => {
        const y = T + i * 27,
          c = a.v < 0 ? "#b2572d" : "#2868bc";
        return (
          '<g class="rank-row" data-id="' +
          a.id +
          '" tabindex="0" role="button" aria-label="' +
          name(a.id) +
          "，变化" +
          signed(a.v) +
          '个百分点（合成演示）"><rect x="0" y="' +
          (y - 11) +
          '" width="340" height="25" fill="transparent"/><line x1="' +
          L +
          '" x2="' +
          R +
          '" y1="' +
          y +
          '" y2="' +
          y +
          '" stroke="#fff"/><text x="' +
          (L - 8) +
          '" y="' +
          (y + 4) +
          '" text-anchor="end" font-size="11" fill="#495e6d">' +
          shortName(a.id) +
          '</text><line x1="' +
          x(0) +
          '" x2="' +
          x(a.v) +
          '" y1="' +
          y +
          '" y2="' +
          y +
          '" stroke="' +
          c +
          '" stroke-width="2"/><circle class="rank-dot" cx="' +
          x(a.v) +
          '" cy="' +
          y +
          '" r="4" fill="' +
          c +
          '"/><text x="334" y="' +
          (y + 4) +
          '" text-anchor="end" font-size="10" fill="#526b7b">' +
          signed(a.v) +
          "</text></g>"
        );
      })
      .join("");
    s +=
      '<text x="170" y="261" font-size="10" text-anchor="middle" fill="#6a7984">变化（百分点） · 合成演示</text>';
    $("ranking").innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 ' +
      H +
      '" role="img" aria-label="区域变化比较，合成演示数据">' +
      s +
      "</svg>";
    document.querySelectorAll(".rank-row").forEach((el) => {
      el.onclick = () => selectRegion(el.dataset.id);
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectRegion(el.dataset.id);
        }
      };
    });
  }
  mountComposition();
  matchMedia("(max-width: 600px)").addEventListener("change", () => render(), {
    signal: ctx.signal,
  });
  function render() {
    $("compositionSubtitle").textContent =
      state.end + "年 · " + name(state.region) + " · 合成演示";
    drawComposition(
      value(state.region, state.end),
      state.end + "年 · 合成演示",
    );
    $("start").value = state.start;
    $("end").value = state.end;
    $("yearSlider").min = state.start;
    $("yearSlider").value = state.end;
    $("sliderYear").textContent = state.end;
    $("sliderStart").textContent = state.start;
    $("yearSlider").style.setProperty(
      "--progress",
      ((state.end - state.start) / Math.max(1, 2025 - state.start)) * 100 + "%",
    );
    [...$("end").options].forEach(
      (o) => (o.disabled = Number(o.value) < state.start),
    );
    $("regionTitle").textContent = name(state.region);
    animateNumber("rate", value(state.region, state.end), "%");
    animateNumber(
      "delta",
      D.change(state.region, state.start, state.end, ids),
      "个百分点",
      true,
    );
    $("deltaNote").textContent = state.start + "—" + state.end + " · 合成演示";
    $("mapTitle").textContent =
      state.mode === "rate"
        ? state.end + "年森林覆盖比例"
        : state.start + "—" + state.end + "年森林覆盖变化";
    $("mapSubtitle").textContent =
      "省级概览 · " +
      (state.mode === "rate" ? "覆盖比例（%）" : "变化（百分点）") +
      " · 合成演示";
    $("trendSubtitle").textContent = name(state.region) + " · 1990—2025";
    $("rankingPeriod").textContent = state.start + "—" + state.end + "年";
    updateSVG("map", mapSVG(state.end));
    $("mapLegend").innerHTML =
      state.mode === "rate"
        ? '覆盖比例（%）<div class="legend-scale"></div><div class="legend-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>'
        : '变化（百分点）<div class="legend-scale" style="background:linear-gradient(90deg,#b2572d,#f7f7f7,#2166ac)"></div><div class="legend-ticks"><span>−16</span><span>−8</span><span>0</span><span>+8</span><span>+16</span></div>';
    for (const [id, mode] of [
      ["rateMode", "rate"],
      ["changeMode", "change"],
    ]) {
      $(id).classList.toggle("selected", state.mode === mode);
      $(id).setAttribute("aria-pressed", String(state.mode === mode));
    }
    $("compareStart").textContent = state.start + "年";
    $("compareEnd").textContent = state.end + "年";
    updateSVG("miniStart", mapSVG(state.start, true));
    updateSVG("miniEnd", mapSVG(state.end, true));
    bindMap();
    trend();
    rankings();
  }
  function stop() {
    $("playbackPanel").classList.remove("is-playing");
    ctx.clearInterval(timer);
    timer = null;
    $("playBtn").textContent = "▶";
    $("playBtn").setAttribute("aria-label", "播放年份");
  }
  function setEnd(y) {
    state.end = y;
    render();
  }
  function reset() {
    stop();
    Object.assign(state, {
      region: "all",
      start: 2000,
      end: 2025,
      mode: "rate",
      sort: "desc",
    });
    $("region").value = "all";
    $("sort").value = "desc";
    setDock(true);
    $("trendPanel").open = true;
    $("rankingPanel").open = false;
    $("comparison").open = false;
    render();
  }
  function exportCSV() {
    const rows = ["数据性质,区域,年份,合成覆盖比例百分数"];
    for (let y = state.start; y <= state.end; y++)
      rows.push(
        "合成演示非实际数据," +
          name(state.region) +
          "," +
          y +
          "," +
          value(state.region, y).toFixed(4),
      );
    download(
      "\ufeff" + rows.join("\r\n"),
      "text/csv;charset=utf-8",
      "合成示例_" +
        name(state.region) +
        "_" +
        state.start +
        "-" +
        state.end +
        ".csv",
    );
  }
  function init() {
    $("region").onchange = (e) => selectRegion(e.target.value);
    $("start").onchange = (e) => {
      stop();
      state.start = +e.target.value;
      state.end = Math.max(state.start, state.end);
      render();
    };
    $("end").onchange = (e) => {
      stop();
      setEnd(+e.target.value);
    };
    $("yearSlider").oninput = (e) => {
      stop();
      setEnd(+e.target.value);
    };
    $("sort").onchange = (e) => {
      state.sort = e.target.value;
      rankings();
    };
    $("rateMode").onclick = () => {
      state.mode = "rate";
      render();
    };
    $("changeMode").onclick = () => {
      state.mode = "change";
      render();
    };
    $("resetBtn").onclick = reset;
    $("dockToggle").onclick = () => setDock($("analysisDock").hidden);
    $("playBtn").onclick = () => {
      if (timer) {
        stop();
        return;
      }
      if (state.end >= 2025) state.end = state.start;
      render();
      $("playbackPanel").classList.add("is-playing");
      $("playBtn").textContent = "Ⅱ";
      $("playBtn").setAttribute("aria-label", "暂停播放");
      timer = ctx.interval(() => {
        if (state.end >= 2025) {
          stop();
          return;
        }
        setEnd(state.end + 1);
      }, 850);
    };
    $("sourceBtn").onclick = () => $("sourceDialog").showModal();
    $("closeDialog").onclick = () => $("sourceDialog").close();
    $("sourceDialog").onclick = (e) => {
      const r = $("sourceDialog").getBoundingClientRect();
      if (
        e.target === $("sourceDialog") &&
        (e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom)
      )
        $("sourceDialog").close();
    };
    $("exportBtn").onclick = exportCSV;
    $("chartExport").onclick = () =>
      download(
        $("trendSVG").outerHTML,
        "image/svg+xml",
        "合成示例_" + name(state.region) + "_趋势图.svg",
      );
    render();
  }
  init();
  const link = document.createElement("a");
  link.href = location.pathname;
  link.textContent = "返回真实数据接入页";
  document.querySelector(".site-header nav").prepend(link);
  return stop;
}
