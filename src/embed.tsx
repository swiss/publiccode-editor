// Runtime-loadable entry for hosts like opensource.admin.ch (issue #80):
// `const { mount } = await import(".../embed.js"); const unmount = mount(el, { lang });`
import i18n from "i18next";
import { createRoot } from "react-dom/client";
// shortcut: reactstrap is design-react-kit's dependency, not ours; add it to package.json if this import ever breaks.
import { Modal, Tooltip } from "reactstrap";
import App from "./app/App";
import { loadWasm } from "./app/validator";

// embed.js, embed.css, wasm_exec.js and main.wasm all sit at the root of the editor's dist.
// Hosts on another origin need CORS on embed.js, embed.css and main.wasm: GitHub Pages sends Access-Control-Allow-Origin: *,
// the nginx image in the Dockerfile sends nothing, so it can't serve the embed cross-origin as is.
const base = new URL(".", import.meta.url);

let wasm: Promise<unknown> | undefined;
const loadValidator = () =>
  (wasm ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("wasm_exec.js", base).href;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  }).then(() => loadWasm(base)));

async function loadStyles(...shadows: ShadowRoot[]) {
  const res = await fetch(new URL("embed.css", base));
  if (!res.ok) throw new Error(`embed.css: HTTP ${res.status}`);
  const css = await res.text();
  const sheet = new CSSStyleSheet();
  // bootstrap declares its CSS variables on :root, which matches nothing inside a shadow root.
  sheet.replaceSync(css.replace(/:root/g, ":host"));
  for (const shadow of shadows) shadow.adoptedStyleSheets = [sheet];

  // @font-face is ignored inside a shadow root, so the fonts go on the document.
  const fonts = new CSSStyleSheet();
  for (const rule of sheet.cssRules)
    if (rule instanceof CSSFontFaceRule) fonts.insertRule(rule.cssText);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, fonts];
  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== fonts,
    );
  };
}

// document.activeElement stops at a shadow host. reactstrap's Modal reads it to cycle Tab inside the
// dialog and to refocus the opening button on close, so hand it the element focused inside the shadow roots.
const deepActiveElement = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement)
    active = active.shadowRoot.activeElement;
  return active;
};
const modal = Modal.prototype as unknown as {
  init: () => void;
  getFocusedChild: () => Element | null;
  _triggeringElement: Element | null;
};
const init = modal.init;
modal.init = function () {
  init.call(this);
  this._triggeringElement = deepActiveElement();
};
modal.getFocusedChild = deepActiveElement;

export function mount(el: HTMLElement, { lang }: { lang: string }) {
  const shadow = el.shadowRoot ?? el.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadow.append(container);

  // Modals and tooltips get their own styled shadow root directly under <body>: inside the host's
  // layout, an ancestor with transform/filter/contain would turn their position: fixed into
  // "relative to that ancestor" and push the dialogs off-screen.
  const portalHost = document.createElement("div");
  const portalShadow = portalHost.attachShadow({ mode: "open" });
  const portal = document.createElement("div");
  portalShadow.append(portal);
  document.body.append(portalHost);
  // reactstrap portals to <body> itself by default, outside any shadow root and its styles.
  // Changing its defaults here keeps the editor's components identical to upstream.
  // shortcut: React 19 ignores defaultProps on function components (Tooltip); revisit on upgrade.
  for (const c of [Modal, Tooltip] as { defaultProps?: object }[])
    c.defaultProps = { ...c.defaultProps, container: portal };

  const root = createRoot(container);
  let unmounted = false;
  let removeFonts = () => {};

  loadValidator().catch((e) => console.error(`Failed to load Wasm: ${e}`));
  Promise.all([i18n.changeLanguage(lang), loadStyles(shadow, portalShadow)])
    .then(([, remove]) => {
      if (unmounted) return remove();
      removeFonts = remove;
      root.render(<App embedded portal={portal} />);
    })
    .catch((e) => console.error(`Failed to load the editor: ${e}`));

  return () => {
    unmounted = true;
    root.unmount();
    removeFonts();
    container.remove();
    portalHost.remove();
  };
}
