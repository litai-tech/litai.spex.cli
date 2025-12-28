const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { loadConfig, mergeWithCliOptions, validateConfig } = require('../utils/config');
const { scanDirectory, getRemoteDirectories } = require('../utils/fileScanner');
const { SSHDeployer } = require('../utils/sshDeployer');

/**
 * Deploy command handler
 * @param {object} options - CLI options
 */
async function deployCommand(options) {
  const spinner = ora();
  const deployer = new SSHDeployer();
  
  console.log(chalk.cyan('\n🚀 LitAI-Spex Deploy\n'));
  
  try {
    // Load and merge configuration
    spinner.start('Loading configuration...');
    const configPath = options.config || 'deployment-config.json';
    let config = loadConfig(configPath);
    config = mergeWithCliOptions(config, options);
    spinner.succeed('Configuration loaded');
    
    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.isValid) {
      console.log(chalk.red('\n❌ Missing required configuration:'));
      validation.missing.forEach(field => {
        console.log(chalk.yellow(`   • ${field}`));
      });
      console.log(chalk.gray('\nRun `litai-spex init` to create a config file or provide options via CLI.\n'));
      process.exit(1);
    }
    
    // Display connection info
    console.log(chalk.gray('\n📡 Connection Details:'));
    console.log(chalk.gray(`   Host: ${config.connection.host}`));
    console.log(chalk.gray(`   User: ${config.connection.username}`));
    console.log(chalk.gray(`   Target: ${config.connection.targetDirectory}`));
    console.log(chalk.gray(`   Auth: ${config.connection.privateKeyPath ? 'Private Key' : 'Password'}\n`));
    
    // Scan local files
    spinner.start('Scanning local files...');
    const sourceDir = process.cwd();
    const files = scanDirectory(sourceDir, config.deploy);
    const directories = getRemoteDirectories(files);
    spinner.succeed(`Found ${chalk.green(files.length)} files to deploy`);
    
    if (files.length === 0) {
      console.log(chalk.yellow('\n⚠️  No files to deploy. Check your exclude settings.\n'));
      process.exit(0);
    }
    
    // Display exclusions
    console.log(chalk.gray('\n📋 Exclusions:'));
    console.log(chalk.gray(`   Directories: ${config.deploy.excludeDirectories.join(', ')}`));
    console.log(chalk.gray(`   Files: ${config.deploy.excludeFiles.join(', ')}`));
    console.log(chalk.gray(`   Patterns: ${config.deploy.excludePatterns.join(', ')}\n`));
    
    // Connect to server
    spinner.start(`Connecting to ${config.connection.host}...`);
    await deployer.connect(config.connection);
    spinner.succeed('Connected to server');
    
    // Get server info
    try {
      const serverInfo = await deployer.getServerInfo();
      console.log(chalk.gray(`   Server: ${serverInfo.hostname} (${serverInfo.os})`));
      console.log(chalk.gray(`   Uptime: ${serverInfo.uptime}\n`));
    } catch (e) {
      // Server info is optional, don't fail if it doesn't work
    }
    
    // Create directories
    if (directories.length > 0) {
      spinner.start(`Creating ${directories.length} directories...`);
      await deployer.createDirectories(config.connection.targetDirectory, directories);
      spinner.succeed(`Created ${directories.length} directories`);
    }
    
    // Upload files
    console.log(chalk.cyan('\n📤 Uploading files...\n'));
    
    let lastPercent = -1;
    await deployer.uploadFiles(
      config.connection.targetDirectory,
      files,
      (current, total, filename) => {
        const percent = Math.round((current / total) * 100);
        if (percent !== lastPercent) {
          lastPercent = percent;
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
          process.stdout.write(chalk.cyan(`   [${bar}] ${percent}% - ${filename}`));
        }
      }
    );
    
    console.log('\n');
    console.log(chalk.green(`✅ Successfully uploaded ${files.length} files\n`));
    
    // Execute script if requested
    if (options.run !== undefined) {
      const scriptName = typeof options.run === 'string' ? options.run : config.scripts.afterDeploy;
      
      console.log(chalk.cyan(`\n🔧 Executing script: ${scriptName}\n`));
      spinner.start('Running script...');
      
      try {
        const result = await deployer.executeScript(config.connection.targetDirectory, scriptName);
        spinner.succeed('Script executed');
        
        if (result.stdout) {
          console.log(chalk.gray('\n📋 Script output:'));
          console.log(chalk.white(result.stdout));
        }
        
        if (result.stderr) {
          console.log(chalk.yellow('\n⚠️  Script stderr:'));
          console.log(chalk.yellow(result.stderr));
        }
        
        if (result.code !== 0) {
          console.log(chalk.yellow(`\n⚠️  Script exited with code: ${result.code}`));
        }
      } catch (scriptError) {
        spinner.fail('Script execution failed');
        console.log(chalk.red(`   ${scriptError.message}`));
      }
    }
    
    // Disconnect
    deployer.disconnect();
    
    console.log(chalk.green('\n🎉 Deployment completed successfully!\n'));
    
  } catch (error) {
    spinner.fail('Deployment failed');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log(chalk.yellow('   Hint: Check if the server is running and accessible.'));
    } else if (error.message.includes('Authentication')) {
      console.log(chalk.yellow('   Hint: Check your username and password/key.'));
    }
    
    deployer.disconnect();
    process.exit(1);
  }
}

module.exports = { deployCommand };
