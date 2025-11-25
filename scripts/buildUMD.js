const path = require("path");
const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

const { woff2ServerPlugin } = require("./woff2/woff2-esbuild-plugins");

// UMD 构建配置
const getUMDConfig = (outdir) => ({
  outdir,
  bundle: true,
  format: "iife", // 立即执行函数表达式，类似 UMD
  globalName: "ExcalidrawLibV2", // 全局变量名
  entryPoints: [path.resolve(__dirname, "./umd-entry.js")],
  entryNames: "excalidraw.umd",
  assetNames: "[dir]/[name]",
  target: "es2020",
  // 所有依赖都打包进来，包括 React
  external: [],
  // 配置路径别名，确保正确解析所有子包
  alias: {
    "@excalidraw/common": path.resolve(__dirname, "../packages/common/src"),
    "@excalidraw/element": path.resolve(__dirname, "../packages/element/src"),
    "@excalidraw/math": path.resolve(__dirname, "../packages/math/src"),
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    global: "globalThis",
  },
  loader: {
    ".woff2": "file",
    ".woff": "file",
    ".ttf": "file",
    ".eot": "file",
    ".svg": "file",
    ".png": "file",
    ".jpg": "file",
    ".jpeg": "file",
  },
});

// 构建 UMD 开发版本
function buildUMDDev(config) {
  return build({
    ...config,
    sourcemap: true,
    plugins: [sassPlugin(), woff2ServerPlugin()],
    define: {
      ...config.define,
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
}

// 构建 UMD 生产版本
function buildUMDProd(config) {
  return build({
    ...config,
    minify: true,
    plugins: [
      sassPlugin(),
      woff2ServerPlugin({
        outdir: `${config.outdir}/assets`,
      }),
    ],
    define: {
      ...config.define,
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
}

const createUMDBuild = async () => {
  console.log("🚀 开始构建完整的 UMD 包...");
  console.log("📦 包含的所有依赖:");
  console.log("  • @excalidraw/excalidraw (主包)");
  console.log("  • @excalidraw/common (通用工具)");
  console.log("  • @excalidraw/element (元素处理)");
  console.log("  • @excalidraw/math (数学计算)");
  console.log("  • @excalidraw/utils (工具函数)");
  console.log("  • React + ReactDOM (完整打包)");
  console.log("  • 所有其他依赖");

  try {
    console.log("\n🔧 构建 UMD 开发版本...");
    const devResult = await buildUMDDev(getUMDConfig("dist/umd/dev"));
    console.log("✅ 开发版本构建完成!");

    console.log("🔧 构建 UMD 生产版本...");
    const prodResult = await buildUMDProd(getUMDConfig("dist/umd/prod"));
    console.log("✅ 生产版本构建完成!");

    console.log("\n🎉 完整 UMD 包构建成功！");
    console.log("📂 输出目录:");
    console.log("  - dist/umd/dev/excalidraw.umd.js (开发版，带 sourcemap)");
    console.log("  - dist/umd/prod/excalidraw.umd.js (生产版，已压缩)");
    console.log("\n💡 使用方法（无需额外引入 React）:");
    console.log(`  <script src="./dist/umd/prod/excalidraw.umd.js"></script>`);
    console.log(`  <script>const { Excalidraw } = ExcalidrawLib;</script>`);
    console.log("\n🔥 特性:");
    console.log("  ✓ 包含 React，无需额外依赖");
    console.log("  ✓ 包含所有 Excalidraw 子包");
    console.log("  ✓ 支持完整的绘图功能");
    console.log("  ✓ 一个文件搞定所有依赖");
  } catch (error) {
    console.error("❌ UMD 构建失败:", error);
    throw error;
  }
};

if (require.main === module) {
  createUMDBuild().catch(console.error);
}

module.exports = { createUMDBuild };
