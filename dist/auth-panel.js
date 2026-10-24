/* 本地密钥状态栏：仅当页面由本地启动器（tools/launcher.py）提供时出现。
   静态托管下 /api/auth/status 不可达，脚本不渲染任何内容。
   视图切换会替换 document.body.innerHTML，故在 forest:ready 后重新挂载。 */

const bar = document.createElement("section");
bar.className = "auth-bar";
bar.setAttribute("aria-live", "polite");

const form = document.createElement("form");
form.className = "auth-form";
form.hidden = true;
form.innerHTML = `
  <div class="auth-tabs" role="tablist" aria-label="密钥输入方式">
    <button type="button" role="tab" data-mode="password" aria-selected="true">账号密码</button>
    <button type="button" role="tab" data-mode="token" aria-selected="false">粘贴令牌</button>
  </div>
  <div class="auth-fields" data-mode="password">
    <label>Earthdata 用户名<input name="user" autocomplete="username" spellcheck="false"></label>
    <label>密码<input type="password" name="password" autocomplete="current-password"></label>
  </div>
  <div class="auth-fields" data-mode="token" hidden>
    <label>AppEEARS 令牌<input name="token" spellcheck="false"></label>
    <label>到期时间<input name="expiration" placeholder="2026-11-05T12:00:00Z"></label>
  </div>
  <p class="auth-hint">密码只在本次请求中使用，不写入磁盘；令牌用当前 Windows 用户 DPAPI 加密保存。页面不会把密钥发给除本机 127.0.0.1 以外的地址。</p>
  <p class="auth-feedback" role="status"></p>
  <div class="auth-actions">
    <button type="submit">登录并保存</button>
    <button type="button" class="plain" data-close>取消</button>
  </div>
`;

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );

const daysLeft = (iso) => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
};

const formatStamp = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function describe(status) {
  const expires = formatStamp(status.expires_at);
  const verified = formatStamp(status.verified_at);
  if (status.state === "valid") {
    const left = status.remaining_days ?? daysLeft(status.expires_at);
    return {
      headline: "AppEEARS 密钥",
      detail: `剩余 <b>${escapeHtml(left)}</b> 天 · <b>${escapeHtml(expires)}</b> 到期${
        verified ? ` · 上次验证 ${escapeHtml(verified)}` : ""
      }`,
      action: "更新密钥",
    };
  }
  if (status.state === "expired") {
    const overdue = Math.abs(
      status.remaining_days ?? daysLeft(status.expires_at) ?? 0,
    );
    return {
      headline: "AppEEARS 密钥",
      detail: `已过期 <b>${escapeHtml(overdue)}</b> 天 · <b>${escapeHtml(expires)}</b> 到期 · 需要重新登录`,
      action: "重新登录",
    };
  }
  return {
    headline: "AppEEARS 密钥",
    detail: "未配置 · 数据更新、任务查询与下载都需要先登录",
    action: "登录",
  };
}

function toggleForm(open) {
  form.hidden = !open;
  if (open) {
    form.querySelector("input").focus();
    form.querySelector(".auth-feedback").textContent = "";
  }
}

function draw(status) {
  const host = document.getElementById("authHost");
  const main = document.querySelector("main");
  if (!host || !main) return;
  const config = describe(status);
  bar.dataset.state = status.state;
  host.dataset.state = status.state;
  bar.innerHTML = `
    <span class="auth-dot" aria-hidden="true"></span>
    <div class="auth-text"><strong>${config.headline}</strong><span>${config.detail}</span></div>
    <button type="button" class="auth-action primary">${config.action}</button>
    <button type="button" class="plain auth-hide" aria-label="收起提示">收起</button>
  `;
  bar
    .querySelector(".auth-action")
    .addEventListener("click", () => toggleForm(true));
  bar.querySelector(".auth-hide").addEventListener("click", () => {
    bar.hidden = true;
    form.hidden = true;
  });
  form.hidden = true;
  host.replaceChildren(bar, form);
  host.hidden = false;
  main.classList.add("auth-shown");
}

async function request(path, payload) {
  const response = await fetch(path, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: "omit",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}

async function initAuth() {
  const host = document.getElementById("authHost");
  const main = document.querySelector("main");
  if (!host || !main) return;
  try {
    const status = await request("/api/auth/status");
    if (!status || status.state === "unavailable")
      throw new Error("unavailable");
    draw(status);
  } catch {
    host.remove();
    main.classList.remove("auth-shown");
  }
}

form.querySelectorAll(".auth-tabs button").forEach((tab) => {
  tab.addEventListener("click", () => {
    form.querySelectorAll(".auth-tabs button").forEach((item) => {
      item.setAttribute("aria-selected", String(item === tab));
    });
    form.querySelectorAll(".auth-fields").forEach((group) => {
      group.hidden = group.dataset.mode !== tab.dataset.mode;
    });
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = form.querySelector(".auth-feedback");
  const mode = form.querySelector(".auth-fields:not([hidden])").dataset.mode;
  const data = new FormData(form);
  feedback.dataset.kind = "pending";
  feedback.textContent =
    mode === "token" ? "正在校验令牌…" : "正在登录 Earthdata…";
  try {
    const status =
      mode === "token"
        ? await request("/api/auth/token", {
            token: data.get("token"),
            expiration: data.get("expiration") || null,
          })
        : await request("/api/auth/login", {
            username: data.get("user"),
            password: data.get("password"),
          });
    feedback.dataset.kind = "ok";
    feedback.textContent = "已保存到本机 Windows 凭据缓存。";
    form.reset();
    draw(status);
  } catch (error) {
    feedback.dataset.kind = "error";
    feedback.textContent = error.message;
  }
});

form.querySelector("[data-close]").addEventListener("click", () => {
  form.hidden = true;
});

document.addEventListener("forest:ready", initAuth);
initAuth();
