const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  connection: {
    host: '',
    username: '',
    password: '',
    privateKeyPath: '',
    targetDirectory: '/var/www/app'
  },
  deploy: {
    excludeDirectories: ['node_modules', 'logs', '.git', '.idea', '.vscode'],
    excludeFiles: ['package-lock.json', '.env.local', '.DS_Store'],
    excludePatterns: ['*.log', '*.tmp']
  },
  scripts: {
    afterDeploy: 'deploy.sh'
  },
  project: {
    repositoryUrl: '',
    targetDirectory: '.'
  }
};

/**
 * Load configuration from file
 * @param {string} configPath - Path to config file
 * @returns {object} Configuration object
 */
function loadConfig(configPath) {
  const fullPath = path.resolve(process.cwd(), configPath);
  
  if (!fs.existsSync(fullPath)) {
    return { ...DEFAULT_CONFIG };
  }
  
  try {
    const configContent = fs.readFileSync(fullPath, 'utf8');
    const userConfig = JSON.parse(configContent);
    
    // Deep merge with defaults
    return {
      connection: { ...DEFAULT_CONFIG.connection, ...userConfig.connection },
      deploy: {
        excludeDirectories: userConfig.deploy?.excludeDirectories || DEFAULT_CONFIG.deploy.excludeDirectories,
        excludeFiles: userConfig.deploy?.excludeFiles || DEFAULT_CONFIG.deploy.excludeFiles,
        excludePatterns: userConfig.deploy?.excludePatterns || DEFAULT_CONFIG.deploy.excludePatterns
      },
      scripts: { ...DEFAULT_CONFIG.scripts, ...userConfig.scripts },
      project: { ...DEFAULT_CONFIG.project, ...userConfig.project }
    };
  } catch (error) {
    throw new Error(`Failed to parse config file: ${error.message}`);
  }
}

/**
 * Merge CLI options with config file settings (CLI takes precedence)
 * @param {object} config - Config from file
 * @param {object} options - CLI options
 * @returns {object} Merged configuration
 */
function mergeWithCliOptions(config, options) {
  return {
    ...config,
    connection: {
      ...config.connection,
      host: options.ip || config.connection.host,
      username: options.user || config.connection.username,
      password: options.password || config.connection.password,
      privateKeyPath: options.key || config.connection.privateKeyPath,
      targetDirectory: options.directory || config.connection.targetDirectory
    }
  };
}

/**
 * Validate that required connection settings are present
 * @param {object} config - Configuration object
 * @returns {object} Object with isValid boolean and missing fields array
 */
function validateConfig(config) {
  const missing = [];
  
  if (!config.connection.host) missing.push('host (use -ip or set in config.json)');
  if (!config.connection.username) missing.push('username (use -u or set in config.json)');
  if (!config.connection.password && !config.connection.privateKeyPath) {
    missing.push('password or privateKeyPath (use -p/-k or set in config.json)');
  }
  if (!config.connection.targetDirectory) missing.push('targetDirectory (use -dir or set in config.json)');
  
  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Create default config file
 * @param {string} configPath - Path to create config file
 */
function createDefaultConfig(configPath) {
  const fullPath = path.resolve(process.cwd(), configPath);
  fs.writeFileSync(fullPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return fullPath;
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  mergeWithCliOptions,
  validateConfig,
  createDefaultConfig
};
