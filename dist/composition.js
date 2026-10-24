import { $, download } from "./ui.js";
export function mountComposition() {
  const panel = document.createElement("details");
  panel.id = "compositionPanel";
  panel.open = true;
  panel.innerHTML =
    '<summary>森林类面积构成<span class="collapse-symbol" aria-hidden="true"></span></summary><div class="panel-content"><div class="plot-toolbar"><span id="compositionSubtitle"></span><button id="pieExport">导出饼图</button></div><div id="composition"></div></div>';
  $("trendPanel").after(panel);
  $("pieExport").onclick = () =>
    download($("composition").innerHTML, "image/svg+xml", "森林类面积构成.svg");
}
export function drawComposition(share, label) {
  $("pieExport").disabled = !Number.isFinite(share);
  $("pieExport").title = "导出面积构成饼图";
  if (!Number.isFinite(share)) {
    $("composition").innerHTML =
      '<p class="api-empty">有效数据不足，暂不展示面积构成。</p>';
    return;
  }
  const angle = (share / 100) * Math.PI * 2;
  const x = 160 + 65 * Math.sin(angle);
  const y = 75 - 65 * Math.cos(angle);
  const sector =
    share === 100
      ? '<circle cx="160" cy="75" r="65" fill="#20704e"/>'
      : share === 0
        ? ""
        : `<path d="M160 75 L160 10 A65 65 0 ${share > 50 ? 1 : 0} 1 ${x} ${y} Z" fill="#20704e" stroke="white" stroke-width="2"><title>森林类 ${share.toFixed(2)}%</title></path>`;
  $("composition").innerHTML =
    `<svg class="share-pie" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="${label}森林类占比 ${share.toFixed(2)}%，其他有效分类 ${(100 - share).toFixed(2)}%">
      <circle cx="160" cy="75" r="65" fill="#d8e2e8"><title>其他有效分类（含水体） ${(100 - share).toFixed(2)}%</title></circle>${sector}
      <g font-size="13" fill="#263746">
        <rect x="14" y="157" width="12" height="12" fill="#20704e"/><text x="34" y="168">森林类（1—5类）</text><text x="306" y="168" text-anchor="end" font-weight="700">${share.toFixed(2)}%</text>
        <rect x="14" y="184" width="12" height="12" fill="#d8e2e8" stroke="#8a9da9"/><text x="34" y="195">其他有效分类（含水体）</text><text x="306" y="195" text-anchor="end">${(100 - share).toFixed(2)}%</text>
      </g></svg>`;
}
