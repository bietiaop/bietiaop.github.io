---
title: React Router 使用
date: 2023-03-11 22:30:15
updated: 2023-03-12 10:07:18
cover: https://pi.loili.com/2023/1c4f5102a78ba7fec349dc73a5e2c1a3.png
categories:
  - web
  - 前端
tags:
  - React
  - 前端
  - web
  - React Router
---

> React Router 官网：[https://reactrouter.com](https://reactrouter.com)

首先安装 `React Router`：

```shell
npm install react-router-dom -S
```

## 核心组件 - BrowserRouter

**作用**：包裹整个应用，一个 React 应用只需要使用一次

**两种常用 Router**：HashRouter（如果使用Electron，推荐使用这个） 和 BrowserRouter (如果构建web，推荐使用这个)

```jsx
function App() {
  return (
    <BrowserRouter>
      <Link to="/">首页</Link>
      <Link to="/about">关于</Link>
      <Routes>
        <Route path="/" element={ <Home /> }></Route>
        <Route path="/about" element={ <About />}></Route>
    </BrowserRouter>
  )
}
```

## 核心组件 - Link

**作用**：用于指定导航链接，完成路由转跳

**语法说明**：组件通过 `to` 属性指定路由地址，最终会渲染为 `a` 链接元素

```jsx
<Link to="/path">页面一</Link>
```

## 核心组件 - Routes

**作用**：提供一个路由出口，满足条件的路由组件会渲染到组件内部

```jsx
<Routes>
  {/* 满足条件的路由组件会渲染到这里 */}
  <Route />
  <Route />
</Routes>
```

## 核心组件 - Route

**作用**：用于指定导航链接，完成路由匹配

```jsx
<Route path="/about" element={ <About/> }/>
```

说明：当路径为 `/about` 时，会渲染 `About` 组件

## 编程式导航

### 跳转

**作用**：通过 JS 编程的方式进行路由页面转跳，比如从登录页转到关于页

**语法说明**：

1. 导入 `useNavigate` 钩子函数
2. 执行钩子函数得到转跳函数
3. 执行转跳函数完成转跳

```jsx
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const navigage = useNavigate()
  const goAbout = () => {
    navigage('/about',{ replace: true }) // 如果为 true，会以替换的方式进行跳转（无法返回上一页），而不是叠加。
  }
  return (
    <div>
      Login
      <button onClick={ goAbout }>转跳关于</button>
    </div>
  )
}

export default Login
```

与 `Routes` 和 `useRoutes` 一样，也有 `Navigate`，可直接使用（与 `Link` 类似），结合 `Route` 可以实现重定向：

```jsx
<Route path="/" element={<Navigate to="/about" />}></Route>
```

### 转跳携带跳转参数

**场景**：有些时候不光需要跳转路由还需要传递参数

**两种方式**：

1. `searchParams` 传参
   传参：
   ```jsx
   navigage('/about?id=1001')
   ```
   取参
   ```jsx
   let [params] = useSearchParams()
   let id = params.get('id')
   ```

2. `params` 传参
   首先要在 `Routes` 定义名称：
   ```jsx
   ...
    <Routes>
      ...
      <Route path="/about/:id" element={<About />}></Route>
      ...
    </Routes>
   ...
   ```
   传参：
   ```jsx
   navigage('/about/1001')
   ```
   取参
   ```jsx
   let params = useParams()
   let id = params.id
   ```

### 嵌套路由实现

1. `App.js`：定义嵌套路由声明
   ```jsx
   <Routes>
    {/* 定义嵌套关系 */}
    <Route path='/' element={<Layout />}>
      <Route path='board' element={<Board />} />
      <Route path='article' element={<Article />} />
    </Route>
   </Routes>
   ```
2. `Layout.js`：使用 `<Outlet />` 指定二级路由出口
   ```jsx
   import { Outlet } from 'react-router-dom'

   function Layout () {
    return (
      <div>
        layout
        {/* 二级路由出口 */}
        <Outlet />
      </div>
    )
   }
   ```

#### 默认二级路由设置

设置默认显示的二级路由页面：
  `App.js`：
  ```jsx
  <Routes>
    {/* 定义嵌套关系 */}
    <Route path='/' element={<Layout />}>
      <Route index element={<Board />} /> {/* 将 path 改为 index */}
      <Route path='article' element={<Article />} />
    </Route>
  </Routes>
  ```

### 404 页配置

  ```jsx
  <Routes>
    {/* 定义嵌套关系 */}
    <Route path='/' element={<Layout />}>
      <Route index element={<Board />} />
      <Route path='article' element={<Article />} />
    </Route>
    {/* 当所有路径都没有匹配到时渲染此路由 */}
    <Route path='*' element={<NotFound />} />
  </Routes>
  ```

  在 Github Pages 中，如果使用 `BrowserRouter`，刷新页面会出现 404，对于这个问题，参考如下：

  [react部署到github pages教程及路由匹配问题](https://blog.csdn.net/qq_21567385/article/details/108423111)

  对于 vercel，可以写一个 vercel.json 文件，放置在根目录下（确保打包后在根目录），内容如下：

  ```json
  {
    "routes": [
      {
        "src": "/[^.]+",
        "dest": "/",
        "status": 200
      }
    ]
  }
  ```

  一般来说放到 public 文件夹下。