const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG } = require('../utils/config');

/**
 * Init command handler - creates a default deployment-config.json file
 */
async function initCommand() {
  const configPath = path.resolve(process.cwd(), 'deployment-config.json');
  
  console.log(chalk.cyan('\n🔧 LitAI-Spex Initialize\n'));
  
  // Check if config already exists
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow('⚠️  deployment-config.json already exists in this directory.'));
    console.log(chalk.gray('   Delete it first if you want to create a new one.\n'));
    process.exit(1);
  }
  
  // Create config file
  const configContent = {
    connection: {
      host: '192.168.1.100',
      username: 'deploy',
      password: '',
      privateKeyPath: '',
      targetDirectory: '/home/rock/ui'
    },
    deploy: {
      excludeDirectories: [
        'node_modules',
        'logs',
        '.git',
        '.idea',
        '.vscode',
        'coverage',
        'dist',
        '.cache'
      ],
      excludeFiles: [
        'package-lock.json',
        '.env.local',
        '.env.development',
        '.DS_Store',
        'deployment-config.json',
        'Thumbs.db'
      ],
      excludePatterns: [
        '*.log',
        '*.tmp',
        '*.bak',
        '*.swp',
        '*~'
      ]
    },
    scripts: {
      afterDeploy: 'deploy.sh'
    },
    project: {
      repositoryUrl: 'https://github.com/username/repo.git'
    }
  };
  
  fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

  console.log(chalk.green('✅ Created deployment-config.json\n'));
  console.log(chalk.gray('📝 Configuration file created with default settings.'));
  console.log(chalk.gray('   Edit deployment-config.json to set your connection details:\n'));
  console.log(chalk.white('   {'));
  console.log(chalk.white('     "connection": {'));
  console.log(chalk.cyan('       "host": "your-server-ip",'));
  console.log(chalk.cyan('       "username": "your-username",'));
  console.log(chalk.cyan('       "password": "your-password",'));
  console.log(chalk.gray('       // OR use private key:'));
  console.log(chalk.cyan('       "privateKeyPath": "~/.ssh/id_rsa",'));
  console.log(chalk.cyan('       "targetDirectory": "/var/www/app"'));
  console.log(chalk.white('     }'));
  console.log(chalk.white('   }\n'));
  
  console.log(chalk.gray('🔒 Security tip: Add deployment-config.json to .gitignore!\n'));
  
  // Create sample deploy.sh if it doesn't exist
  const deployShPath = path.resolve(process.cwd(), 'deploy.sh');
  if (!fs.existsSync(deployShPath)) {
    const deployShContent = `#!/bin/bash
# Deploy script - runs after files are uploaded
# This script runs on the remote server

echo "🚀 Running post-deployment tasks..."

# Example: Install dependencies
npm install

# Example: Build the project
# npm run build

# Example: Restart service
# sudo systemctl restart myapp

# Example: Clear cache
# rm -rf /tmp/app-cache/*

echo "✅ Post-deployment tasks completed!"
`;
    
    fs.writeFileSync(deployShPath, deployShContent);
    console.log(chalk.green('✅ Created sample deploy.sh\n'));
    console.log(chalk.gray('   Edit deploy.sh to add your post-deployment commands.'));
    console.log(chalk.gray('   Run with: litai-spex deploy -r\n'));
  }
}

module.exports = { initCommand };
