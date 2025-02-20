---
title: NextJS、Next-Auth 小记（1）——登录、鉴权（踩坑记录）
date: 2025-02-18 15:29:23
updated: 2025-02-18 15:29:23
cover: https://sa.ffft.net/2025/2c647988-0a93-0b6d-7565-d0f3ec1b4c3a.png
categories:
  - web
  - 全栈
tags:
  - NextJS
  - React
  - Next-Auth
  - AuthJS
mathjax: false
---
> **写在前面：**
> 当你发现切换为 NodeJS 运行时后仍然有 Edge Runtime 报错，请你关闭 Turbopack。
> 将 dev 命令中的 `--turbopack` 删掉。

好久没有更新博客了，正好最近遇到了 NextJS 的需求，也折腾了一会儿，就把遇到的一些问题记录一下。

这次写的项目我是用 NextJS + AuthJS（Next-Auth）完成的，并且主要的后端业务并不是在 NextJS 中，而是通过 NextJS 与 Go 后端进行互相通信。这样，一是为了优化针对某些搜索引擎的 SEO，二是更方便地动态配置网站，例如标题、ICON、简介等，三是隐藏主要API 调用。

# 登录、鉴权（Next-Auth，AuthJS）

主要的登录和鉴权是使用 Next-Auth（AuthJS）进行的，然后 Go 后端保持一样的 jwt 算法和 secret 即可。因此首先要解决的是 AuthJS 的配置问题。
使用 AuthJS 最方便的就是其开封即用的 OAuth、WebAuth 等功能，并且其提供了中间件进行鉴权，我们可以在 Server Components 和 Client Components 很方便的获取 Session 信息。我们也可以自定义 Credentials 实现我们自定义的认证（账号密码登录、验证码登录等）。

AuthJS 的缺点就是目前文档可以用“一塌糊涂”来形容，那不像是给人读的，什么都找不到。

## 问题

### AuthJS 默认自动创建账户

在使用 AuthJS 的时候，它会明确告诉你，它推荐的是使用 OAuth 的时候，默认会自动创建一个基于该邮箱的账户。但是对于我们国内的业务来说，大部分我们不希望自动创建账户，而是仅通过 OAuth 进行快速登录（也就是说先有账户再进行绑定），因此我们需要自定义登录的方法，先检查是否绑定账户。而这部分在文档里很难找，在我写博客的时候我想快速找到对应文档链接，已经翻不到了，这里我大致说一下。

#### 解决过程

在 NextAuth 的配置中，有一个 `callback` 配置，在这里可以配置登录、重定向、JWT 方法、session 方法等。

在 `callback` 中，处理登录的方法是 `signIn` ，这个方法会传入一个参数，我们直接跳转到它的类型文件中查看：

```typescript
signIn?: (params: {
	user: User | AdapterUser
	account: Account | null
	/**
	* If OAuth provider is used, it contains the full
	* OAuth profile returned by your provider.
	*/
	profile?: Profile
	/**
	* If Email provider is used, on the first call, it contains a
	* `verificationRequest: true` property to indicate it is being triggered in the verification request flow.
	* When the callback is invoked after a user has clicked on a sign in link,
	* this property will not be present. You can check for the `verificationRequest` property
	* to avoid sending emails to addresses or domains on a blocklist or to only explicitly generate them
	* for email address in an allow list.
	*/
	email?: {
		verificationRequest?: boolean
	}
	/** If Credentials provider is used, it contains the user credentials */
	credentials?: Record<string, CredentialInput>
}) => Awaitable<boolean | string>
```

可以看到，这个参数里面提供了 `user` 、`account` 、`profile` 、 `email` 、 `credentials` 五个参数，这里要说一下关于这部分的 AuthJS 数据库的组成：
在 AuthJS 数据库适配器文档页面，AuthJS 会要求我们建立几个数据库模型，其中两个为`User` 和 `Account`。

`User` 数据库其实就是我们的用户数据库，里面可以存用户的信息，如账号、头像、邮箱等，`Account` 数据库是提供给 `OAuth` 使用的，当用户通过 `OAuth` 登录的时候，AuthJS 首先会查询 `User` 数据库中有没有相同邮箱的用户，如果有，那么就会进行用户绑定，如果没有，那么就会创建一个用户，这就是“AuthJS 默认自动创建账户“。

既然如此，我们就能一眼看出来 `user` 和 `profile` 两个参数对应的就是这两个数据库的内容，`profile` 是用户信息，举个例子，如果你是通过自定义的 Credentials 进行认证的，那么你自定义的 Credentials 适配器一定会返回一个用户信息（`profile`），这个用户信息就是这里的 `profile` ，同时，如果你也自定义了 JWT 方法、Session 方法等的话，它也会传递进参数，这个 `profile` 就可以作为 `session` 的用户信息。

很显然我们这里只需要用到 `user` 和 `account` 。

#### 解决方法

我们可以写一个方法 `findUserByOAuth` 去查询 `Account` 数据库，查找 OAuth 对应的 `id` 有没有绑定的账户。其次要知道的是，在 `signIn` 方法里返回布尔值 `true` 就代表登录通过，可以进行下一步，返回**字符串**，就会触发**重定向**。接下来就可以实现我们自定义的登录检查：

1. 首先在 `callbacks` 里面写入自定义的 `signIn` 方法，接收 `user` 和 `account` 两个参数。
2. 在 `account` 参数里有一个 `type` 属性，这里就可以判断登录类型（例如 OAuth、Credentials 或者 Email Magic Link）。如果是 OAuth 登录，那么就进行检查，否则直接判断 `user` 是否存在（自此 `user` 参数的作用结束了）。
3. 如果是 OAuth 类型的登录，首先判断当前是否已经登录，已经登录就代表当前的操作是绑定账户，直接通过进行下一步即可。我们虽然在这里初始化 NextAuth 后才获得的 `auth` 认证方法，但是我们检查 `signIn` 是一个方法，在用户登录的时候才执行，此时 `auth` 方法已经初始化完毕，我们可以在这里进行调用。顺便说一下为什么不用 `user` 参数进行判断，这个 `user` 是 NextAuth 查询数据库获得的结果，如果 OAuth 的邮箱与数据库中的某个账户的邮箱匹配了，但是当前已登录的用户（即要绑定 OAuth 的用户）的邮箱不匹配，那么就会导致 `user` 参数不匹配。
4. 如果没有登录，说明现在进行的行为就是登录，此时判断一下 OAuth 有没有提供用户 `id` ，如果没有进行错误转跳，如果有的话，就到数据库里面查询 OAuth 绑定的账户，如果有的话就进行下一步，没有的话进行错误转跳。
5. 补充：对于没有进行账户绑定等情况，只能进行重定向转跳，我们可以自己写一个页面进行处理，提供 `searchParams` 然后手动判断即可。在这里我为了用户体验在登录页面进行提示，用户通过 OAuth 转跳回来后仍然是登录页面，如果出现错误可以直接在登录页面展示。

```typescript
import NextAuth from 'next-auth';

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
// [!code highlight:2]
	callbacks: {
		async signIn(params) {
			const { user, account } = params;
			// 如果是如果 OAuth 登录
			if (account?.type === 'oauth') {
				const session = await auth();
				// 如果已经登录
				if (session?.user) {
					return true;
				}
			    // 如果 OAuth 没有提供 id
				if (!account.providerAccountId) {
					return '/login?error=OAuthAccountNotLinked';
				}
				// [!code highlight:5]
			    // 使用自定义的方法 findUserByOAuth 查询是否有绑定关系
				const oauthUser = await findUserByOAuth(account.provider, account.providerAccountId);
				if (!oauthUser) {
					return '/login?error=OAuthAccountNotLinked';
				}
				return true;
			}
			return !!user;
// [!code highlight:2]
		},
	},
});
```

### Edge Runtime

在我刚开始使用 NextJS 的时候是 25 年 1 月份，当时 NextJS 的中间件仍然仅支持 [Edge Runtime](https://vercel.com/docs/functions/edge-middleware/edge-runtime)。这就造成了一些困扰——**无法连接数据库**==（Serverless除外）==。由于 Edge Runtime 仅支持部分 NodeJS 和 Web API，因此造成了一种很尴尬的局面：有些库使用了 NodeJS 的 API 或者 Node Add-on（例如 `bcrypt`），它无法在 Edge Runtime 上面运行，然而有些库不仅支持Node 也支持 Web 环境（例如 `rust-bcrypt`），然而 Edge Runtime 不支持 Wasm，也就是说，你无法在中间件使用 `bcrypt` 检查密码一致性（登录时）。除此之外，你还无法使用 Redis、MySQL、PostgreSQL。

由于 NextAuth 的部分方法如鉴权、jwt 方法等运行在中间件，因此如果想要实现 jwt 用户信息更新等就很麻烦，下面是经常看到的报错：

[Next middleware with ioredis error: \[TypeError\]: Cannot read properties of undefined (reading 'charCodeAt') · Issue #73424 · vercel/next.js](https://github.com/vercel/next.js/issues/73424)
[Uncaught TypeError: Cannot read property 'charCodeAt' of undefined · Issue #769 · redis/ioredis](https://github.com/redis/ioredis/issues/769)

```bash
Uncaught TypeError: Cannot read property 'charCodeAt' of undefined
```

[⨯ Error: The edge runtime does not support Node.js 'crypto' module. · Issue #10540 · nextauthjs/next-auth](https://github.com/nextauthjs/next-auth/issues/10540)
[typescript - Next.js Middleware Error :- [Error: The edge runtime does not support Node.js 'crypto' module] - Stack Overflow](https://stackoverflow.com/questions/76080784/next-js-middleware-error-error-the-edge-runtime-does-not-support-node-js-c)

```bash
Error: The edge runtime does not support Node.js 'https' module.
```

[Can't use Prisma Client in Next.js middleware with `@prisma/adapter-pg` and `pg`, even locally · Issue #24430 · prisma/prisma](https://github.com/prisma/prisma/issues/24430)

```bash
Error: The edge runtime does not support Node.js 'crypto' module.
```

[`Error: Prisma Client is unable to run in an edge runtime. As an alternative, try Accelerate: https://pris.ly/d/accelerate.` · Issue #22889 · prisma/prisma](https://github.com/prisma/prisma/issues/22889)

```bash
[auth][cause]: Error: PrismaClient is not configured to run in Edge Runtime (Vercel Edge Functions, Vercel Edge Middleware, Next.js (Pages Router) Edge API Routes, Next.js (App Router) Edge Route Handlers or Next.js Middleware). In order to run Prisma Client on edge runtime, either:
```

好消息是，二月发布的一个版本中，middleware 支持 NodeJS Runtime 了，具体做法：
首先==切换 NextJS 版本至最新 Canary==，然后修改 `next.config.ts` ：

```typescript
const nextConfig: NextConfig = {
	experimental: {
		nodeMiddleware: true,// 开启 NodeJS 运行时 // [!code ++]
		// 其他配置
	},
	// 其他配置
};
export default nextConfig;
```

接着在 `middleware.ts` 中导入配置：

```typescript
export const config = {
	runtime: 'nodejs',
};
```

这样就可以在中间件中使用数据库，并且自定义 jwt 方法中使用数据库。

但是由于这是**实验性功能**，还==存在很多问题==，下面会提到。
### AuthJS 更新 Session 用户信息

在写需求的时候有一个很头疼的问题就是当用户更新用户信息，例如昵称、头像等，Session 里面的用户信息无法及时更新，按照网上的方法就是通过修改 jwt 方法，根据 jwt 里面的参数的新内容更新用户信息……吧啦吧啦……

但是！里面的参数是前端传过来的，前端传输的内容并不可靠，我们不能根据前端传输过来的信息更新 Session。

> 注：这里面提到的前端传过来的信息指的是，在 client 页面使用 next-auth 提供的 useSession hook 的 update 方法传入参数，调用 session api 更新用户信息，这个 update 方法会把参数携带传给 Session API，而在 jwt 方法中获取到的新内容即 update 方法内的参数。如果涉及到敏感信息更新更是不可信。

因此我们要自己查询数据库然后更新信息。具体流程是这样的：

用户在更新信息页面提交表单 -> actions 处理，写入数据库，并且更新服务端 Session -> 前端调用 update 方法 -> AuthJS 会自行调用 jwt 方法更新

这里值得一提的是，我们在使用 actions 处理用户请求然后更新数据库后一定要更新服务端 Session，否则不会生效，调用方法就是上面配置 NextJS 中导出的 `unstable_update` 方法，使用方法同客户端的 `session.update` 方法。

代码如下：

```typescript
/**
* 修改用户信息
* @param data
* @returns
*/

export const editProfileAction = async (data: z.infer<typeof editProfileFormSchema>) => {
	// 校验表单
	const validate = editProfileFormSchema.safeParse(data);
	if (!validate.success) {
		return createResponse.error(validate.error.errors[0].message);
	}
	return handleActionError(async () => {
		// 验证用户并更新用户信息
		const userId = await checkAuth();
		const profile = await editProfile(userId, data.nickname);
		// 过滤敏感信息（自定义 getFinalUser 方法过滤）
		const user = await getFinalUser(profile);
// [!code highlight:4]
		// 调用 NextAuth 暴露的 unstable_update 方法更新服务端 Session
		await unstable_update({
			user,
		});
		return '修改用户信息成功';
	});
};
```

在服务端更新完数据库和 Session 之后，更新客户端的 Session：

```tsx
'use client';
import { useSession } from 'next-auth';

export default function Page() {
	const session = useSession(); // [!code highlight]

	// 某个方法
	const update = async () => {
		await session.update()  // [!code highlight]
	}
}
```

调用 `update` 方法会触发 NextAuth 的 jwt 方法，因此我们还要在 `callback` 里面定义 `jwt` 方法：

```typescript
import NextAuth from 'next-auth';

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
	callbacks: {
		async jwt({ token, user, trigger, session }) {
			if (user) {
				token.user = user;
			}
 // [!code highlight:2]
			// 如果是更新 Session 或者登录，在这里面处理用户信息
			if (trigger === 'update' || trigger === 'signIn') {
				const existUserInfo = (user ?? token?.user) as {
					currentViewCompanyId?: number;
				};
				const username = existUserInfo.username;
				// 从数据库中获取用户信息
				const dbuser = await findUserByUsername(username);
				if (dbuser) {
					// 更新用户信息
					const userInfo = await getFinalUser(dbuser);
					token.user = userInfo;  // [!code highlight]
				}
			}
			return token;  // [!code highlight]
		},
	},
});
```

除此之外，还要更新 Session 里面的信息，Session 里面的信息可以直接使用 Token 里面的用户信息：

```typescript
import NextAuth from 'next-auth';

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
	callbacks: {
		async session({ session, token }) {
			if (token.user) {
				session.user = token.user as typeof session.user;  // [!code highlight]
			}
			return session;  // [!code highlight]
		},
	},
});
```

此时当用户更新自己的信息的时候，Session 内的用户信息也会更新。

#### Next-Auth 导入 `next/server.js` 等

```bash
[Error: Cannot find module '/Volumes/bietiaop/git/data-platform/node_modules/next/server' imported from /Volumes/bietiaop/git/data-platform/node_modules/next-auth/lib/env.js
Did you mean to import "next/server.js"?] {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///Volumes/bietiaop/git/data-platform/node_modules/next/server'
}
 ⨯ unhandledRejection:  [Error: Cannot find module '/Volumes/bietiaop/git/data-platform/node_modules/next/server' imported from /Volumes/bietiaop/git/data-platform/node_modules/next-auth/lib/env.js
Did you mean to import "next/server.js"?] {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///Volumes/bietiaop/git/data-platform/node_modules/next/server'
}
```

这个错误是由 Next-Auth 内部导入 `next/server` 、`next/header` 等造成的，NextJS 已将其改为 `next/server.js` 类似于这样的导出。解决办法很简单，修改 `next.config.ts`，添加如下内容：

```typescript
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
	transpilePackages: ['next-auth'], // [!code ++]
};
export default nextConfig;
```

#### \[TypeError: adapterFn is not a function\]

这个是由于 NodeJS 运行时仍然是**实验性功能**，中间件这部分仍有bug，解决方法是动态导入 authjs 中间件：

```typescript
import type { NextMiddleware } from 'next/server';
let auth: typeof import('@/auth').auth;  // [!code highlight]
export const middleware: NextMiddleware = async (req, evt) => {
	// 动态导入
	if (!auth) auth = (await import('@/auth')).auth;  // [!code highlight]
	const authMiddleware = auth((req) => {
		const pathname = req.nextUrl.pathname;
		const auth = req.auth;
		const loginUrl = new URL('/login', req.nextUrl.origin);
		if (!auth && pathname.startsWith('/dashboard')) {
			return Response.redirect(loginUrl);
		}
	});
	//@ts-expect-error authMiddleware is a function
	return authMiddleware(req, evt);
};

export const config = {
	runtime: 'nodejs',
};
```

剩下内容（页面数据刷新、与 Go 后端对接、多租户模式下租户的切换等）等有空继续更新。

最后，我在实际开发中仍遇到一些 Edge Runtime 的报错，上面所有的东西都尝试过之后仍然无法解决，最后不得不关闭 `turbopack` 开发，这给我带来的就是超长时间的更新编译，甚至改一行代码能刷新半分钟……