---
title: "[02] React+Vite构建web程序"
date: 2023-03-17 18:38:29
updated: 2023-03-17 18:38:29
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

# 路由

之前已经记过 `React Router` 的用法。之前提到过 useNavigate，下面学习 useRoute 配置路由

# useRoute 配置路由

```jsx
import ...... from ........
import { useRoutes } from "react-router-dom";
function App() {
  let element = useRoutes([
    {
      path: "/login",
      element: <Login />,
      children: [
        {
          path: "about",
          element: <About />
        },
        {
          path: "user",
          element: <User />
        },
      ],
    },
    {
      path: "/",
      element: <Navigate to="/login/about" />
    }
  ])
  return element;
}
```

当然这是我们使用 JS 的写，也是官方给的写法，若我们使用 TS，则应该加上类型，例如这样（最好写进一个单独的文件，让 APP 文件导入）：

`routes.tsx`：

```tsx
import ...... from ........
import { useRoutes, RouteObject } from "react-router-dom";
const GetRouters = () => {
  const routes:RouteObject[] = useRoutes([
    {
      path: "/login",
      element: <Login />,
      children: [
        {
          path: "about",
          element: <About />
        },
        {
          path: "user",
          element: <User />
        },
      ],
    },
    {
      path: "/",
      element: <Navigate to="/login/about" />
    }
  ])
  return routes;
}
export default GetRouters;
```

`App.tsx`：

```tsx
import ...... from ......
import GetRouters from "./routes"

function App() {
  <BrowserRouter>
    <GetRouters />
  </BrowserRouter>
}

......
```

当然，我们也可以在 `routes.tsx` 页面中仅写入数组，在 `App.tsx` 进行 `useRoutes`，全看个人喜好。

如果我们在 `App.tsx` 还有 `Layout` 布局等，可以直接将此路由标签写入布局。

# `useLocation` 获取当前地址

```tsx
import { useLocation } from 'react-router-dom';
function SomeCom(props: {children: JSX.Element}) {
  const { pathname } = useLocation() // 获取路径
  ......
}
```

更多用法参考官方文档

# 组件懒加载

## React Suspense

```tsx
import { lazy, Suspense } from 'react';
const Login = lazy(() => import('./Login'));
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>} >
      <Login />
    </Suspense>
  )
}
```

路由懒加载的效果就是在加载的时候显示 `Loading...`（也可以是自定义组件），加载完成后显示 `Login` 组件。