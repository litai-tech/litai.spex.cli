#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { deployCommand } = require('./commands/deploy');
const { initCommand } = require('./commands/init');
const { createProjectCommand } = require('./commands/create-project');
const { scanCommand } = require('./commands/scan');
const { pingCommand } = require('./commands/ping');
const pkg = require('../package.json');

program
  .name('litai-spex')
  .description('CLI tool for deploying files via SSH')
  .version(pkg.version);

program
  .command('deploy')
  .description('Deploy files from current directory to remote server via SSH')
  .option('-ip, --ip <host>', 'Target server IP/hostname')
  .option('-u, --user <username>', 'SSH username')
  .option('-p, --password <password>', 'SSH password')
  .option('-dir, --directory <path>', 'Target directory on remote server')
  .option('-k, --key <path>', 'Path to private key file (alternative to password)')
  .option('-r, --run [script]', 'Run script after deployment (default: deploy.sh)')
  .option('-c, --config <path>', 'Path to config file (default: deployment-config.json)')
  .action(deployCommand);

program
  .command('init')
  .description('Initialize a deployment-config.json file with default settings')
  .action(initCommand);

program
  .command('create-project')
  .description('Clone a git repository from URL specified in config or CLI')
  .option('--repo <url>', 'Git repository URL (overrides config)')
  .option('--name <n>', 'Directory name for the cloned project')
  .option('-b, --branch <branch>', 'Branch to clone')
  .option('--depth <depth>', 'Create a shallow clone with specified depth')
  .option('-i, --install', 'Auto-install npm dependencies after clone')
  .option('-c, --config <path>', 'Path to config file (default: deployment-config.json)')
  .action(createProjectCommand);

program
  .command('scan')
  .description('Scan local network for SSH hosts')
  .option('-m, --mask <mask>', 'IP mask to scan (e.g., 192.168.1)')
  .option('-u, --user <username>', 'SSH username to test')
  .option('-p, --password <password>', 'SSH password to test')
  .option('-t, --timeout <ms>', 'Connection timeout in milliseconds (default: 1000)', parseInt)
  .option('--threads <n>', 'Number of parallel scans (default: 20)', parseInt)
  .option('-c, --config <path>', 'Path to config file (default: deployment-config.json)')
  .action(scanCommand);

program
  .command('ping <host>')
  .description('Test SSH connectivity to a specific host')
  .option('-u, --user <username>', 'SSH username to test authentication')
  .option('-p, --password <password>', 'SSH password to test authentication')
  .option('-t, --timeout <ms>', 'Connection timeout in milliseconds (default: 5000)', parseInt)
  .action(pingCommand);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
