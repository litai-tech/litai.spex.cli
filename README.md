# LitAI-Spex

A CLI tool for deploying files via SSH with configurable exclusions and post-deployment script execution.

## Installation

```bash
# Clone or download the project
cd litai-spex

# Install dependencies
npm install

# Link globally for CLI access
npm link
```

## Quick Start

1. Initialize configuration in your project directory:
   ```bash
   litai-spex init
   ```

2. Edit `deployment-config.json` with your server details

3. Deploy:
   ```bash
   litai-spex deploy
   ```

## Usage

### Commands

#### `litai-spex init`
Creates a `deployment-config.json` file with default settings and a sample `deploy.sh` script.

#### `litai-spex deploy [options]`
Deploys files from the current directory to a remote server.

**Options:**
| Option | Description |
|--------|-------------|
| `-ip, --ip <host>` | Target server IP/hostname |
| `-u, --user <username>` | SSH username |
| `-p, --password <password>` | SSH password |
| `-k, --key <path>` | Path to private key file |
| `-dir, --directory <path>` | Target directory on remote server |
| `-r, --run [script]` | Run script after deployment (default: deploy.sh) |
| `-c, --config <path>` | Path to config file (default: deployment-config.json) |

#### `litai-spex create-project [options]`
Clones a git repository from URL specified in config or CLI.

**Options:**
| Option | Description |
|--------|-------------|
| `--repo <url>` | Git repository URL (overrides config) |
| `--name <name>` | Directory name for the cloned project |
| `-b, --branch <branch>` | Branch to clone |
| `--depth <depth>` | Create a shallow clone with specified depth |
| `-i, --install` | Auto-install npm dependencies after clone |
| `-c, --config <path>` | Path to config file (default: deployment-config.json) |

#### `litai-spex scan [options]`
Scans local network for SSH hosts and optionally saves found hosts to config.

**Options:**
| Option | Description |
|--------|-------------|
| `-m, --mask <mask>` | IP mask to scan (e.g., 192.168.1). Auto-detected if not provided |
| `-u, --user <username>` | SSH username to test (can also be set in config) |
| `-p, --password <password>` | SSH password to test (can also be set in config) |
| `-t, --timeout <ms>` | Connection timeout in milliseconds (default: 1000) |
| `--threads <n>` | Number of parallel scans (default: 20) |
| `-c, --config <path>` | Path to config file (default: deployment-config.json) |

### Examples

**Deploy using config file:**
```bash
litai-spex deploy
```

**Deploy with CLI options (override config):**
```bash
litai-spex deploy -ip 192.168.1.100 -u admin -p mypassword -dir /var/www/myapp
```

**Deploy using SSH key:**
```bash
litai-spex deploy -ip 192.168.1.100 -u admin -k ~/.ssh/id_rsa
```

**Deploy and run post-deployment script:**
```bash
litai-spex deploy -r              # Uses deploy.sh from config
litai-spex deploy -r setup.sh     # Uses specific script
```

**Clone a project from config:**
```bash
litai-spex create-project
```

**Clone with CLI options:**
```bash
litai-spex create-project --repo https://github.com/user/repo.git
litai-spex create-project --repo https://github.com/user/repo.git --name my-project
litai-spex create-project --repo https://github.com/user/repo.git -b develop
litai-spex create-project --repo https://github.com/user/repo.git -i  # Auto-install deps
```

**Scan local network for SSH hosts:**
```bash
litai-spex scan -u myuser                    # Auto-detect subnet, scan with username
litai-spex scan -u myuser -p mypassword      # Scan with credentials
litai-spex scan -m 192.168.1 -u admin        # Scan specific subnet
litai-spex scan -u admin --threads 50        # Faster scan with more threads
```

## Configuration

### deployment-config.json Structure

```json
{
  "connection": {
    "host": "192.168.1.100",
    "username": "deploy",
    "password": "your-password",
    "privateKeyPath": "",
    "targetDirectory": "/var/www/app"
  },
  "deploy": {
    "excludeDirectories": [
      "node_modules",
      "logs",
      ".git",
      ".idea",
      ".vscode"
    ],
    "excludeFiles": [
      "package-lock.json",
      ".env.local",
      ".DS_Store",
      "deployment-config.json"
    ],
    "excludePatterns": [
      "*.log",
      "*.tmp",
      "*.bak"
    ]
  },
  "scripts": {
    "afterDeploy": "deploy.sh"
  },
  "project": {
    "repositoryUrl": "https://github.com/username/repo.git"
  }
}
```

### Configuration Options

#### Connection
| Field | Description |
|-------|-------------|
| `host` | Server IP address or hostname |
| `username` | SSH username |
| `password` | SSH password (use this OR privateKeyPath) |
| `privateKeyPath` | Path to SSH private key file |
| `targetDirectory` | Remote directory to deploy to |

#### Deploy Exclusions
| Field | Description |
|-------|-------------|
| `excludeDirectories` | Array of directory names to skip |
| `excludeFiles` | Array of file names to skip |
| `excludePatterns` | Array of glob patterns to skip (e.g., `*.log`) |

#### Project
| Field | Description |
|-------|-------------|
| `repositoryUrl` | Default git repository URL for create-project command |

### Default Exclusions

**Directories:** `node_modules`, `logs`, `.git`, `.idea`, `.vscode`

**Files:** `package-lock.json`, `.env.local`, `.DS_Store`

**Patterns:** `*.log`, `*.tmp`

## Post-Deployment Scripts

Create a `deploy.sh` file in your project root:

```bash
#!/bin/bash
# deploy.sh - runs on remote server after files are uploaded

echo "Installing dependencies..."
npm install --production

echo "Building project..."
npm run build

echo "Restarting service..."
sudo systemctl restart myapp

echo "Deployment complete!"
```

Run it with:
```bash
litai-spex deploy -r
```

## Security Notes

1. **Never commit `deployment-config.json`** - Add it to `.gitignore`
2. **Use SSH keys** when possible instead of passwords
3. **Secure your deploy.sh** - It runs with the connected user's permissions

## CLI Priority

Command-line options always override config file settings:

```bash
# Uses host from config, but overrides username
litai-spex deploy -u differentuser
```

## Troubleshooting

### Connection Refused
- Check if SSH is running on the server
- Verify the IP address and port
- Check firewall settings

### Authentication Failed
- Verify username and password
- Check SSH key permissions (`chmod 600 ~/.ssh/id_rsa`)
- Ensure the key is added to `~/.ssh/authorized_keys` on the server

### Permission Denied
- Verify the user has write access to the target directory
- Check directory permissions on the server

## License

MIT
