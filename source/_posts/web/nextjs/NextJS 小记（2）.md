---
title: NextJS 小记（2）
date: 2025-02-20 12:32:23
updated: 2025-02-20 12:32:23
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
接上回。

## 对接 Go —— 数据库

我们的项目是 NextJS + Go，因此需要对接一下。主要有两个地方：鉴权和数据库。像是登录和登录鉴权等功能我们可以在 NextJS 上实现。在实现鉴权之前，我们肯定要梳理好数据库，无论是哪个框架，我们都要使用 ORM 进行建模，因此需要保证 NextJS 和 Go 建模的一致性，在前端，我们使用 Prisma，在后端，我们使用 Gorm。

由于我们使用了 Next-Auth 进行登录鉴权，所以需要先按照 AuthJS 的官方文档编写数据库，可以参考[这里](https://authjs.dev/getting-started/adapters/prisma?framework=next-js)。对于它所要求的数据库，我们只需要原封不动即可，但是我们也有自己的一些需求，例如需要密码字段、头像字段我想以 `avatar` 进行命名等，我们也只需要修改 `User` 表即可。像我就做了以下更改：

```prisma
model User {
  id            String          @id @default(cuid())
  name          String? // [!code --]
  nickname      String? // [!code ++]
  username      String?         @unique
  email         String?         @unique
  emailVerified DateTime?
  image         String? // [!code --]
  avatar        String? // [!code ++]
  password      String? // [!code ++]
  accounts      Account[]
  sessions      Session[]
  // Optional for WebAuthn support
  Authenticator Authenticator[]
 
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

由于 NextAuth 有一个预定义的 `User` 类型，我们在通过 `auth` 方法鉴权获取用户信息或者在自定义 `jwt` 、`session` 函数里获取的用户信息类型是 NextAuth 预定的类型。因此我们需要适配一下，可以查看官方文档：[Auth.js | Typescript](https://authjs.dev/getting-started/typescript?framework=next-js) 和 [Auth.js | Extending The Session](https://authjs.dev/guides/extending-the-session)。

在建模完成后，可以人工一个个转成 Gorm 的模型，当然也可以使用 AI 帮助转换，需要注意的是，大小写转换在 Prisma 和 Gorm 有所差异，建议涉及到大小写转换的字段手动通过 `@map` 进行定义，并且表的名称类似，Gorm 会根据关系给表增加“复数”，==强烈建议手动命名以保持一致性==。

> 注意使用 Prisma 的时候每次做完更改都需要生成一次客户端，如果你使用建立完客户端后 VSCode 仍然报类型错误，可以通过 `Ctrl(Command) + 鼠标点击` 转跳到客户端类型文件，此时 VSCode 会更新类型。如果你不嫌麻烦当然可以重启 VSCode。当然这只是 VSCode 没有反应过来，代码运行没有任何问题的。

## 对接 Go —— 鉴权

我们使用的是 NextAuth 实现用户登录、鉴权功能，因此需要按照官方文档构建好基础功能，如果有着==“如果没有账户，不能通过 OAuth 登录，需要先绑定 OAuth”==这种需求的，可以看一下之前写的文章。

在一切的一切都准备好后，我们需要自定义 `Credentials`。官方文档：[Credentials](https://authjs.dev/getting-started/authentication/credentials?framework=next-js)。下面提供手机号登录和密码登录的示例：

首先，我们要先自定义一个错误类，以及统一错误处理：

```typescript
import { AuthError } from 'next-auth';
import { createResponse } from './request';

export class ActionError extends Error {
	public code: number = 0;
	constructor(message: string, code?: number) {
		super(message);
		if (code) this.code = code;
	}
}

/**
* 通用的错误处理包装函数
*/
export const handleActionError = async <T>(action: () => Promise<T>) => {
	try {
		const result = await action();
		return createResponse.success(result);
	} catch (error) {
		if (error instanceof AuthError) {
				return createResponse.error(error.cause?.err?.message || error.message || '认证失败');
		} else if (error instanceof ActionError) {
				return createResponse.error(error.message || '未知错误');
		} else {
				return createResponse.error('服务器错误');
		}
	}
};
```

其中，`createResponse` 是我封装的用于创建统一的响应内容的方法，它会返回一个标准格式的返回内容，例如：

```json
{
	"code": 200,
	"data": null,
	"message": "请求成功"
}
```

这样的好处就是，如果我使用 actions，直接在 actions 里面抛出错误会导致请求提示 500 服务器错误，会触发页面报错，因此我们可以封装这么一个统一请求，然后在客户端封装一个通用的处理方法即可。这跟二次封装请求库很像。

> 值得一提的是，这个封装是针对 actions 的，如果是页面级别的内容请求，例如在服务端组件请求数据然后渲染，我们通常的做法是在组件顶部获取数据，然后通过 props 传递给客户端组件，然后展示在页面上。如果我们还在使用客户端的通用处理方法就不现实了，首先那是给客户端使用的，其次是服务端组件获取内容不应该通过 actions（actions 就应该是给客户端请求服务端内容使用的），最后是如果页面显示这种 JSON 内容就不太合适了。
> 因此我们可以再封装一个服务端方法，然后使用 NextJS 提供给我们的能力进行处理。这个后面（请求对接）会说到。

既然是登录，我们还要几个方法：

- `checkLoginAttempts`：限制登录频率，如果超过了某一限制，直接抛出错误即可。
- `isPasswordLogin`：判断当前登录方法，我的做法是判断 `type` 字段，由于我是用的是 `TypeScript`，这部分我需要通过 `is` 进行类型判断。
- `findUserByUsername`：获取用户信息，然后检查密码是否匹配
- `verifyPassword`：检查密码是否匹配
- `deleteLoginAttempts`：与 `checkLoginAttempts` 配合使用，当用户登录成功后将频率置零
- `getFinalUser`：获取用户完整信息，并且进行脱敏，由于我的用户信息并不是全部存储在 `User` 表里，一些个性字段存在其他数据库，因此我还要查询其他数据库，同时再把信息合并，把敏感信息例如密码等进行隐藏。
- \[可选\] `hasCompany`：由于我做的是一种多租户模式，因此需要判断该用户是否分配了子平台，如果没有的话自然是无法登录的。

```typescript
Credentials({
	credentials: {
		type: { label: '登录类型', type: 'radio', options: ['password', 'phone'] },
		username: { label: '用户名', type: 'text', placeholder: '用户名' },
		password: { label: '密码', type: 'password' },
	},
	// [!code focus:16]
	async authorize(credentials) {
		const c = credentials as LoginType;
		// 首先判断登录类型
		if (isPasswordLogin(c)) {
			// 检查登录频率、查找用户并比对密码
			await checkLoginAttempts(c.username);
			const user = await findUserByUsername(c.username);
			if (!user) {
				throw new ActionError('用户不存在');
			}
			if (!verifyPassword(c.password, user.password)) {
				throw new ActionError('密码错误');
			}
			deleteLoginAttempts(c.username); // 验证成功后删除登录频率限制
			// 完善返回的用户信息，进行数据脱敏，判断是否分配子平台，然后返回用户信息
			const userInfo = await getFinalUser(user);
			const company = await hasCompany(user.id);
			if (!company) {
				throw new ActionError('未分配公司');
			}
	// [!code focus:8]
			// 返回用户信息，将作为 profile
			return userInfo;
		} else if (isPhoneLogin(c)) {
			// 如果是验证码登录，执行相关操作
		}
		// 如果不符合所有登录方式
		throw new ActionError('登录类型错误');
	},
})
```

然后我们写一个 action，客户端调用 action 进行登录操作：

```typescript
/**
* 登录
* @param data
* @returns
*/
export const loginAction = async (data: z.infer<typeof loginFormSchema>) => {
	const validate = loginFormSchema.safeParse(data);
	if (!validate.success) {
		return createResponse.error(validate.error.errors[0].message);
	}
	return handleActionError(async () => {
		let user: User | null;
		// [!code highlight:15]
		if (isPasswordLogin(data)) {
			user = await signIn('credentials', {
				type: data.type,
				username: data.username,
				password: data.password,
				redirect: false,
			});
		} else {
			user = await signIn('credentials', {
				type: data.type,
				phone: data.phone,
				code: data.code,
				redirect: false,
			});
		}
		if (!user) {
			return createResponse.error('用户名或密码错误');
		}
		const info = getSelfInfo(user);
		return createResponse.success(info);
	});
};
```

用户登录后，AuthJS 会将 JWT Token 存储在 Cookie 中。默认 key 为 `authjs.session-token`。

> 值得一提的是，AuthJS 的 JWT 是 JWE，因此我们可以在后端使用这个算法进行对接。

Next-Auth 为我们写好了中间件鉴权，在之前的文章里我说明了如果要使用中间件要注意的几点，其中一点就是截止目前需要动态导入。我们可以在 Next-Auth 中间件基础上定制我们的需求。

在实现用户的登录后我们需要对接 Go 的鉴权，首先要在 Go 上面实现 AuthJS 的 JWT 算法，我们要保证前后端的 secret 一致。

```go
package jwe

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"
	"crypto/sha256"
	"github.com/gin-gonic/gin"
	"github.com/square/go-jose/v3"
	"golang.org/x/crypto/hkdf"
	"orangepi_homeassistant/conf"
)

// 这个结构是 jwt 中保存的用户信息
type UserInfo struct {
	Avatar        string     `json:"avatar"`
	Email         string     `json:"email"`
	EmailVerified *time.Time `json:"emailVerified"`
	Enable        bool       `json:"enable"`
	ID            string     `json:"id"`
	Nickname      string     `json:"nickname"`
	PhoneNumber   string     `json:"phoneNumber"`
	Username      string     `json:"username"`
}

// jwt 结构
type Claims struct {
	Email     string   `json:"email"`
	ExpiresAt int64    `json:"exp"`
	IssuedAt  int64    `json:"iat"`
	JTI       string   `json:"jti"`
	Subject   string   `json:"sub"`
	User      UserInfo `json:"user"`
}

// getDerivedEncryptionKey 根据 secret 和 salt 使用 HKDF 衍生密钥
func getDerivedEncryptionKey(secret, salt string) ([]byte, error) {
	saltBytes := []byte(salt)
	infoString := []byte(fmt.Sprintf("Auth.js Generated Encryption Key (%s)", salt))

	hkdf := hkdf.New(sha256.New, []byte(secret), saltBytes, infoString)
	key := make([]byte, 64) // A256CBC-HS512 needs a 64-byte key
	if _, err := hkdf.Read(key); err != nil {
		return nil, err
	}

	if len(key) != 64 {
		return nil, fmt.Errorf("Derived key length is incorrect. Expected 64 bytes, got %d bytes.", len(key))
	}

	return key, nil
}

// 验证 jwe
func ValidateJWE(tokenString string) (*Claims, error) {
	
	secret := "xxxx" // JWT 配置里面的 secret
	salt := "authjs.session-token" // salt 一般为 Token Cookie 的 key：authjs.session-token

	encryptionKey, err := getDerivedEncryptionKey(secret, salt)
	if err != nil {
		return nil, fmt.Errorf("密钥派生失败: %v", err)
	}

	// 解析JWE
	encrypted, err := jose.ParseEncrypted(tokenString)
	if err != nil {
		return nil, fmt.Errorf("解析JWE失败: %v", err)
	}

	// 解密JWE
	decrypted, err := encrypted.Decrypt(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("解密JWE失败: %v", err)
	}

	// 将解密后的JSON数据转换为Claims结构
	var claims Claims
	if err := json.Unmarshal(decrypted, &claims); err != nil {
		return nil, fmt.Errorf("claims解码失败: %v", err)
	}

	// 验证过期时间
	if claims.ExpiresAt < time.Now().Unix() {
		return nil, errors.New("token expired")
	}
	
	return &claims, nil
}
```

> 注意：salt 一般为 Cookie 中存放 Token 的 key。上面的算法需要保证 secret 为 64 位，也就是说 AuthJS 生成的 secret 可能无法使用。

我们在中间件进行鉴权以及权限控制即可。

接下来是获取这个 Token，最简单的办法就是获取 Cookie 里面的值，但是我们无法保证 key 是否发生变化，并且 AuthJS 给我们提供了一个方法获取 Token：`getToken`，但是这个方法需要传入 `request` 参数，即用户发起的请求，在 Server Components 中，NextJS 并没有直接给我们 `request` 参数，但是我们可以通过 `next/headers` 获取当前的请求的请求头、Cookie 等内容，因此我们可以手动构造一个请求内容，然后获取 Token。

```typescript
import { getToken as authGetToken } from '@auth/core/jwt';
import { cookies, headers } from 'next/headers';

export async function getToken() {
	const token = await authGetToken({
		secret: process.env.AUTH_SECRET,
		raw: true, // 添加这个参数是为了获取原始 Token 而不是解开后的
		req: {
			headers: {
				...Object.fromEntries(await headers()),
				Cookie: (await cookies())
					.getAll()
					.map((c) => `${c.name}=${c.value}`)
					.join('; '),
			},
		},
	});
	return token;
}
```

获取 Token 后我们就可以传给后端。放在请求头或者 Cookie 里都行，这需要与后端进行约定。

## 对接后端 —— 请求

前面也提到过，我们要封装两种请求，分别针对客户端和服务端组件。客户端的组件我们可以直接通过 `createResponse` 来构造通用响应内容。服务器端组件我们可以调用 NextJS 给我们提供的方法：`unauthorized`、`forbidden`、`notFound` 等，然后跳转到对应页面，如果直接抛出错误，就会被错误边界捕获，显示你定义的错误边界页面内容（不会跳转到错误页面）。这样对于用户的体验就会更好！

下面是一个页面请求示例：

```typescript
import { auth } from '@/auth';
import { forbidden, notFound, unauthorized } from 'next/navigation';

type DefaultResponseType =
	| DefaultResponseType[]
	| Record<string, DefaultResponseType | string | number | boolean | object | DefaultResponseType[]>
	| null
	| undefined;

export async function pageRequestWithAuth<T = DefaultResponseType>(
	url: string | URL,
	options?: RequestInit
): Promise<T> {
	const a = await auth();
	if (!a || !a.user) {
		unauthorized();
	}
	const token = await getToken(); // 上面的获取 Token 方法
	const finalURL = new URL(url, backend_url);
	// 发起请求
	const response = await fetch(finalURL, {
		...options,
		headers: {
			...options?.headers,
			Authorization: `Bearer ${token}`,
		},
	});
	// response 在遇到非 200 响应码的时候并不会跑出错误，因此我们需要判断一下
	if (!response.ok) {
		if (response.status === 401) {
			unauthorized();
		}
		if (response.status === 403) {
			forbidden();
		}
		if (response.status === 404) {
			notFound();
		}
	}
	// 获取内容
	const data = await response.json();
	// 如果后端全部返回 200 响应码，需要我们判断 code 这种类型的判断码时，需要做个 fallback（记得与后端商量好）
	if (data.code === 200) {
		return data.data;
	}
	if (data.code === 401) {
		unauthorized();
	}
	if (data.code === 403) {
		forbidden();
	}
	if (data.code === 404) {
		notFound();
	}
	// 如果都不是以上情况，那么说明这种情况非预期，直接抛出错误，可以在日志里面查看
	throw new Error(data?.message || response.statusText);
}
```

> 这里必须注意：
> 一定 ==**不要使用**==  `try-catch` 来捕获 `pageRequestWithAuth` 错误，因为 NextJS 的 `redirect` 就是通过抛出错误进行重定向的！
> 你不需要捕获错误，因为非预期错误会被网页的错误边界捕获，然后传入错误信息，在开发环境中可以直接打印错误信息到页面上，在生产环境中，NextJS 会==自行屏蔽错误信息==，但是我们可以在后端后台日志上看到。

客户端请求示例就不放了，只需要把除了非 200 情况的判断为错误，使用自定义的 `createResponse` 进行封装返回即可。

## 租户切换

如果租户想要切换查看的平台，我们需要标记当前租户所操作的平台。我们可以将标记存储在 Cookie 或者 jwt 里面，这样就方便客户端和服务端都能够查询到当前租户的操作平台。

我的选择是存放在 jwt 里面，当用户切换平台的时候，更新 jwt 里面的信息即可。当用户首次登录的时候，查询用户所拥有的平台，选择一个默认的写进去。并且对接后端的时候，获取 jwt 内容，将平台 id 等写入请求头或者其他地方（与后端协商），进行区分标记。

例如写一个 `postWithCompany` 方法：

```typescript
pageRequestWithAuth.postWithCompany = async function <T = DefaultResponseType>(
	url: string,
	body?: PostParam,
	options?: RequestInit
): Promise<T> {
	const sessoion = await auth();
	if (!sessoion || !sessoion.user) {
		unauthorized();
	}
	// [!code highlight:2]
	// 获取用户当前操作的公司（用户信息类型多加一个 currentViewCompanyId 字段，这部分可以看此文章开头的部分，先在类型里面添加，登录的时候做个判断保险，然后在 AuthJS 的 jwt 方法里面修改信息，下面会提到）
	const compayId = sessoion.user.currentViewCompanyId;
	if (!compayId) {
		forbidden();
	}
	return pageRequestWithAuth.post(url, body, {
		...options,
		headers: {
		...options?.headers,
		'X-Company': compayId,
		},
	});
};
```

我们在文章开头说了判断用户是否有公司（子平台），那个是为了保险，真正保存 Token 和 Session 信息的是在 `jwt` 和 `session` 方法中，关于这两个东西的内容可以看上一篇文章。

因此我们需要在 `jwt` 方法中处理租户当前操作的子平台以及切换子平台。

```typescript
{
	callbacks: {
		async jwt({ token, user, trigger, session }) { // [!code focus]
			if (user) {
				token.user = user;
			}
			// [!code focus:30]
			if (trigger === 'update' || trigger === 'signIn') {
				/**
				* 获取已存用户信息，这里需要说明一下：
				* 当用户登录的时候，user 的值是有的
				* 当再次触发的时候，user 是没有值的，因此只能获取先前保存的值
				*/
				const existUserInfo = (user ?? token?.user) as {
					username: string;
					currentViewCompanyId?: number;
				};
				const username = existUserInfo.username;
				// 从数据库中获取用户信息
				const dbuser = await findUserByUsername(username);
				if (dbuser) {
					// 更新用户信息
					const userInfo = await getFinalUser(dbuser);
					// [!code highlight:8]
					// 通过 Session 查询用户信息，如果没有 当前操作的子平台，那说明可能是刚登录，此时查询数据库写入一个默认的即可，否则说明之前登录过了，需要更新
					if (!session?.user?.currentViewCompanyId) {
						const userCompanies = await getUserCompanies(dbuser.id);
						userInfo.currentViewCompanyId = userCompanies?.[0]?.id;
					} else {
						// 这里为什么是 赋值 session.user.currentViewCompanyId 呢？下面会说明
						userInfo.currentViewCompanyId = session.user.currentViewCompanyId;
					}
					token.user = userInfo;
				}
			}
			return token;
		},
	},
}
```

上面切换子平台的时候，为什么赋值 `session.user.currentViewCompanyId` 呢？这里我说明一下，上一个文章就提到了用户更新 Session 的时候我们要查询数据库更新，因为前端传来的信息是不可信的，这里就是，当 `trigger` 为 `update` 的时候，也就是更新 Session 的时候，`jwt` 方法里面的 `session` 参数是客户端传来的更新内容，也就是调用 `useSession.update` 方法传入的参数，因此是不可信的。

上面的代码中我没有验证用户切换的子平台，用户是否有权限，这是因为考虑到查询数据库的消耗等，体验不是特别好，因此是直接切换。不过——我们做了权限控制，即使你通过非正常方法切换到了不是自己的平台，权限控制也会让你 403。

## 数据刷新

这篇文章的最后，再说一下数据刷新问题。NextJS 默认所有页面都是==静态页面==，编译的时候会==尝试按照静态页面进行编译==，而 NextJS 编译的时候会先把所有的页面和代码跑一遍，最直观能看到的就是，如果你写了一个数据库连接并且打印连接信息，编译的时候你会看到打印出来了数据库连接信息。因此遇到含有“非静态”内容的页面，它在编译（跑你代码）的时候可能会触发某个请求等，会导致页面报错。

然而它的报错信息有时候很难看出来是什么问题，例如我之前编译的时候遇到一个报错：

```bash
Error occurred prerendering page "/_not-found". Read more: https://nextjs.org/docs/messages/prerender-error
TypeError: Invalid URL
```

它告诉我预渲染 `/_not-found` 页面出错，当时我删遍了所有 `not_found` 页面都无果，当时下面的一行 `TypeError: Invalid URL` 没有太在意，因为我在写请求的时候用到了 `new URL()`，所以只有那一个地方涉及到 `URL` 类。

后面才知道原来就是那个地方的报错。当 NextJS 进行预渲染的时候会先跑一遍我们的页面，当时的后端地址等都是在环境变量里配置的，然后参数什么的都是在 Server Components 进行拼接的，当 NextJS 跑到这些页面的时候会触发 `request`，后端返回错误也会导致报错。

而我们的网站每个页面几乎都涉及到数据更新，因此索性直接全部使用动态页面。按照官方文档来说，只需要在页面文件导出如下配置即可：

```typescript
export const dynamic = 'force-dynamic';
```

如果页面较多，我们可以在 `Layout` 里面导出即可，其下所有的页面都不需要配置了。

还有一个问题是，我有一个页面用到了平行路由，在布局里面展示了数据列表和具体内容，类似于这样：

![[Pasted image 20250220153228.png]]
上面有筛选按钮，当点击筛选项当时候，或者切换页面的时候，会改变 URL 当查询参数，URL 改变效果是有了，但是左侧数据没有变化。

发生这种情况的原因是没有进行页面的数据刷新。当我们通过客户端修改查询参数的时候，服务端是不会感知到这些变化的，因此不会进行数据刷新。需要我们手动进行刷新，方法就是使用 NextJS 提供的 `router hooks`：

```typescript
const router = useRouter(); // [!code focus]

const handle = async () => {
	// 一顿操作后...
	router.refresh(); // [!code focus]
}
```

这里的 `refresh` 与 React-Router 的有一些差别，这里的刷新并不会导致浏览器级别的刷新，而是服务端数据刷新然后水合页面。

当然建议的是直接使用 `Link` 标签，这样就不用担心服务端没有感知刷新数据的问题。配合 `shadcn` 等组件库 `asChild` 的作用，就会更好了——对于条件筛选例如单选器，我们可以直接在选项里面使用 `Link` 做超链接，然后选项按钮使用 `asChild`，在保证了样式的前提下，又会充分发挥 NextJS 的优势，而不用我们手动刷新数据。不要担心 `Link` 标签会导致页面整体刷新，如果你使用的是布局（Layout）并且 `Link` 标签所指向页面与当前页面共用 Layout，那么就会跟 React-Router 一样只会让 `Outlet` 部分刷新。