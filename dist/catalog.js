import { $ } from "./ui.js";
export function mountCatalog(ctx, metadata) {
  const notice = document.querySelector(".data-notice");
  notice.innerHTML =
    '<strong>全国汇总</strong><span id="apiStatus">读取产品元数据…</span><button id="refreshAPI">检查公开接口</button><a href="?demo=1">查看界面样品</a>';
  const details = document.createElement("details");
  details.open = true;
  details.className = "api-details";
  details.innerHTML =
    '<summary>API连接状态<span class="collapse-symbol"></span></summary><div class="panel-content"><p id="apiChecked"></p><div id="apiProducts"></div><p class="panel-note">账户认证：未验证<br>全国任务：未提交<br>统计结果：未生成</p></div>';
  $("analysisDock").prepend(details);
  function showProducts(products, stamp, live) {
    $("apiStatus").textContent = live
      ? "公开产品API实时连接成功"
      : "显示已验证的产品元数据快照";
    $("apiChecked").textContent = (live ? "本次检查：" : "快照检查：") + stamp;
    $("apiProducts").replaceChildren();
    for (const p of products.filter((p) =>
      ["MCD12Q1.061", "MOD44B.061"].includes(p.ProductAndVersion),
    )) {
      const item = document.createElement("p");
      item.textContent =
        p.ProductAndVersion +
        "：" +
        p.TemporalExtentStart +
        "起；目录截止标记 " +
        p.TemporalExtentEnd;
      $("apiProducts").append(item);
    }
  }
  const snapshot = metadata;
  showProducts(
    snapshot.products,
    new Date(snapshot.checked_at).toLocaleString("zh-CN"),
    false,
  );
  async function refresh() {
    const b = $("refreshAPI");
    b.disabled = true;
    b.textContent = "连接中…";
    try {
      const r = await fetch(
        "https://appeears.earthdatacloud.nasa.gov/api/product?limit=1000",
        {
          signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(12000)]),
          credentials: "omit",
        },
      );
      if (!r.ok) throw Error("HTTP " + r.status);
      const products = await r.json();
      if (!Array.isArray(products)) throw Error("Invalid catalogue");
      if (!ctx.disposed)
        showProducts(products, new Date().toLocaleString("zh-CN"), true);
    } catch {
      if (ctx.disposed) return;
      $("apiStatus").textContent = "浏览器实时查询未成功；保留已验证元数据快照";
    } finally {
      if (!ctx.disposed) {
        b.disabled = false;
        b.textContent = "检查公开接口";
      }
    }
  }
  $("refreshAPI").onclick = refresh;
}
