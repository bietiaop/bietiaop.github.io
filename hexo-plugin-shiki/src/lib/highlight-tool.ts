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

  const copy = async (text: string, ele: HTMLElement) => {
    // 直接查找相邻的提示元素
    const copyNotice = ele.parentElement?.querySelector(
      '.copy-notice'
    ) as HTMLElement;

    if (!copyNotice) {
      console.error('Cannot find copy notice element');
      return;
    }

    // 尝试复制文本
    let success = false;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else if (
        document.queryCommandSupported &&
        document.queryCommandSupported('copy')
      ) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed'; // 避免滚动到底部
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          success = document.execCommand('copy');
        } catch (err) {
          console.error('Failed to copy: ', err);
        }

        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Copy failed: ', err);
    }

    // 显示复制结果提示
    copyNotice.textContent = success
      ? config.copy.success
      : navigator.clipboard
      ? config.copy.error
      : config.copy.noSupport;

    // 强制设置样式，确保可见
    copyNotice.style.opacity = '1';
    copyNotice.style.display = 'block';

    // 延迟后隐藏提示
    setTimeout(() => {
      copyNotice.style.opacity = '0';
      setTimeout(() => {
        copyNotice.style.display = 'none';
      }, 400);
    }, 2000);
  };

  const highlightCopyFn = function (this: HTMLElement, ele: HTMLElement) {
    // 获取代码内容
    const codeBlock = ele.closest('figure.shiki');
    if (!codeBlock) return;

    const pre = codeBlock.querySelector('.code pre');
    if (!pre) return;

    // 获取文本并复制
    const text = pre.textContent || '';
    if (!text) return;

    copy(text, ele);
  };

  // 改进折叠函数：直接操作所有相关元素
  const highlightShrinkFn = function (this: HTMLElement, ele: HTMLElement) {
    // 获取当前代码块容器
    const figureContainer = this.closest('figure.shiki') as HTMLElement;
    if (!figureContainer) return;

    // 找到展开/折叠图标 - 确保我们获取的是正确的图标
    const expandIcon = this.querySelector('.expand') as HTMLElement;
    if (!expandIcon) return;

    // 检查当前状态
    const isClosed = expandIcon.classList.contains('closed');

    // 切换图标状态
    if (isClosed) {
      expandIcon.classList.remove('closed');
    } else {
      expandIcon.classList.add('closed');
    }

    // 获取需要折叠/展开的元素
    const codeblock = figureContainer.querySelector(
      '.codeblock'
    ) as HTMLElement;
    const expandBtn = figureContainer.querySelector(
      '.code-expand-btn'
    ) as HTMLElement;

    // 根据当前状态显示或隐藏元素
    if (expandIcon.classList.contains('closed')) {
      // 折叠状态
      if (codeblock) codeblock.style.display = 'none';
      if (expandBtn) expandBtn.style.display = 'none';
    } else {
      // 展开状态
      if (codeblock) codeblock.style.display = 'flex';
      if (expandBtn) expandBtn.style.display = 'flex';
    }
  };

  // 修复工具栏中的点击事件处理
  const highlightToolsFn = function (this: HTMLElement, e: Event) {
    e.stopPropagation(); // 阻止事件冒泡

    const target = e.target as HTMLElement;

    // 调试信息
    console.log('Click target:', target.className);

    if (target.classList.contains('expand')) {
      // 如果点击的是展开/折叠按钮
      highlightShrinkFn.call(this, target);
    } else if (target.classList.contains('copy-button')) {
      // 如果点击的是复制按钮
      highlightCopyFn.call(this, target);
    }
  };

  const expandCode = function (this: HTMLElement) {
    this.classList.toggle('expand-done');

    // 获取相关的代码块元素
    const codeblock =
      (this.nextElementSibling as HTMLElement) ||
      (this.nextElementSibling?.nextElementSibling as HTMLElement);

    // 确保预览区域不受影响
    const previewArea = this.parentElement?.querySelector(
      '.code-preview-area'
    ) as HTMLElement;
    if (previewArea) {
      // 保持预览区域的显示状态不变
      const wasVisible = previewArea.style.display !== 'none';
      if (wasVisible) {
        setTimeout(() => {
          previewArea.style.display = 'block';
        }, 0);
      }
    }
  };

  // 创建工具栏和其他元素的函数
  function createEle(lang: string, item: HTMLElement, service: string) {
    const fragment = document.createDocumentFragment();

    if (isShowTool) {
      const hlTools = document.createElement('div');
      hlTools.className = 'shiki-tools';

      // 设置展开/折叠图标，根据配置决定是否添加closed类
      const iconClass =
        isHighlightShrink === true
          ? 'fas fa-angle-down expand closed'
          : 'fas fa-angle-down expand';

      // 构建工具栏内容
      hlTools.innerHTML =
        `<i class="${iconClass}"></i>` + lang + highlightCopyEle;

      // 添加事件监听器，使用委托处理所有按钮
      hlTools.addEventListener('click', function (e) {
        const target = e.target as HTMLElement;

        if (target.classList.contains('expand')) {
          // 直接在这里处理折叠/展开
          e.stopPropagation();

          // 找到图标元素
          const expandIcon = target.classList.contains('expand')
            ? target
            : target.querySelector('.expand');

          if (!expandIcon) return;

          // 切换closed类
          expandIcon.classList.toggle('closed');

          // 获取需要切换显示的元素
          const figure = hlTools.closest('figure.shiki') as HTMLElement;
          if (!figure) return;

          const codeblock = figure.querySelector('.codeblock') as HTMLElement;
          const expandBtn = figure.querySelector(
            '.code-expand-btn'
          ) as HTMLElement;

          // 根据图标状态切换显示
          if (expandIcon.classList.contains('closed')) {
            // 折叠
            if (codeblock) codeblock.style.display = 'none';
            if (expandBtn) expandBtn.style.display = 'none';
          } else {
            // 展开
            if (codeblock) codeblock.style.display = 'flex';
            if (expandBtn) {
              expandBtn.style.display =
                highlightHeightLimit &&
                figure.offsetHeight > highlightHeightLimit + 30
                  ? 'flex'
                  : 'none';
            }
          }
        } else if (target.classList.contains('copy-button')) {
          e.stopPropagation();
          highlightCopyFn.call(hlTools, target);
        }
      });

      fragment.appendChild(hlTools);

      // 如果默认是折叠状态，在DOM插入完成后设置显示状态
      if (isHighlightShrink === true) {
        setTimeout(() => {
          const codeblock = item.querySelector('.codeblock') as HTMLElement;
          const expandBtn = item.querySelector(
            '.code-expand-btn'
          ) as HTMLElement;

          if (codeblock) codeblock.style.display = 'none';
          if (expandBtn) expandBtn.style.display = 'none';
        }, 0);
      }
    }

    // 创建展开按钮
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
