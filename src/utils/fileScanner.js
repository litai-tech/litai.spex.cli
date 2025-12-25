const fs = require('fs');
const path = require('path');

/**
 * Check if a filename matches any pattern (supports * wildcard)
 * @param {string} filename - File name to check
 * @param {string[]} patterns - Array of patterns
 * @returns {boolean}
 */
function matchesPattern(filename, patterns) {
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(filename);
    }
    return filename === pattern;
  });
}

/**
 * Recursively scan directory and collect files to deploy
 * @param {string} dir - Directory to scan
 * @param {object} excludeConfig - Exclusion configuration
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Array<{local: string, remote: string}>} Array of file mappings
 */
function scanDirectory(dir, excludeConfig, baseDir = dir) {
  const { excludeDirectories, excludeFiles, excludePatterns } = excludeConfig;
  const files = [];
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Check if directory should be excluded
      if (excludeDirectories.includes(item)) {
        continue;
      }
      
      // Recursively scan subdirectory
      const subFiles = scanDirectory(fullPath, excludeConfig, baseDir);
      files.push(...subFiles);
    } else {
      // Check if file should be excluded
      if (excludeFiles.includes(item)) {
        continue;
      }
      
      // Check if file matches any exclude pattern
      if (matchesPattern(item, excludePatterns)) {
        continue;
      }
      
      files.push({
        local: fullPath,
        remote: relativePath.replace(/\\/g, '/') // Normalize to forward slashes for remote
      });
    }
  }
  
  return files;
}

/**
 * Get all directories that need to be created on remote
 * @param {Array<{local: string, remote: string}>} files - File mappings
 * @returns {string[]} Array of directory paths
 */
function getRemoteDirectories(files) {
  const dirs = new Set();
  
  for (const file of files) {
    const dir = path.dirname(file.remote);
    if (dir && dir !== '.') {
      // Add all parent directories as well
      const parts = dir.split('/');
      let current = '';
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        dirs.add(current);
      }
    }
  }
  
  // Sort by depth (shorter paths first) to ensure parent dirs are created first
  return Array.from(dirs).sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthA - depthB;
  });
}

module.exports = {
  scanDirectory,
  getRemoteDirectories,
  matchesPattern
};
