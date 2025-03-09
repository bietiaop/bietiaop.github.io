(function () {
  // 主题切换功能
  const THEME_KEY = 'preferred-theme';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';
  const THEME_AUTO = 'auto';

  // 创建主题切换按钮
  function createThemeSwitcher() {
    const themeSwitcher = document.createElement('div');
    themeSwitcher.className = 'theme-switcher';

    // 亮色模式按钮
    const lightBtn = document.createElement('button');
    lightBtn.className = 'theme-switcher-btn';
    lightBtn.id = 'theme-light';
    lightBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    lightBtn.title = '亮色模式';
    lightBtn.addEventListener('click', () => setTheme(THEME_LIGHT));

    // 暗色模式按钮
    const darkBtn = document.createElement('button');
    darkBtn.className = 'theme-switcher-btn';
    darkBtn.id = 'theme-dark';
    darkBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    darkBtn.title = '暗色模式';
    darkBtn.addEventListener('click', () => setTheme(THEME_DARK));

    // 跟随系统按钮
    const autoBtn = document.createElement('button');
    autoBtn.className = 'theme-switcher-btn';
    autoBtn.id = 'theme-auto';
    autoBtn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
    autoBtn.title = '跟随系统';
    autoBtn.addEventListener('click', () => setTheme(THEME_AUTO));

    // 将按钮添加到切换器
    themeSwitcher.appendChild(lightBtn);
    themeSwitcher.appendChild(darkBtn);
    themeSwitcher.appendChild(autoBtn);

    console.log(themeSwitcher);

    // 将切换器添加到文档中
    document.body.appendChild(themeSwitcher);
  }

  // 设置主题
  function setTheme(theme) {
    // 保存用户偏好
    localStorage.setItem(THEME_KEY, theme);

    // 应用主题
    applyTheme(theme);

    // 更新按钮状态
    updateButtonState(theme);
  }

  // 应用主题
  function applyTheme(theme) {
    if (theme === THEME_AUTO) {
      // 跟随系统，移除data-theme属性
      document.documentElement.removeAttribute('data-theme');
    } else {
      // 强制使用指定主题
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // 更新按钮状态
  function updateButtonState(selectedTheme) {
    const buttons = document.querySelectorAll('.theme-switcher-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    if (selectedTheme === THEME_LIGHT) {
      document.getElementById('theme-light').classList.add('active');
    } else if (selectedTheme === THEME_DARK) {
      document.getElementById('theme-dark').classList.add('active');
    } else {
      document.getElementById('theme-auto').classList.add('active');
    }
  }

  // 初始化主题
  function initTheme() {
    // 获取保存的主题偏好
    const savedTheme = localStorage.getItem(THEME_KEY) || THEME_AUTO;

    // 应用主题
    applyTheme(savedTheme);

    // 创建切换按钮
    createThemeSwitcher();

    // 更新按钮状态
    updateButtonState(savedTheme);
  }

  // 当DOM加载完成后初始化
  document.addEventListener('DOMContentLoaded', initTheme);
})();
