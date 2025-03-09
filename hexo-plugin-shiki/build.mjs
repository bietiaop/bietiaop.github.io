import { build } from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';

// 主文件构建
await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['hexo-util', 'hexo'],
  outdir: 'dist',
  platform: 'node',
  sourcemap: false,
  tsconfig: 'tsconfig.json',
});

// 单独构建 lib 文件夹下的工具文件
await build({
  entryPoints: ['src/lib/highlight-tool.ts', 'src/lib/preview-support.ts'],
  outdir: 'dist/lib',
  platform: 'browser',
  format: 'cjs',
  sourcemap: false,
  tsconfig: 'tsconfig.json',
});

// 复制入口文件
await fs.copyFile('src/index.js', 'dist/index.js');
