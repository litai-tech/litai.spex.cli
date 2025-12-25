const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

class SSHDeployer {
  constructor() {
    this.ssh = new NodeSSH();
    this.connected = false;
  }
  
  /**
   * Connect to remote server
   * @param {object} connectionConfig - Connection configuration
   */
  async connect(connectionConfig) {
    const config = {
      host: connectionConfig.host,
      username: connectionConfig.username
    };
    
    if (connectionConfig.privateKeyPath) {
      const keyPath = path.resolve(process.cwd(), connectionConfig.privateKeyPath);
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Private key file not found: ${keyPath}`);
      }
      config.privateKey = fs.readFileSync(keyPath, 'utf8');
    } else if (connectionConfig.password) {
      config.password = connectionConfig.password;
    } else {
      throw new Error('No authentication method provided (password or private key)');
    }
    
    await this.ssh.connect(config);
    this.connected = true;
  }
  
  /**
   * Disconnect from remote server
   */
  disconnect() {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
    }
  }
  
  /**
   * Create directories on remote server
   * @param {string} baseDir - Base directory on remote
   * @param {string[]} directories - Array of directory paths relative to baseDir
   * @param {function} onProgress - Progress callback
   */
  async createDirectories(baseDir, directories, onProgress) {
    // First ensure base directory exists
    await this.ssh.execCommand(`mkdir -p "${baseDir}"`);
    
    for (const dir of directories) {
      const fullPath = `${baseDir}/${dir}`;
      await this.ssh.execCommand(`mkdir -p "${fullPath}"`);
      if (onProgress) onProgress(dir);
    }
  }
  
  /**
   * Upload files to remote server
   * @param {string} baseDir - Base directory on remote
   * @param {Array<{local: string, remote: string}>} files - File mappings
   * @param {function} onProgress - Progress callback (receives current file index and total)
   */
  async uploadFiles(baseDir, files, onProgress) {
    const total = files.length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const remotePath = `${baseDir}/${file.remote}`;
      
      await this.ssh.putFile(file.local, remotePath);
      
      if (onProgress) {
        onProgress(i + 1, total, file.remote);
      }
    }
  }
  
  /**
   * Execute a script on remote server
   * @param {string} baseDir - Base directory on remote
   * @param {string} scriptName - Script filename
   * @returns {object} Execution result with stdout and stderr
   */
  async executeScript(baseDir, scriptName) {
    const scriptPath = `${baseDir}/${scriptName}`;
    
    // First check if script exists
    const checkResult = await this.ssh.execCommand(`test -f "${scriptPath}" && echo "exists"`);
    if (!checkResult.stdout.includes('exists')) {
      throw new Error(`Script not found: ${scriptPath}`);
    }
    
    // Make script executable
    await this.ssh.execCommand(`chmod +x "${scriptPath}"`);
    
    // Execute script
    const result = await this.ssh.execCommand(`cd "${baseDir}" && bash "${scriptPath}"`, {
      cwd: baseDir
    });
    
    return result;
  }
  
  /**
   * Check if remote directory exists
   * @param {string} dir - Directory path
   * @returns {boolean}
   */
  async directoryExists(dir) {
    const result = await this.ssh.execCommand(`test -d "${dir}" && echo "exists"`);
    return result.stdout.includes('exists');
  }
  
  /**
   * Get remote server info
   * @returns {object} Server info
   */
  async getServerInfo() {
    const hostname = await this.ssh.execCommand('hostname');
    const os = await this.ssh.execCommand('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'');
    const uptime = await this.ssh.execCommand('uptime -p 2>/dev/null || uptime');
    
    return {
      hostname: hostname.stdout.trim(),
      os: os.stdout.trim() || 'Unknown',
      uptime: uptime.stdout.trim()
    };
  }
}

module.exports = { SSHDeployer };
