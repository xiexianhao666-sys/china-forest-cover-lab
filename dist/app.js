import { createContext, mountShell } from "./ui.js";
const shell = document.body.innerHTML;
let context,
  disposeView,
  generation = 0;
export function chooseMode(search, data) {
  const params = new URLSearchParams(search);
  if (params.get("demo") === "1") return "demo";
  if (params.get("mode") === "pending") return "pending";
  return data?.records?.length ? "real" : "pending";
}
export async function mountApp({
  search = location.search,
  data = window.FOREST_REAL_DATA,
  metadata = window.APPEEARS_METADATA,
} = {}) {
  const current = ++generation;
  disposeView?.();
  context?.destroy();
  const mode = chooseMode(search, data);
  const view = await import(
    mode === "demo"
      ? "./demo-view.js"
      : mode === "real"
        ? "./real-view.js"
        : "./api-mode.js"
  );
  if (current !== generation) return;
  document.body.innerHTML = shell;
  context = createContext();
  mountShell();
  document.body.dataset.mode = mode;
  disposeView =
    mode === "demo"
      ? view.mountDemo(context)
      : mode === "real"
        ? view.mountReal(context, data, metadata)
        : view.mountPending(context, metadata);
  document.dispatchEvent(new CustomEvent("forest:ready", { detail: { mode } }));
}
await mountApp();
