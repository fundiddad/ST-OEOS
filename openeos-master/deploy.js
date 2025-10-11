const fs = require('fs-extra');
const path = require('path');

// Define paths
// Source for build artifacts (Vue build output)
const sourceDir = path.join(__dirname, 'dist');
// Source for plugin core files (tracked in git)
const pluginCoreDir = path.join(__dirname, '..', 'oeos-plugin-core');

// Final destination in SillyTavern
// Prefer src/SillyTavern-release if it exists; fall back to repo root/SillyTavern-release
// Allow override via environment variable ST_EXT_DIR (absolute path to extension folder)
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
  // Default to src/SillyTavern-release
  return path.join(__dirname, '..', 'SillyTavern-release', 'public', 'scripts', 'extensions', 'third-party', 'oeos-st-extension');
}

const finalTargetDir = resolveTargetDir();

try {
  console.log('Starting deployment process...');

  console.log(`Copying build artifacts from "${sourceDir}" to "${finalTargetDir}"...`);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Error: Source directory "${sourceDir}" not found. Build may have failed.`);
  }

  // Ensure final destination exists
  fs.ensureDirSync(finalTargetDir);

  // Copy plugin core first (if present)
  if (fs.existsSync(pluginCoreDir)) {
    console.log(`Copying plugin core from "${pluginCoreDir}" ...`);
    fs.copySync(pluginCoreDir, finalTargetDir, { overwrite: true });
  } else {
    console.warn(`Plugin core directory not found: ${pluginCoreDir}. Skipping.`);
  }

  // Then copy Vue build artifacts into the same extension folder
  fs.copySync(sourceDir, finalTargetDir, { overwrite: true });

  console.log('Extension deployed to SillyTavern successfully.');
  console.log('\nDeployment finished.');

} catch (error) {
  console.error('\nAn error occurred during deployment:');
  console.error(error.message);
  process.exit(1);
}
