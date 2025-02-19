export interface CodeConfig {
  highlightCopy: boolean;
  highlightLang: boolean;
  highlightHeightLimit: number;
  isHighlightShrink: boolean;
  copy: {
    success: string;
    error: string;
    noSupport: string;
  };
}
const addHighlightTool = function (code_config: CodeConfig) {
  const isHidden = (ele: HTMLElement) =>
    ele.offsetHeight === 0 && ele.offsetWidth === 0;

  // 替换原有局部配置，使用全局配置，并提供默认值
  const config = code_config || {
    highlightCopy: true,
    highlightLang: true, // 如需要显示语言名称
    highlightHeightLimit: 300, // 可选：代码块高度达到此值时显示展开按钮
    isHighlightShrink: true,
    copy: {
      success: '复制成功！',
      error: '复制出错！',
      noSupport: '当前浏览器不支持复制',
    },
  };

  // 使用全局配置或默认配置
  const { highlightCopy, highlightLang, highlightHeightLimit } = config;
  const isHighlightShrink = config.isHighlightShrink;
  const isShowTool =
    highlightCopy || highlightLang || isHighlightShrink !== undefined;
  const $figureHighlight: NodeListOf<HTMLElement> =
    document.querySelectorAll('figure.shiki');
  if (!((isShowTool || highlightHeightLimit) && $figureHighlight.length))
    return;

  const highlightShrinkClass = isHighlightShrink === true ? 'closed' : '';
  const highlightShrinkEle =
    isHighlightShrink !== undefined
      ? `<i class="fas fa-angle-down expand ${highlightShrinkClass}"></i>`
      : '';
  const highlightCopyEle = highlightCopy
    ? '<div class="copy-notice"></div><i class="fas fa-paste copy-button" title="Copy Code"></i>'
    : '';

  const copy = async (text: string, ctx: HTMLElement) => {
    const showMsg = (msg: string) => {
      const prevEle = ctx.previousElementSibling as HTMLElement;
      prevEle.textContent = msg;
      prevEle.style.opacity = '1';
      setTimeout(() => {
        prevEle.style.opacity = '0';
      }, 700);
    };
    if (
      document.queryCommandSupported &&
      document.queryCommandSupported('copy')
    ) {
      document.execCommand('copy');
      showMsg(config.copy.success);
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        showMsg(config.copy.success);
      } catch {
        showMsg(config.copy.error);
      }
    } else {
      showMsg(config.copy.noSupport);
    }
  };

  const highlightCopyFn = function (this: HTMLElement, ele: HTMLElement) {
    const $buttonParent = ele.parentNode as HTMLElement;
    $buttonParent.classList.add('copy-true');
    const selection = window.getSelection();
    const range = document.createRange();
    const preCodeSelector = 'div.codeblock .code pre';
    const preEle = $buttonParent.querySelector(preCodeSelector);
    if (!preEle) return;
    range.selectNodeContents(preEle);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const text = selection?.toString() || '';
    copy(text, ele.lastElementChild as HTMLElement);
    selection?.removeAllRanges();
    $buttonParent.classList.remove('copy-true');
  };

  const highlightShrinkFn = function (this: HTMLElement, ele: HTMLElement) {
    const siblings = Array.from(ele.parentNode!.children).slice(
      1
    ) as HTMLElement[];
    (ele.firstElementChild as HTMLElement).classList.toggle('closed');
    if (isHidden(siblings[siblings.length - 1])) {
      siblings.forEach(e => {
        e.style.display = 'flex';
      });
    } else {
      siblings.forEach(e => {
        e.style.display = 'none';
      });
    }
  };

  const highlightToolsFn = function (this: HTMLElement, e: Event) {
    const target = (e.target as HTMLElement).classList;
    if (target.contains('expand')) {
      highlightShrinkFn.call(this, this);
    } else if (target.contains('copy-button')) {
      highlightCopyFn.call(this, this);
    }
  };

  const expandCode = function (this: HTMLElement) {
    this.classList.toggle('expand-done');
  };

  function createEle(lang: string, item: HTMLElement, service: string) {
    const fragment = document.createDocumentFragment();
    if (isShowTool) {
      const hlTools = document.createElement('div');
      hlTools.className = `shiki-tools ${highlightShrinkClass}`;
      hlTools.innerHTML = highlightShrinkEle + lang + highlightCopyEle;
      hlTools.addEventListener('click', highlightToolsFn);
      fragment.appendChild(hlTools);
    }
    if (highlightHeightLimit && item.offsetHeight > highlightHeightLimit + 30) {
      const ele = document.createElement('div');
      ele.className = 'code-expand-btn';
      ele.innerHTML = '<i class="fas fa-angle-double-down"></i>';
      ele.addEventListener('click', expandCode);
      fragment.appendChild(ele);
    }
    if (service === 'hl') {
      item.insertBefore(fragment, item.firstChild);
    } else {
      item.parentNode!.insertBefore(fragment, item);
    }
  }

  $figureHighlight.forEach(function (item) {
    if (highlightLang) {
      let langName = item.getAttribute('class')?.split(' ')[1] || '';
      if (langName === 'plain' || langName === '') langName = 'PlainText';
      const highlightLangEle = `<div class="code-lang">${langName}</div>`;
      createEle(highlightLangEle, item, 'hl');
    } else {
      createEle('', item, 'hl');
    }
  });
};

export default addHighlightTool;
