const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('../utils/config');

/**
 * Create project command handler - clones a git repo from config
 * @param {object} options - CLI options
 */
async function createProjectCommand(options) {
  const spinner = ora();
  
  console.log(chalk.cyan('\n📦 LitAI-Spex Create Project\n'));
  
  try {
    // Load configuration
    spinner.start('Loading configuration...');
    const configPath = options.config || 'config.json';
    const config = loadConfig(configPath);
    spinner.succeed('Configuration loaded');
    
    // Get repo URL from config or CLI
    const repoUrl = options.repo || config.project?.repositoryUrl;
    
    if (!repoUrl) {
      console.log(chalk.red('\n❌ No repository URL specified.'));
      console.log(chalk.gray('\nProvide it via:'));
      console.log(chalk.gray('   • CLI: litai-spex create-project --repo <url>'));
      console.log(chalk.gray('   • Config: Add "project.repositoryUrl" to config.json\n'));
      console.log(chalk.white('   Example config.json:'));
      console.log(chalk.gray('   {'));
      console.log(chalk.gray('     "project": {'));
      console.log(chalk.cyan('       "repositoryUrl": "https://github.com/user/repo.git"'));
      console.log(chalk.gray('     }'));
      console.log(chalk.gray('   }\n'));
      process.exit(1);
    }
    
    // Determine target directory
    const targetDir = options.dir || config.project?.targetDirectory || '.';
    const fullTargetPath = path.resolve(process.cwd(), targetDir);
    
    // Extract repo name for folder name if cloning to current dir
    let cloneDir = fullTargetPath;
    if (targetDir === '.' && !options.name) {
      // Will clone into repo name folder by default
    } else if (options.name) {
      cloneDir = path.resolve(process.cwd(), options.name);
    }
    
    // Check if git is installed
    try {
      execSync('git --version', { stdio: 'pipe' });
    } catch (e) {
      console.log(chalk.red('\n❌ Git is not installed or not in PATH.'));
      console.log(chalk.gray('   Please install Git: https://git-scm.com/downloads\n'));
      process.exit(1);
    }
    
    // Display clone info
    console.log(chalk.gray('\n📋 Clone Details:'));
    console.log(chalk.gray(`   Repository: ${repoUrl}`));
    console.log(chalk.gray(`   Target: ${cloneDir === fullTargetPath ? 'Current directory' : cloneDir}`));
    
    if (options.branch) {
      console.log(chalk.gray(`   Branch: ${options.branch}`));
    }
    console.log('');
    
    // Build git clone command
    let gitCommand = 'git clone';
    
    if (options.branch) {
      gitCommand += ` -b ${options.branch}`;
    }
    
    if (options.depth) {
      gitCommand += ` --depth ${options.depth}`;
    }
    
    gitCommand += ` "${repoUrl}"`;
    
    if (options.name) {
      gitCommand += ` "${options.name}"`;
    }
    
    // Clone the repository
    spinner.start('Cloning repository...');
    
    try {
      execSync(gitCommand, { 
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      spinner.succeed('Repository cloned successfully');
    } catch (error) {
      spinner.fail('Clone failed');
      const errorMessage = error.stderr?.toString() || error.message;
      console.log(chalk.red(`\n   ${errorMessage}`));
      process.exit(1);
    }
    
    // Determine the cloned directory name
    let clonedDirName = options.name;
    if (!clonedDirName) {
      // Extract from URL
      clonedDirName = repoUrl
        .split('/')
        .pop()
        .replace(/\.git$/, '');
    }
    
    const clonedPath = path.resolve(process.cwd(), clonedDirName);
    
    // Check if package.json exists and offer to install dependencies
    const packageJsonPath = path.join(clonedPath, 'package.json');
    if (fs.existsSync(packageJsonPath) && options.install !== false) {
      if (options.install) {
        spinner.start('Installing dependencies...');
        try {
          execSync('npm install', { 
            cwd: clonedPath,
            stdio: 'pipe'
          });
          spinner.succeed('Dependencies installed');
        } catch (error) {
          spinner.warn('Failed to install dependencies');
          console.log(chalk.yellow(`   Run 'cd ${clonedDirName} && npm install' manually`));
        }
      } else {
        console.log(chalk.gray(`\n💡 Tip: Run 'cd ${clonedDirName} && npm install' to install dependencies`));
      }
    }
    
    console.log(chalk.green(`\n✅ Project created successfully!`));
    console.log(chalk.gray(`   Location: ${clonedPath}\n`));
    
    // Show next steps
    console.log(chalk.cyan('📝 Next steps:'));
    console.log(chalk.white(`   cd ${clonedDirName}`));
    if (fs.existsSync(packageJsonPath) && !options.install) {
      console.log(chalk.white('   npm install'));
    }
    console.log('');
    
  } catch (error) {
    spinner.fail('Operation failed');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = { createProjectCommand };
