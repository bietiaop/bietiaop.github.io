---
title: Redux的使用 - 以登录状态管理为例
date: 2023-04-19 16:46:07
updated: 2023-04-19 16:46:07
cover: https://pi.loili.com/2023/09ccd44878df88928344c553413f8a64.png
categories:
  - web
  - 前端
tags:
  - React
  - 前端
  - web
  - Redux
---

## 安装 Redux Tookit 和 React Redux

```shell
npm install @reduxjs/toolkit react-redux -S
```

## 创建 store 相关文件

在 `src` 目录下创建 `store` 文件夹，用于存放 Redux 和 store 相关文件。

在 `src` 目录下创建 `hooks` 文件夹，用于存放自定义 hooks，我们需要在里面创建一个 `store.ts`，文件里面存放 Redux 相关的 Hooks。

在 `store` 文件夹下创建 `index.ts` 文件，用于创建 Redux store。

这里面以登录状态管理为例，创建 `login.ts` 文件，用于存放登录状态相关的 reducer 和 action。

## store/index.ts

此文件是 Redux store 的入口文件，用于创建 Redux store。

通过 `configureStore` 方法创建 Redux store，通过 `reducer` 属性指定 reducer。

我们可以导入已创建的 reducer，然后通过 `reducer` 属性指定。

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import loginReducer from './login'

export const store = configureStore({
  reducer: {
    login: loginReducer
  }
})
// 从 store 本身推断出 `RootState` 和 `AppDispatch` 类型
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

导出两个类型，`RootState` 和 `AppDispatch`，分别用于获取 store 的 state 和 dispatch 的类型，在 `typescript` 中使用防止因为数据类型而报错。

这样，我们就创建了 Redux store。

## hooks/store.ts

此文件用于存放 Redux 相关的 Hooks。

```typescript
// src/hooks/store.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '../store'
// 在整个应用程序中使用，而不是简单的 `useDispatch` 和 `useSelector`
// 使用泛型指定 state 的类型
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
// 指定 dispatch 的类型
export const useAppDispatch: () => AppDispatch = useDispatch;
```

使用 `useAppSelector` 和 `useAppDispatch` 来获取 store 的 state 和 dispatch。如果我们直接使用 `useSelector` 和 `useDispatch`，那么我们就需要在每次使用的时候都要指定 state 和 dispatch 的类型，这样就会很麻烦。这样我们在其他地方直接使用 `useAppSelector` 和 `useAppDispatch` 代替默认的  `useSelector` 和 `useDispatch` 来获取 state 和 dispatch。

## store/login.ts

此文件用于存放登录状态相关的 reducer 和 action。

通过 `createSlice` 方法创建 reducer，通过 `reducers` 属性指定 reducer。通过 `actions` 属性指定 action。

```typescript
// src/store/login.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from "../store";
// state 类型
interface LoginState {
  isLogin: boolean
}
// 初始值
const initialState: LoginState = {
  isLogin: false
}
// 创建 slice
const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    login(state) {
      state.isLogin = true
    },
    logout(state) {
      state.isLogin = false
    }
  }
})
// 导出 action
export const { login, logout } = loginSlice.actions
// 导出 state
// 选择器等其他代码可以使用导入的 `RootState` 类型
export const loginState = (state: RootState) => state.loginState;
// 导出 reducer
export default loginSlice.reducer
```
## 使用

在 `App.tsx` 中使用。

```tsx
// src/App.tsx
// 导入 provider
import { Provider } from 'react-redux'
// 导入 store
import { store } from './store'
import { useAppSelector, useAppDispatch } from './hooks/store'
import { login, logout } from './store/login'

function App() {
  const isLogin = useAppSelector(state => state.login.isLogin)
  const dispatch = useAppDispatch()
  return (
    <div className="App">
      <button onClick={() => dispatch(login())}>登录</button>
      <button onClick={() => dispatch(logout())}>登出</button>
      <Provider store={store}>
       <p>{isLogin ? '已登录' : '未登录'}</p>
      </Provider> 
    </div>
  );
}

export default App;
```