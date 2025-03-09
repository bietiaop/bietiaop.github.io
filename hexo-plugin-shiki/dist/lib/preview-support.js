var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var preview_support_exports = {};
__export(preview_support_exports, {
  addPreviewSupport: () => addPreviewSupport,
  default: () => preview_support_default
});
module.exports = __toCommonJS(preview_support_exports);
const addPreviewSupport = function(config) {
  if (!config || !config.enable) return;
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  };
  const createHtmlPreview = (code, container) => {
    const iframe = document.createElement("iframe");
    iframe.classList.add("preview-iframe");
    iframe.style.width = "100%";
    iframe.style.height = config.defaultHeight;
    iframe.style.border = "none";
    iframe.style.borderRadius = "5px";
    iframe.sandbox = "allow-scripts allow-same-origin";
    const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    container.appendChild(iframe);
    setTimeout(() => {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const hasHtmlTag = /<html.*?>[\s\S]*<\/html>/i.test(code);
        const hasBodyTag = /<body.*?>[\s\S]*<\/body>/i.test(code);
        let fullHtml = code;
        if (!hasHtmlTag) {
          const basicStyles = `
          <style>
            @media (prefers-color-scheme: dark) {
              body { background-color: #1a1a1a; color: #e1e4e8; }
            }
          </style>`;
          if (!hasBodyTag) {
            fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  ${basicStyles}
</head>
<body>
${code}
</body>
</html>`;
          } else {
            fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  ${basicStyles}
</head>
${code}
</html>`;
          }
        }
        try {
          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow) {
            iframeWindow.onerror = function(msg, url, line) {
              console.error(`HTML\u9884\u89C8\u9519\u8BEF: ${msg} at line ${line}`);
              return true;
            };
          }
        } catch (error) {
          console.error("Error writing to iframe:", error);
          container.innerHTML = `<div class="preview-error">\u9884\u89C8\u9519\u8BEF: ${error.message}</div>`;
        }
      }
    }, 100);
  };
  const createReactPreview = async (code, container, lang) => {
    try {
      await Promise.all([
        loadScript(config.reactRuntime),
        loadScript(config.reactDomRuntime),
        loadScript(config.babelRuntime)
      ]);
    } catch (error) {
      console.error("Failed to load React preview dependencies:", error);
      container.innerHTML = '<div class="preview-error">Failed to load React dependencies</div>';
      return;
    }
    const reactRoot = document.createElement("div");
    reactRoot.className = "react-preview-root";
    container.appendChild(reactRoot);
    const previewContainer = document.createElement("div");
    previewContainer.className = "react-preview-container";
    previewContainer.style.minHeight = config.defaultHeight;
    previewContainer.style.padding = "1rem";
    reactRoot.appendChild(previewContainer);
    try {
      let processedCode = window["Babel"].transform(code, {
        presets: ["react"],
        filename: `preview.${lang}`
      }).code;
      const executeCode = new Function(
        "React",
        "ReactDOM",
        "container",
        `
        try {
          ${processedCode}
          
          // \u5C1D\u8BD5\u67E5\u627E\u5BFC\u51FA\u7684\u7EC4\u4EF6
          let Component;
          if (typeof App !== 'undefined') {
            Component = App;
          } else if (typeof default_1 !== 'undefined') {
            Component = default_1;
          } else if (typeof exports !== 'undefined' && exports.default) {
            Component = exports.default;
          }
          
          // \u5982\u679C\u627E\u5230\u7EC4\u4EF6\uFF0C\u6E32\u67D3\u5B83
          if (Component) {
            ReactDOM.render(React.createElement(Component), container);
          }
        } catch (error) {
          container.innerHTML = '<div class="preview-error">' + error.toString() + '</div>';
          console.error('React preview error:', error);
        }
        `
      );
      executeCode(window["React"], window["ReactDOM"], previewContainer);
    } catch (error) {
      console.error("Failed to execute React code:", error);
      previewContainer.innerHTML = `<div class="preview-error">${error.toString()}</div>`;
    }
  };
  const addPreviewButton = () => {
    const previewableBlocks = document.querySelectorAll(
      'figure.shiki[data-preview="true"]'
    );
    previewableBlocks.forEach((block) => {
      const tools = block.querySelector(".shiki-tools");
      if (!tools) return;
      const previewLang = block.getAttribute("data-preview-lang");
      const encodedCode = block.getAttribute("data-preview-code");
      if (!encodedCode) return;
      const code = atob(encodedCode);
      const previewButton = document.createElement("i");
      previewButton.className = "fas fa-play preview-button";
      previewButton.title = "\u9884\u89C8\u4EE3\u7801";
      previewButton.addEventListener("click", (e) => {
        e.stopPropagation();
        let previewArea = document.getElementById(
          `preview-${block.id}`
        );
        if (!block.id) {
          block.id = "code-block-" + Math.random().toString(36).substring(2, 9);
        }
        if (previewArea) {
          previewArea.style.display = previewArea.style.display === "none" ? "block" : "none";
          return;
        }
        previewArea = document.createElement("div");
        previewArea.className = "code-preview-area";
        previewArea.id = `preview-${block.id}`;
        const previewTitle = document.createElement("div");
        previewTitle.className = "preview-title";
        previewTitle.innerHTML = '<i class="fas fa-code"></i> \u4EE3\u7801\u9884\u89C8\uFF08code preview\uFF09';
        previewArea.appendChild(previewTitle);
        block.parentNode.insertBefore(previewArea, block.nextSibling);
        if (previewLang === "html" || previewLang === "htm") {
          createHtmlPreview(code, previewArea);
        } else if (["jsx", "tsx", "react"].includes(previewLang)) {
          createReactPreview(code, previewArea, previewLang);
        }
      });
      tools.appendChild(previewButton);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addPreviewButton);
  } else {
    addPreviewButton();
  }
};
var preview_support_default = addPreviewSupport;
