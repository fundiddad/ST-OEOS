const fs = require('fs-extra');
const path = require('path');

// Define paths
// Source for build artifacts
const sourceDir = path.join(__dirname, 'dist');

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

  // Copy contents of dist into finalTargetDir
  fs.copySync(sourceDir, finalTargetDir, { overwrite: true });

  console.log('Extension deployed to SillyTavern successfully.');
  console.log('\nDeployment finished.');

} catch (error) {
  console.error('\nAn error occurred during deployment:');
  console.error(error.message);
  process.exit(1);
}
