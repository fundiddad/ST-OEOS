const fs = require('fs-extra');
const path = require('path');

// Define paths
// Source for build artifacts
const sourceDir = path.join(__dirname, 'dist');

// Intermediate directory where build artifacts are merged with extension backend files
const intermediateDir = path.join(__dirname, 'oeos-st-extension');

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
  'oeos-st-extension' // as requested by user
);

try {
  console.log('Starting deployment process...');

  // Step 1: Copy build artifacts from dist to the intermediate extension directory
  console.log(`Step 1: Copying build artifacts from "${sourceDir}" to "${intermediateDir}"...`);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Error: Source directory "${sourceDir}" not found. Build may have failed.`);
  }
  // Copy contents of dist into intermediateDir
  fs.copySync(sourceDir, intermediateDir, { overwrite: true });
  console.log('Build artifacts copied successfully.');

  // Step 2: Copy the entire intermediate extension directory to the final SillyTavern destination
  console.log(`Step 2: Copying complete extension from "${intermediateDir}" to "${finalTargetDir}"...`);
  if (!fs.existsSync(intermediateDir)) {
    throw new Error(`Error: Intermediate directory "${intermediateDir}" not found.`);
  }
  // Ensure final destination exists
  fs.ensureDirSync(finalTargetDir);
  // Copy contents of intermediateDir into finalTargetDir
  fs.copySync(intermediateDir, finalTargetDir, { overwrite: true });
  console.log('Extension deployed to SillyTavern successfully.');

  console.log('\nDeployment finished.');

} catch (error) {
  console.error('\nAn error occurred during deployment:');
  console.error(error.message);
  process.exit(1);
}
