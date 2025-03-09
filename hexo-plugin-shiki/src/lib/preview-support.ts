export interface PreviewConfig {
  enable: boolean;
  html: boolean;
  react: boolean;
  defaultHeight: string;
  reactRuntime: string;
  reactDomRuntime: string;
  babelRuntime: string;
}

export const addPreviewSupport = function (config: PreviewConfig) {
  if (!config || !config.enable) return;

  // 加载必要的脚本
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  };

  // 创建HTML预览 - 简化版本，不添加默认样式
  const createHtmlPreview = (code: string, container: HTMLElement) => {
    const iframe = document.createElement('iframe');
    iframe.classList.add('preview-iframe');
    iframe.style.width = '100%';
    iframe.style.height = config.defaultHeight;
    iframe.style.border = 'none';
    iframe.style.borderRadius = '5px';
    iframe.sandbox = 'allow-scripts allow-same-origin';

    // 检测当前页面的颜色方案
    const isDarkMode =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    container.appendChild(iframe);

    // 给iframe写入内容
    setTimeout(() => {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        // 检查代码是否已经包含完整的HTML结构
        const hasHtmlTag = /<html.*?>[\s\S]*<\/html>/i.test(code);
        const hasBodyTag = /<body.*?>[\s\S]*<\/body>/i.test(code);

        // 准备完整的HTML文档 - 但不添加额外样式
        let fullHtml = code;

        if (!hasHtmlTag) {
          // 添加颜色方案支持的基本样式
          const basicStyles = `
          <style>
            @media (prefers-color-scheme: dark) {
              body { background-color: #1a1a1a; color: #e1e4e8; }
            }
          </style>`;

          if (!hasBodyTag) {
            // 只添加最基本的HTML结构
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
            // 只包装html标签和头部
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

        // 确保内容正确写入
        try {
          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();

          // 添加错误处理
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow) {
            iframeWindow.onerror = function (msg, url, line) {
              console.error(`HTML预览错误: ${msg} at line ${line}`);
              return true;
            };
          }
        } catch (error) {
          console.error('Error writing to iframe:', error);
          container.innerHTML = `<div class="preview-error">预览错误: ${error.message}</div>`;
        }
      }
    }, 100);
  };

  // 创建React预览
  const createReactPreview = async (
    code: string,
    container: HTMLElement,
    lang: string
  ) => {
    // 加载React相关库
    try {
      await Promise.all([
        loadScript(config.reactRuntime),
        loadScript(config.reactDomRuntime),
        loadScript(config.babelRuntime),
      ]);
    } catch (error) {
      console.error('Failed to load React preview dependencies:', error);
      container.innerHTML =
        '<div class="preview-error">Failed to load React dependencies</div>';
      return;
    }

    // 创建React容器
    const reactRoot = document.createElement('div');
    reactRoot.className = 'react-preview-root';
    container.appendChild(reactRoot);

    // 创建预览容器 - 修改为使用CSS变量而非硬编码颜色
    const previewContainer = document.createElement('div');
    previewContainer.className = 'react-preview-container';
    previewContainer.style.minHeight = config.defaultHeight;
    previewContainer.style.padding = '1rem';
    // 移除硬编码样式，使用CSS类和CSS变量
    reactRoot.appendChild(previewContainer);

    try {
      // 使用Babel转换JSX代码
      let processedCode = window['Babel'].transform(code, {
        presets: ['react'],
        filename: `preview.${lang}`,
      }).code;

      // 创建安全的执行环境
      const executeCode = new Function(
        'React',
        'ReactDOM',
        'container',
        `
        try {
          ${processedCode}
          
          // 尝试查找导出的组件
          let Component;
          if (typeof App !== 'undefined') {
            Component = App;
          } else if (typeof default_1 !== 'undefined') {
            Component = default_1;
          } else if (typeof exports !== 'undefined' && exports.default) {
            Component = exports.default;
          }
          
          // 如果找到组件，渲染它
          if (Component) {
            ReactDOM.render(React.createElement(Component), container);
          }
        } catch (error) {
          container.innerHTML = '<div class="preview-error">' + error.toString() + '</div>';
          console.error('React preview error:', error);
        }
        `
      );

      executeCode(window['React'], window['ReactDOM'], previewContainer);
    } catch (error) {
      console.error('Failed to execute React code:', error);
      previewContainer.innerHTML = `<div class="preview-error">${error.toString()}</div>`;
    }
  };

  // 添加预览按钮和功能
  const addPreviewButton = () => {
    // 查找所有标记为可预览的代码块
    const previewableBlocks = document.querySelectorAll(
      'figure.shiki[data-preview="true"]'
    );

    previewableBlocks.forEach(block => {
      const tools = block.querySelector('.shiki-tools');
      if (!tools) return;

      const previewLang = block.getAttribute('data-preview-lang');
      const encodedCode = block.getAttribute('data-preview-code');
      if (!encodedCode) return;

      const code = atob(encodedCode);

      // 创建预览按钮
      const previewButton = document.createElement('i');
      previewButton.className = 'fas fa-play preview-button';
      previewButton.title = '预览代码';

      // 添加预览按钮点击事件
      previewButton.addEventListener('click', e => {
        // 阻止事件冒泡，确保不会触发父元素的点击事件
        e.stopPropagation();

        // 检查是否已存在预览区域
        let previewArea = document.getElementById(
          `preview-${block.id}`
        ) as HTMLElement | null;

        // 如果没有id，为代码块添加一个唯一id
        if (!block.id) {
          block.id = 'code-block-' + Math.random().toString(36).substring(2, 9);
        }

        if (previewArea) {
          // 如果已存在，则切换显示/隐藏
          previewArea.style.display =
            previewArea.style.display === 'none' ? 'block' : 'none';
          return;
        }

        // 创建预览区域 - 作为代码块的同级元素
        previewArea = document.createElement('div');
        previewArea.className = 'code-preview-area';
        previewArea.id = `preview-${block.id}`; // 设置唯一ID以便后续查找

        // 添加预览标题，添加Font Awesome图标
        const previewTitle = document.createElement('div');
        previewTitle.className = 'preview-title';
        previewTitle.innerHTML =
          '<i class="fas fa-code"></i> 代码预览（code preview）';
        previewArea.appendChild(previewTitle);

        // 将预览区域添加到代码块的后面，作为同级元素
        block.parentNode.insertBefore(previewArea, block.nextSibling);

        // 根据语言创建对应的预览
        if (previewLang === 'html' || previewLang === 'htm') {
          createHtmlPreview(code, previewArea);
        } else if (['jsx', 'tsx', 'react'].includes(previewLang)) {
          createReactPreview(code, previewArea, previewLang);
        }
      });

      tools.appendChild(previewButton);
    });
  };

  // 等待DOM加载完成后添加预览按钮
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addPreviewButton);
  } else {
    addPreviewButton();
  }
};

export default addPreviewSupport;
