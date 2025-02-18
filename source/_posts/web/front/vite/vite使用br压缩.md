---
title: Vite 使用 br 压缩
date: 2023-06-24 13:10:38
updated: 2023-06-24 13:10:38
cover: https://pi.loili.com/2023/edbdbb805891eaf1b17904c2d56cd98c.png
categories:
  - Vite
  - 前端
tags:
  - gzip
  - br
  - Vite
  - Vite插件
  - 前端
  - 压缩
---
## 为什么使用 br 压缩

- ### gzip 压缩
  
  Gzip 是一种用于文件压缩与解压缩的文件格式。它基于 Deflate 算法，可将文件（译者注：快速地、流式地）压缩地更小，从而实现更快的网络传输。Web 服务器与现代浏览器普遍地支持 Gzip，这意味着服务器可以在发送文件之前自动使用 Gzip 压缩文件，而浏览器可以在接收文件时自行解压缩文件。
  摘自：[MDN Web Docs](https://developer.mozilla.org/zh-CN/docs/Glossary/GZip_compression)

- ### br 压缩
  
  同 gzip 类似， Brotli 也是一种压缩算法，由 Google 开发，对于文本压缩非常好。主要的特点就是它在服务器端和客户端都用到了词典，常见关键词和词组都有，这样可以获得更佳的压缩率。但 brotli 压缩速度比 Gzip 压缩慢，因此 gzip 可能更适合于压缩不可缓存的内容。

  目前 Brotli已经获得各主流浏览器的支持。

- ### gzip 与 br 压缩率对比

  根据某些文章的比较：

  JavaScript 文件用 Brotli 压缩可以比 gzip 的小 14%。
  HTML 文件会小 21%。
  CSS 文件会小 17%

  参考：[Brotli 压缩同 Gzip 压缩之比较](https://seo.g2soft.net/2019/05/22/brotli-vs-gzip.html)

- ### br 压缩的兼容性

  目前，br 压缩的兼容性并不是很好，但是随着时间的推移，br 压缩的兼容性会越来越好。具体兼容性表，请参见：
    - [Can I use brotli](https://caniuse.com/?search=brotli)
    - [MDN Web Docs](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Content-Encoding#%E6%B5%8F%E8%A7%88%E5%99%A8%E5%85%BC%E5%AE%B9%E6%80%A7)
  
  除了浏览器的兼容性，还需要考虑服务器的兼容性，目前，nginx 1.16.0 以上版本支持 br 压缩，apache 2.4.26 以上版本支持 br 压缩。

## Vite 使用 br 压缩 （vite-plugin-compression）

### 1. 安装插件

```bash
npm i -D vite-plugin-compression
```

### 2. 配置 vite.config.ts

```ts
import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    // 其他插件
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],
})
```

## Vite 开启 br 压缩 （rollup-plugin-brotli）

### 1. 安装插件

```bash
npm i -D rollup-plugin-brotli
```

### 2. 配置 vite.config.ts

```ts
import { defineConfig } from 'vite'
import brotli from 'rollup-plugin-brotli'

export default defineConfig({
  plugins: [
    // 其他插件
    brotli(),
  ],
})
```

## Apache 开启 br 压缩

### 1. 安装 brotli 模块

```bash
sudo apt-get install brotli
```

### 2. 配置 Apache

- 安装 brotli 模块

  ```bash
  sudo apt-get install brotli
  ```

- 配置 Apache

  使用下面命令在 Apache 配置文件中启用 brotli 模块
    
    ```bash
    sudo a2enmod brotli
    ```

  之后，通过在虚拟主机配置文件中添加以下行来启用 brotli 压缩：

  ```bash
  <IfModule mod_brotli.c>
    AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/xml text/css text/javascript application/javascript application/x-javascript application/json application/xml application/rss+xml image/svg+xml
  </IfModule>
  ```

  保存文件并重新启动 Apache 服务器：

  ```bash
  sudo service apache2 restart
  ```

- <span id="verify-md">验证 Apache 是否开启 br 压缩</span>

  使用下面命令验证 Apache 是否开启 br 压缩

  ```bash
  curl -I -H 'Accept-Encoding: br' http://your-domain.com
  ```

  如果开启了 br 压缩，则会在返回信息中看到如下行：

  ```bash
  Content-Encoding: br
  ```

  除了上面的方法，还可以参考如下教程：

  [Apache压缩](https://blog.csdn.net/Parhoia/article/details/102753430)

## Nginx 开启 br 压缩

### 下载 Brotli 的源码；

```bash
yum install git && cd /usr/local/src

git clone https://github.com/google/ngx_brotli.git
pushd ngx_brotli
git submodule update --init
popd
```

### 执行命令 `nginx -V`，`configure arguments` 即为现有的参数；

```bash
nginx version: nginx/1.16.1
built by gcc 4.8.5 20150623 (Red Hat 4.8.5-36) (GCC) 
built with OpenSSL 1.1.1c  28 May 2019
TLS SNI support enabled
configure arguments: --with-http_ssl_module --with-http_v2_module --with-http_sub_module --with-openssl=../openssl-1.1.1c
```

### 追加参数 `--add-module=../ngx_brotli`，重新编译 Nginx。本文中 Nginx 的源码目录是 `/usr/local/src/nginx-1.16.1`；

```bash
cd nginx-1.16.1
./configure \
--with-http_ssl_module \
--with-http_v2_module \
--with-http_sub_module \
--with-openssl=../openssl-1.1.1c \
--add-module=../ngx_brotli
make && make install
```

如需执行平滑升级 (热部署)，make 之后请不要 make install：

```bash
mv /usr/local/nginx/sbin/nginx /usr/local/nginx/sbin/nginx.old
cp objs/nginx /usr/local/nginx/sbin/nginx
make upgrade
```

### 接着修改 `nginx.conf` (默认值就够用。不妨再留意一下 `gzip_types` 和 `brotli_types` 指令，以允许压缩 `text/html` 以外的文件，MIME 类型列表见)；

```bash
http {
    ...
    gzip on;
    brotli on;
    
    # gzip_types text/css text/javascript application/rss+xml;
    # brotli_types text/css text/javascript application/rss+xml;
    ...
}
```
### 重载 Nginx，检验效果。
```bash
nginx -t && nginx -s reload
```
可以参考上文 [验证 Apache 是否开启 br 压缩](#verify-md)
也可以可借由 Brotli Test 等工具，或者 Chrome DevTools 的 Network 面板，查看响应头中的 Content-Encoding 字段。
