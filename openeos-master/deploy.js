const fs = require('fs-extra');
const path = require('path');

// Define paths
// Source for build artifacts (Vue build output)
const sourceDir = path.join(__dirname, 'dist');
// Source for plugin core files (tracked in git)
const pluginCoreDir = path.join(__dirname, '..', 'oeos-plugin-core');

// Final destination in SillyTavern
const finalTargetDir = path.join(
  __dirname,
  '..', // up to src
  '..', // up to root E:\AItease\ST_oeos
  'SillyTavern-release',
  'public',
  'scripts',
  'extensions',
  'third-party',
  'oeos-st-extension'
);

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
