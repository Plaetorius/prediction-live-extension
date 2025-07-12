import { copyFileSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve } from 'path';

// Read and fix manifest.json
const manifestPath = 'manifest.json';
const manifestContent = readFileSync(manifestPath, 'utf8');
const fixedManifest = manifestContent
  .replace(/"dist\//g, '"')
  .replace(/dist\//g, '');

// Write fixed manifest to dist
writeFileSync('dist/manifest.json', fixedManifest);

// Copy popup.html to correct location and fix paths
try {
  let popupHtml = readFileSync('dist/src/popup/index.html', 'utf8');
  // Fix the paths by removing leading slashes
  popupHtml = popupHtml.replace('src="/popup.js"', 'src="popup.js"');
  popupHtml = popupHtml.replace('href="/index.css"', 'href="index.css"');
  writeFileSync('dist/popup.html', popupHtml);
} catch (error) {
  console.log('Popup HTML not found in expected location, checking alternatives...');
  try {
    let popupHtml = readFileSync('dist/popup.html', 'utf8');
    popupHtml = popupHtml.replace('src="/popup.js"', 'src="popup.js"');
    popupHtml = popupHtml.replace('href="/index.css"', 'href="index.css"');
    writeFileSync('dist/popup.html', popupHtml);
  } catch (error2) {
    console.log('Popup HTML not found, skipping...');
  }
}

// Copy icons if they exist
try {
  mkdirSync('dist/icons', { recursive: true });
  copyFileSync('icons/icon16.png', 'dist/icons/icon16.png');
  copyFileSync('icons/icon48.png', 'dist/icons/icon48.png');
  copyFileSync('icons/icon128.png', 'dist/icons/icon128.png');
} catch (error) {
  console.log('Icons not found, skipping...');
}

// Copy popup.css to content.css for content script
try {
  copyFileSync('dist/popup.css', 'dist/content.css');
} catch (error) {
  console.log('CSS file not found, skipping...');
}

// Remove all files that start with underscore (reserved names)
try {
  const distFiles = readdirSync('dist');
  distFiles.forEach(file => {
    if (file.startsWith('_')) {
      try {
        unlinkSync(`dist/${file}`);
        console.log(`Removed reserved file: ${file}`);
      } catch (error) {
        console.log(`Could not remove ${file}:`, error.message);
      }
    }
  });
} catch (error) {
  console.log('Could not read dist directory:', error.message);
}

console.log('Build completed! Extension files are in the dist/ folder.'); 