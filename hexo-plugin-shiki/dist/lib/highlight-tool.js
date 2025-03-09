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
var highlight_tool_exports = {};
__export(highlight_tool_exports, {
  default: () => highlight_tool_default
});
module.exports = __toCommonJS(highlight_tool_exports);
const addHighlightTool = function(code_config) {
  const isHidden = (ele) => ele.offsetHeight === 0 && ele.offsetWidth === 0;
  const config = code_config || {
    highlightCopy: true,
    highlightLang: true,
    // 如需要显示语言名称
    highlightHeightLimit: 300,
    // 可选：代码块高度达到此值时显示展开按钮
    isHighlightShrink: true,
    copy: {
      success: "\u590D\u5236\u6210\u529F\uFF01",
      error: "\u590D\u5236\u51FA\u9519\uFF01",
      noSupport: "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u590D\u5236"
    }
  };
  const { highlightCopy, highlightLang, highlightHeightLimit } = config;
  const isHighlightShrink = config.isHighlightShrink;
  const isShowTool = highlightCopy || highlightLang || isHighlightShrink !== void 0;
  const $figureHighlight = document.querySelectorAll("figure.shiki");
  if (!((isShowTool || highlightHeightLimit) && $figureHighlight.length))
    return;
  const highlightShrinkClass = isHighlightShrink === true ? "closed" : "";
  const highlightShrinkEle = isHighlightShrink !== void 0 ? `<i class="fas fa-angle-down expand ${highlightShrinkClass}"></i>` : "";
  const highlightCopyEle = highlightCopy ? '<div class="copy-notice"></div><i class="fas fa-paste copy-button" title="Copy Code"></i>' : "";
  const copy = async (text, ele) => {
    const copyNotice = ele.parentElement?.querySelector(
      ".copy-notice"
    );
    if (!copyNotice) {
      console.error("Cannot find copy notice element");
      return;
    }
    let success = false;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          success = document.execCommand("copy");
        } catch (err) {
          console.error("Failed to copy: ", err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Copy failed: ", err);
    }
    copyNotice.textContent = success ? config.copy.success : navigator.clipboard ? config.copy.error : config.copy.noSupport;
    copyNotice.style.opacity = "1";
    copyNotice.style.display = "block";
    setTimeout(() => {
      copyNotice.style.opacity = "0";
      setTimeout(() => {
        copyNotice.style.display = "none";
      }, 400);
    }, 2e3);
  };
  const highlightCopyFn = function(ele) {
    const codeBlock = ele.closest("figure.shiki");
    if (!codeBlock) return;
    const pre = codeBlock.querySelector(".code pre");
    if (!pre) return;
    const text = pre.textContent || "";
    if (!text) return;
    copy(text, ele);
  };
  const highlightShrinkFn = function(ele) {
    const figureContainer = this.closest("figure.shiki");
    if (!figureContainer) return;
    const expandIcon = this.querySelector(".expand");
    if (!expandIcon) return;
    const isClosed = expandIcon.classList.contains("closed");
    if (isClosed) {
      expandIcon.classList.remove("closed");
    } else {
      expandIcon.classList.add("closed");
    }
    const codeblock = figureContainer.querySelector(
      ".codeblock"
    );
    const expandBtn = figureContainer.querySelector(
      ".code-expand-btn"
    );
    if (expandIcon.classList.contains("closed")) {
      if (codeblock) codeblock.style.display = "none";
      if (expandBtn) expandBtn.style.display = "none";
    } else {
      if (codeblock) codeblock.style.display = "flex";
      if (expandBtn) expandBtn.style.display = "flex";
    }
  };
  const highlightToolsFn = function(e) {
    e.stopPropagation();
    const target = e.target;
    console.log("Click target:", target.className);
    if (target.classList.contains("expand")) {
      highlightShrinkFn.call(this, target);
    } else if (target.classList.contains("copy-button")) {
      highlightCopyFn.call(this, target);
    }
  };
  const expandCode = function() {
    this.classList.toggle("expand-done");
    const codeblock = this.nextElementSibling || this.nextElementSibling?.nextElementSibling;
    const previewArea = this.parentElement?.querySelector(
      ".code-preview-area"
    );
    if (previewArea) {
      const wasVisible = previewArea.style.display !== "none";
      if (wasVisible) {
        setTimeout(() => {
          previewArea.style.display = "block";
        }, 0);
      }
    }
  };
  function createEle(lang, item, service) {
    const fragment = document.createDocumentFragment();
    if (isShowTool) {
      const hlTools = document.createElement("div");
      hlTools.className = "shiki-tools";
      const iconClass = isHighlightShrink === true ? "fas fa-angle-down expand closed" : "fas fa-angle-down expand";
      hlTools.innerHTML = `<i class="${iconClass}"></i>` + lang + highlightCopyEle;
      hlTools.addEventListener("click", function(e) {
        const target = e.target;
        if (target.classList.contains("expand")) {
          e.stopPropagation();
          const expandIcon = target.classList.contains("expand") ? target : target.querySelector(".expand");
          if (!expandIcon) return;
          expandIcon.classList.toggle("closed");
          const figure = hlTools.closest("figure.shiki");
          if (!figure) return;
          const codeblock = figure.querySelector(".codeblock");
          const expandBtn = figure.querySelector(
            ".code-expand-btn"
          );
          if (expandIcon.classList.contains("closed")) {
            if (codeblock) codeblock.style.display = "none";
            if (expandBtn) expandBtn.style.display = "none";
          } else {
            if (codeblock) codeblock.style.display = "flex";
            if (expandBtn) {
              expandBtn.style.display = highlightHeightLimit && figure.offsetHeight > highlightHeightLimit + 30 ? "flex" : "none";
            }
          }
        } else if (target.classList.contains("copy-button")) {
          e.stopPropagation();
          highlightCopyFn.call(hlTools, target);
        }
      });
      fragment.appendChild(hlTools);
      if (isHighlightShrink === true) {
        setTimeout(() => {
          const codeblock = item.querySelector(".codeblock");
          const expandBtn = item.querySelector(
            ".code-expand-btn"
          );
          if (codeblock) codeblock.style.display = "none";
          if (expandBtn) expandBtn.style.display = "none";
        }, 0);
      }
    }
    if (highlightHeightLimit && item.offsetHeight > highlightHeightLimit + 30) {
      const ele = document.createElement("div");
      ele.className = "code-expand-btn";
      ele.innerHTML = '<i class="fas fa-angle-double-down"></i>';
      ele.addEventListener("click", expandCode);
      fragment.appendChild(ele);
    }
    if (service === "hl") {
      item.insertBefore(fragment, item.firstChild);
    } else {
      item.parentNode.insertBefore(fragment, item);
    }
  }
  $figureHighlight.forEach(function(item) {
    if (highlightLang) {
      let langName = item.getAttribute("class")?.split(" ")[1] || "";
      if (langName === "plain" || langName === "") langName = "PlainText";
      const highlightLangEle = `<div class="code-lang">${langName}</div>`;
      createEle(highlightLangEle, item, "hl");
    } else {
      createEle("", item, "hl");
    }
  });
};
var highlight_tool_default = addHighlightTool;
