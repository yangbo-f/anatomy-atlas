# Anatomy Atlas

基于 Vite、Three.js 和真实 GLB 解剖模型构建的交互式人体三维解剖展示网站。

## 本地运行

```bash
npm install
npm run dev
```

模型文件存放在 `public/models/`。Vite 开发服务器和生产构建都会从该目录提供 GLB 文件。

## GitHub Pages

项目使用 `/anatomy-atlas/` 作为 GitHub Pages 基础路径，并通过
`.github/workflows/deploy-pages.yml` 在每次推送到 `main` 后自动构建和发布。

仓库 Pages 设置需要选择：

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

发布地址：

```text
https://yangbo-f.github.io/anatomy-atlas/
```

## 模型适配

项目已按目录中的 9 个文件名建立系统映射，并读取 GLB 内部的 Z-Anatomy 节点层级：

- `Regions_of_human_body.glb`
- `skeletal_system.glb`
- `joints.glb`
- `muscular_syetem.glb`
- `muscelar_insertions.glb`
- `cardiovascular_system.glb`
- `nervous_system.glb`
- `visceral_systems.glb`
- `lymphoid_organs.glb`

部分源文件内容的 SHA-256 完全相同，并且每个 GLB 都包含完整的 Z-Anatomy 顶层集合。查看器会按系统自动匹配并显示对应的真实节点组，而不是依赖 Blender 中没有写入 GLB 的集合可见状态。
