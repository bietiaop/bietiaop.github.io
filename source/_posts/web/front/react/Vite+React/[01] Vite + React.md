---
title: "[01] React+Vite构建web程序"
date: 2023-03-16 16:01:44
updated: 2023-03-16 16:01:44
cover: https://pi.loili.com/2023/1c4f5102a78ba7fec349dc73a5e2c1a3.png
categories:
  - web
  - 前端
tags:
  - React
  - 前端
  - web
  - Vite
  - 网站
  - 网页
---

# 环境配置

## Vite 构建 React 项目

我们可以通过附加的命令行选项直接指定项目名称和我们想使用的模板，通过这个，我们可以快速通过 `Vite` 构建 `React` 应用

```shell
npm create vite@latest yourname --template react
# 或者 ts 版
npm create vite@latest yourname --template react-ts
```

当然，我们可以先不指定模板，到时候 `Vite` 会让我们进行选择：

```shell
npm create vite@latest <name>
```

配置完之后，会看到提示我们运行命令：

```shell
Done. Now run:

  cd yourname
  npm install
  npm run dev
```

我们只需要按照要求运行即可

之后我们就可以通过命令运行测试了

## 配置全局 Scss

### 安装 `sass`

```sh
npm install sass -D
```

### 创建 `Scss` 配置文件

在 `./src/styles/` 下创建 `sassConfig.scss`

可以写入一些全局变量如：

```scss
$red: red;
```

### 配置 `Vite`

`vite.config.ts`：

```ts
export default defineConfig({
  plugins: [react()],
  // 配置 scss
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/styles/sassConfig.scss";`
      }
    }
  }
})
```

#### 注意

在最新版本已经无需手动设置 SCSS 的配置，只需要安装 SASS 即可。

不过仍然可以使用上述配置进行全局 SCSS 的配置。