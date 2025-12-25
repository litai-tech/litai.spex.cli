const chalk = require('chalk');
const ora = require('ora');
const { NodeSSH } = require('node-ssh');
const { loadConfig } = require('../utils/config');

/**
 * Quick TCP port check for SSH (port 22)
 * @param {string} ip - IP address
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<object>} { success: boolean, duration: number }
 */
function checkSSHPort(ip, timeout = 5000) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    const startTime = Date.now();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const duration = Date.now() - startTime;
      socket.destroy();
      resolve({ success: true, duration });
    });

    socket.on('timeout', () => {
      const duration = Date.now() - startTime;
      socket.destroy();
      resolve({ success: false, duration });
    });

    socket.on('error', (err) => {
      const duration = Date.now() - startTime;
      socket.destroy();
      resolve({ success: false, duration });
    });

    socket.connect(22, ip);
  });
}

/**
 * Try to connect to SSH on given IP
 * @param {string} ip - IP address
 * @param {string} username - SSH username
 * @param {string} password - SSH password (optional)
 * @param {number} timeout - Connection timeout in ms
 * @returns {Promise<object>} Connection result
 */
async function trySSHConnection(ip, username, password, timeout = 10000) {
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
    console.log(config)
    await ssh.connect(config);
    ssh.dispose();
    return { success: true, authenticated: true, error: null };
  } catch (error) {
    ssh.dispose();

    // Check if it's an auth error (means SSH is running but wrong credentials)
    if (error.message.includes('Authentication') ||
        error.message.includes('authentication') ||
        error.message.includes('All configured authentication methods failed')) {
      return { success: true, authenticated: false, error: 'Authentication failed' };
    }

    return { success: false, authenticated: false, error: error.message };
  }
}

/**
 * Ping command handler
 * @param {string} host - Host IP or hostname
 * @param {object} options - CLI options
 */
async function pingCommand(host, options) {
  const spinner = ora();

  console.log(chalk.cyan('\n🔍 LitAI-Spex Connection Tester\n'));

  if (!host) {
    console.log(chalk.red('❌ No host specified.'));
    console.log(chalk.gray('\nUsage:'));
    console.log(chalk.gray('   litai-spex ping <host>'));
    console.log(chalk.gray('   litai-spex ping <host> -u <username>'));
    console.log(chalk.gray('   litai-spex ping <host> -u <username> -p <password>\n'));
    process.exit(1);
  }

  try {
    const timeout = options.timeout || 5000;

    console.log(chalk.gray(`Target: ${host}`));
    console.log(chalk.gray(`Timeout: ${timeout}ms\n`));

    // Step 1: Check SSH port
    spinner.start(`Checking SSH port (22) on ${host}...`);
    const portCheck = await checkSSHPort(host, timeout);

    if (!portCheck.success) {
      spinner.fail(`SSH port is not accessible on ${host} (took ${portCheck.duration}ms)`);
      console.log(chalk.yellow('\n💡 Possible reasons:'));
      console.log(chalk.gray('   • Host is down or unreachable'));
      console.log(chalk.gray('   • Firewall blocking port 22'));
      console.log(chalk.gray('   • SSH service not running'));
      console.log(chalk.gray('   • Network timeout (try increasing with --timeout)\n'));
      process.exit(1);
    }

    spinner.succeed(`SSH port is ${chalk.green('OPEN')} on ${host} ${chalk.gray(`(${portCheck.duration}ms)`)}`);
    console.log(chalk.cyan(`\n⏱️  Connection time: ${portCheck.duration}ms`));
    console.log(chalk.gray(`   Recommended timeout for scan: ${Math.ceil(portCheck.duration * 1.5)}ms or higher\n`));

    // Step 2: Try SSH connection if username provided
    if (options.user) {
      const username = options.user;
      const password = options.password;

      console.log(chalk.gray(`Attempting SSH authentication as ${username}...\n`));

      spinner.start(`Connecting to ${username}@${host}...`);
      const sshStartTime = Date.now();
      const result = await trySSHConnection(host, username, password, timeout);
      const sshDuration = Date.now() - sshStartTime;

      if (result.authenticated) {
        spinner.succeed(`SSH connection ${chalk.green('SUCCESSFUL')} - authenticated as ${username} ${chalk.gray(`(${sshDuration}ms)`)}`);
        console.log(chalk.green('\n✅ You can connect to this host!\n'));
      } else if (result.success) {
        spinner.warn(`SSH is running but ${chalk.yellow('authentication failed')} ${chalk.gray(`(${sshDuration}ms)`)}`);
        console.log(chalk.yellow('\n⚠️  The host is accessible but credentials are incorrect.'));
        console.log(chalk.gray('\nTry:'));
        console.log(chalk.gray(`   ssh ${username}@${host}`));
        console.log(chalk.gray('   to test manually\n'));
      } else {
        spinner.fail(`SSH connection failed ${chalk.gray(`(${sshDuration}ms)`)}`);
        console.log(chalk.red(`\n❌ Error: ${result.error}\n`));
      }
    } else {
      console.log(chalk.green('\n✅ SSH port is accessible!'));
      console.log(chalk.gray('\n💡 To test SSH authentication, add: -u <username>\n'));
    }

  } catch (error) {
    spinner.fail('Ping failed');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = { pingCommand };
