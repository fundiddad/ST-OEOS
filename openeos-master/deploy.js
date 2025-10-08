const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Define paths
const sourceDir = path.join(__dirname, 'dist')
const targetDir = path.join(
  __dirname,
  '..',
  'SillyTavern-release',
  'public',
  'scripts',
  'extensions',
  'third-party',
  'oeos'
)

// Helper function to recursively copy a directory
function copyDirSync(src, dest) {
  // To be safe, create the destination directory if it doesn't exist
  fs.mkdirSync(dest, { recursive: true })
  let entries = fs.readdirSync(src, { withFileTypes: true })

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name)
    let destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      // Check if destination directory exists, if not, create it.
      // This handles cases where the source is a flat list of files.
      const destDir = path.dirname(destPath)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

try {
  // Step 1: Copy files from dist to the target directory
  console.log(`Copying files from ${sourceDir} to ${targetDir}...`)

  if (!fs.existsSync(sourceDir)) {
    console.error('Error: "dist" directory not found. Build may have failed.')
    process.exit(1)
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  copyDirSync(sourceDir, targetDir)

  console.log('Files copied successfully.')
  console.log('Deployment finished.')
} catch (error) {
  console.error('An error occurred during deployment:', error)
  process.exit(1)
}
