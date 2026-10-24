export const $ = (id) => document.getElementById(id);
export const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
const signed = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
export function updateSVG(id, markup) {
  const host = $(id),
    template = document.createElement("template");
  template.innerHTML = markup;
  const next = template.content.firstElementChild;
  if (!host.firstElementChild) {
    host.append(next);
    return;
  }
  function sync(old, fresh) {
    if (old.nodeType !== fresh.nodeType || old.nodeName !== fresh.nodeName) {
      old.replaceWith(fresh.cloneNode(true));
      return;
    }
    if (old.nodeType !== 1) {
      if (old.nodeValue !== fresh.nodeValue) old.nodeValue = fresh.nodeValue;
      return;
    }
    for (const attr of [...old.attributes])
      if (!fresh.hasAttribute(attr.name)) old.removeAttribute(attr.name);
    for (const attr of fresh.attributes)
      if (old.getAttribute(attr.name) !== attr.value)
        old.setAttribute(attr.name, attr.value);
    const a = [...old.childNodes],
      b = [...fresh.childNodes];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (!a[i]) old.append(b[i].cloneNode(true));
      else if (!b[i]) a[i].remove();
      else sync(a[i], b[i]);
    }
  }
  sync(host.firstElementChild, next);
}
export function setDock(visible) {
  $("analysisDock").hidden = !visible;
  $("overview").classList.toggle("dock-hidden", !visible);
  $("dockToggle").textContent = visible ? "收起分析面板" : "展开分析面板";
  $("dockToggle").setAttribute("aria-expanded", String(visible));
}
export function download(content, type, file) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createContext() {
  const controller = new AbortController(),
    timers = new Set(),
    intervals = new Set(),
    numberFrames = new Map();
  let disposed = false;
  function animateNumber(id, target, unit, withSign = false) {
    const el = $(id);
    cancelAnimationFrame(numberFrames.get(id));
    const from = Number(el.dataset.current ?? target),
      start = performance.now();
    const paint = (n) => {
      el.dataset.current = n;
      el.innerHTML =
        (withSign ? signed(n) : n.toFixed(2)) + "<em>" + unit + "</em>";
    };
    if (reducedMotion.matches || from === target) {
      paint(target);
      return;
    }
    const frame = (now) => {
      const t = Math.min(1, (now - start) / 650);
      paint(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) numberFrames.set(id, requestAnimationFrame(frame));
      else numberFrames.delete(id);
    };
    numberFrames.set(id, requestAnimationFrame(frame));
  }

  return {
    animateNumber,
    signal: controller.signal,
    get disposed() {
      return disposed;
    },
    timeout(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, ms);
      timers.add(id);
      return id;
    },
    interval(fn, ms) {
      const id = setInterval(() => {
        if (!disposed) fn();
      }, ms);
      intervals.add(id);
      return id;
    },
    clearInterval(id) {
      clearInterval(id);
      intervals.delete(id);
    },
    destroy() {
      disposed = true;
      controller.abort();
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      numberFrames.forEach(cancelAnimationFrame);
    },
  };
}
export function mountShell() {
  $("dockToggle").onclick = () => setDock($("analysisDock").hidden);
  $("sourceBtn").onclick = () => $("sourceDialog").showModal();
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
}
export function prepareDataLayout() {
  for (const el of document.querySelectorAll(
    ".toolbar select,.toolbar button,#exportBtn,#chartExport,#playBtn,#yearSlider,#sort",
  ))
    el.disabled = true;
  $("dockToggle").disabled = false;
  $("chartExport").hidden = true;
  document.querySelector(".plot-caption").hidden = true;
  $("rankingPanel").hidden = true;
  $("comparison").hidden = true;
  $("regionTitle").textContent = "全国";
  $("rate").textContent = "—";
  $("delta").textContent = "—";
}
