const fs = require('fs-extra');
const path = require('path');

// 定义源路径
// oeos-st-extension 是完整的插件
const pluginSourceDir = path.join(__dirname, '..', 'oeos-st-extension');
const distDir = path.join(__dirname, 'dist');

// 最终目标目录在 SillyTavern
// 优先使用 src/SillyTavern-release，如果不存在则回退到 repo 根目录
// 允许通过环境变量 ST_EXT_DIR 覆盖（绝对路径）
const explicitExtDir = process.env.ST_EXT_DIR;
function resolveTargetDir() {
  if (explicitExtDir) {
    return explicitExtDir;
  }
  const baseCandidates = [
    path.join(__dirname, '..', 'SillyTavern-release'),       // e.g., <repo>/src/SillyTavern-release
    path.join(__dirname, '..', '..', 'SillyTavern-release'), // e.g., <repo>/SillyTavern-release
  ];
  for (const base of baseCandidates) {
    const publicDir = path.join(base, 'public');
    if (fs.existsSync(publicDir)) {
      return path.join(base, 'public', 'scripts', 'extensions', 'third-party', 'oeos-st-extension');
    }
  }
  // 默认使用 src/SillyTavern-release
  return path.join(__dirname, '..', 'SillyTavern-release', 'public', 'scripts', 'extensions', 'third-party', 'oeos-st-extension');
}

const finalTargetDir = resolveTargetDir();

try {
  console.log('Starting deployment process...');
  console.log(`Plugin Source: ${pluginSourceDir}`);
  console.log(`Build Source: ${distDir}`);
  console.log(`Target: ${finalTargetDir}`);

  // 检查插件源是否存在
  if (!fs.existsSync(pluginSourceDir)) {
    throw new Error(`Error: Plugin directory "${pluginSourceDir}" not found.`);
  }

  // 检查 dist 是否存在
  if (!fs.existsSync(distDir)) {
    throw new Error(`Error: Build directory "${distDir}" not found. Build may have failed.`);
  }

  // 确保最终目标目录存在
  fs.ensureDirSync(finalTargetDir);

  // 步骤 1: 将 Vue 构建产物复制到插件源目录（使其成为完整插件）
  console.log('\nStep 1: Merging Vue build artifacts into oeos-st-extension/...');
  fs.copySync(distDir, pluginSourceDir, { overwrite: true });
  console.log('✓ Build artifacts merged into plugin source');
  console.log(`  Plugin source is now complete at: ${pluginSourceDir}`);

  // 步骤 2: 复制完整的插件到 SillyTavern
  console.log('\nStep 2: Deploying complete plugin to SillyTavern...');
  fs.copySync(pluginSourceDir, finalTargetDir, { overwrite: true });
  console.log('✓ Complete plugin deployed');

  console.log('\n✓ Deployment finished successfully.');
  console.log(`  Plugin source (complete): ${pluginSourceDir}`);
  console.log(`  SillyTavern location: ${finalTargetDir}`);
  console.log('\nNote: src/oeos-st-extension/ now contains the complete plugin with all build artifacts.');

} catch (error) {
  console.error('\n✗ An error occurred during deployment:');
  console.error(error.message);
  process.exit(1);
}
