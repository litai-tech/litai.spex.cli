const chalk = require('chalk');
const ora = require('ora');
const { NodeSSH } = require('node-ssh');
const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadConfig } = require('../utils/config');

/**
 * Get local IP address
 * @returns {string|null} Local IP address
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return null;
}

/**
 * Generate IP mask from local IP
 * @param {string} ip - Local IP address
 * @returns {string} IP mask (e.g., "192.168.0")
 */
function generateMask(ip) {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

/**
 * Generate all IPs in a subnet
 * @param {string} mask - IP mask (e.g., "192.168.0")
 * @param {string} localIP - Local IP to exclude
 * @returns {string[]} Array of IP addresses
 */
function generateIPRange(mask, localIP) {
  const ips = [];
  for (let i = 1; i < 255; i++) {
    const ip = `${mask}.${i}`;
    if (ip !== localIP) {
      ips.push(ip);
    }
  }
  return ips;
}

/**
 * Try to connect to SSH on given IP
 * @param {string} ip - IP address
 * @param {string} username - SSH username
 * @param {string} password - SSH password (optional)
 * @param {number} timeout - Connection timeout in ms
 * @returns {Promise<boolean>} True if SSH port is accessible
 */
async function trySSHConnection(ip, username, password, timeout = 3000) {
  const ssh = new NodeSSH();
  
  try {
    const config = {
      host: ip,
      username: username,
      readyTimeout: timeout,
      tryKeyboard: false
    };
    
    if (password) {
      config.password = password;
    } else {
      // Try with agent or default keys
      config.agent = process.env.SSH_AUTH_SOCK;
    }
    
    await ssh.connect(config);
    ssh.dispose();
    return { success: true, authenticated: true };
  } catch (error) {
    ssh.dispose();
    
    // Check if it's an auth error (means SSH is running but wrong credentials)
    if (error.message.includes('Authentication') || 
        error.message.includes('authentication') ||
        error.message.includes('All configured authentication methods failed')) {
      return { success: true, authenticated: false };
    }
    
    return { success: false, authenticated: false };
  }
}

/**
 * Quick TCP port check for SSH (port 22)
 * @param {string} ip - IP address
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<boolean>}
 */
function checkSSHPort(ip, timeout = 1000) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(22, ip);
  });
}

/**
 * Prompt user for input
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User input
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Save IP to config file
 * @param {string} configPath - Path to config file
 * @param {string} ip - IP to save
 */
function saveToConfig(configPath, ip) {
  const fullPath = path.resolve(process.cwd(), configPath);
  
  let config = {};
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    config = JSON.parse(content);
  }
  
  if (!config.connection) {
    config.connection = {};
  }
  
  config.connection.host = ip;
  
  fs.writeFileSync(fullPath, JSON.stringify(config, null, 2));
}

/**
 * Scan command handler
 * @param {object} options - CLI options
 */
async function scanCommand(options) {
  const spinner = ora();
  
  console.log(chalk.cyan('\n🔍 LitAI-Spex Network Scanner\n'));
  
  try {
    // Load config for username/password
    const configPath = options.config || 'config.json';
    let config = {};
    
    try {
      config = loadConfig(configPath);
    } catch (e) {
      // Config might not exist, that's OK
    }
    
    // Get username from options or config
    const username = options.user || config.connection?.username;
    const password = options.password || config.connection?.password;
    
    if (!username) {
      console.log(chalk.red('❌ No username specified.'));
      console.log(chalk.gray('\nProvide it via:'));
      console.log(chalk.gray('   • CLI: litai-spex scan -u <username>'));
      console.log(chalk.gray('   • Config: Set "connection.username" in config.json\n'));
      process.exit(1);
    }
    
    // Get local IP
    spinner.start('Detecting local IP address...');
    const localIP = getLocalIP();
    
    if (!localIP) {
      spinner.fail('Could not detect local IP address');
      process.exit(1);
    }
    spinner.succeed(`Local IP: ${chalk.green(localIP)}`);
    
    // Generate or use provided mask
    const mask = options.mask || generateMask(localIP);
    console.log(chalk.gray(`   Scanning subnet: ${mask}.*\n`));
    
    // Generate IP range
    const ips = generateIPRange(mask, localIP);
    const foundHosts = [];
    
    console.log(chalk.cyan('📡 Scanning for SSH hosts...\n'));
    
    // Batch size for parallel scanning
    const batchSize = options.threads || 1;
    const timeout = options.timeout || 200;
    
    // Progress tracking
    let scanned = 0;
    const total = ips.length;
    
    // Scan in batches
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (ip) => {
          // First do a quick port check
          const portOpen = await checkSSHPort(ip, timeout);
          scanned++;
          
          // Update progress
          const percent = Math.round((scanned / total) * 100);
          const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(chalk.gray(`   [${bar}] ${percent}% (${scanned}/${total})`));
          
          if (portOpen) {
            return { ip, portOpen: true };
          }
          return { ip, portOpen: false };
        })
      );
      
      // Collect hosts with open SSH port
      for (const result of results) {
        if (result.portOpen) {
          foundHosts.push(result.ip);
        }
      }
    }
    
    console.log('\n\n');
    
    if (foundHosts.length === 0) {
      console.log(chalk.yellow('⚠️  No SSH hosts found in the subnet.\n'));
      process.exit(0);
    }
    
    console.log(chalk.green(`✅ Found ${foundHosts.length} host(s) with SSH port open:\n`));
    
    // Now try to authenticate to found hosts
    for (const ip of foundHosts) {
      spinner.start(`Testing SSH connection to ${ip}...`);
      
      const result = await trySSHConnection(ip, username, password, 5000);
      
      if (result.authenticated) {
        spinner.succeed(`${chalk.green(ip)} - SSH accessible ${chalk.green('(authenticated)')}`);
      } else if (result.success) {
        spinner.succeed(`${chalk.green(ip)} - SSH accessible ${chalk.yellow('(auth required)')}`);
      } else {
        spinner.info(`${chalk.gray(ip)} - SSH port open but connection failed`);
        continue;
      }
      
      // Ask user if they want to save this IP
      const answer = await prompt(chalk.cyan(`   Save ${ip} to config.json? (y/n): `));
      
      if (answer === 'y' || answer === 'yes') {
        try {
          saveToConfig(configPath, ip);
          console.log(chalk.green(`   ✅ Saved ${ip} to ${configPath}\n`));
        } catch (error) {
          console.log(chalk.red(`   ❌ Failed to save: ${error.message}\n`));
        }
      } else {
        console.log(chalk.gray('   Skipped.\n'));
      }
    }
    
    console.log(chalk.green('\n🎉 Scan completed!\n'));
    
  } catch (error) {
    spinner.fail('Scan failed');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = { scanCommand };
