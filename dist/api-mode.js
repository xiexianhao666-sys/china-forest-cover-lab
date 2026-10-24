import { mountComposition, drawComposition } from "./composition.js";
import { $, prepareDataLayout } from "./ui.js";
import { boundaryMap } from "./map.js";
import { mountCatalog } from "./catalog.js";
export function mountPending(ctx, metadata) {
  document.title = "中国全国森林资源 · AppEEARS数据接入";
  document.querySelector("h1").textContent = "中国全国森林资源查询";
  document.querySelector(".edition").textContent = "AppEEARS · 接入中";
  prepareDataLayout();
  mountComposition();
  drawComposition(null, "待数据完成");
  $("region").innerHTML = "<option>中国 · 全国汇总</option>";
  for (const id of ["start", "end"])
    $(id).innerHTML = "<option>待确认</option>";
  $("rate").textContent = "—";
  $("delta").textContent = "—";
  $("regionTitle").textContent = "全国";
  $("deltaNote").textContent = "未生成真实统计";
  $("mapTitle").textContent = "全国研究范围";
  $("mapSubtitle").textContent = "仅展示边界 · 尚无森林覆盖统计图层";
  $("map").innerHTML = boundaryMap();
  $("mapLegend").textContent = "灰色：研究范围，非覆盖比例";
  $("trendSubtitle").textContent = "全国 · 等待真实年度数据";
  $("trend").innerHTML =
    '<div class="api-empty"><strong>尚未取得全国统计</strong><p>公开产品接口已接入。账户认证、全国区域提取与面积汇总完成后，才能生成年度曲线。</p></div>';
  $("chartExport").hidden = true;
  document.querySelector(".plot-caption").hidden = true;
  $("rankingPanel").hidden = false;
  $("comparison").hidden = false;
  $("sliderStart").textContent = "—";
  $("sliderYear").textContent = "—";
  document.querySelector(".playback-panel p").textContent =
    "真实年度序列生成后开放播放";
  document.querySelector(".map-footnote").innerHTML =
    "<span>范围示意边界 · 正式统计边界待核实</span><span>无演示数值参与真实结果</span>";
  document.querySelector("footer").innerHTML =
    "<span>AppEEARS全国接口 · 元数据已接入</span><span>认证任务与全国统计待完成</span>";
  mountCatalog(ctx, metadata);
  $("sourceDialog").innerHTML =
    '<div class="dialog-head"><h2>数据接入状态</h2><button id="closeApiDialog" aria-label="关闭">×</button></div><p>当前仅连通公开产品与图层接口，没有取得真实全国森林覆盖率。页面中的灰色地图只表示研究范围。</p><p>MCD12Q1从2001年开始，但目录的Present不是最新完整年度。逐年分类差异不宜直接作为真实森林变化；MOD44B树冠覆盖度也不同于森林面积比例。</p><p>下一步在本地程序登录Earthdata，确定正式研究边界、产品和统计口径。密码和令牌不进入网页。</p><p><a href="https://appeears.earthdatacloud.nasa.gov/api/" target="_blank" rel="noopener">NASA API文档</a> · <a href="https://lpdaac.usgs.gov/documents/1409/MCD12_User_Guide_V61.pdf" target="_blank" rel="noopener">产品用户指南</a></p>';
  $("closeApiDialog").onclick = () => $("sourceDialog").close();
}
