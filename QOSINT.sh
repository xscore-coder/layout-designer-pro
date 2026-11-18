#!/bin/bash

# ============================================================================
# OSINT Tools - Fixed Installation Script for Debian Trixie (Netinst)
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  OSINT Tools - Fixed Installation for Debian Trixie          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Error: Must run as root${NC}"
    exit 1
fi

# ============================================================================
# PHASE 1: Update System
# ============================================================================
echo -e "${YELLOW}[1/6] Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

# ============================================================================
# PHASE 2: Basic System Tools (FIXED - removed software-properties-common)
# ============================================================================
echo -e "${YELLOW}[2/6] Installing basic system tools...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    apt-transport-https \
    sudo \
    unzip \
    pkg-config \
    libssl-dev

echo -e "${GREEN}✅ Basic tools installed${NC}"

# ============================================================================
# PHASE 3: Python
# ============================================================================
echo -e "${YELLOW}[3/6] Installing Python...${NC}"
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-full \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    python3-apt

python3 --version
echo -e "${GREEN}✅ Python installed${NC}"

# ============================================================================
# PHASE 4: Node.js
# ============================================================================
echo -e "${YELLOW}[4/6] Installing Node.js...${NC}"

# Remove old node if exists
apt-get remove -y nodejs npm 2>/dev/null || true

# Add NodeSource
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update -y
apt-get install -y nodejs

node --version
npm --version
echo -e "${GREEN}✅ Node.js installed${NC}"

# ============================================================================
# PHASE 5: Go
# ============================================================================
echo -e "${YELLOW}[5/6] Installing Go...${NC}"

GO_VERSION="go1.22.5"
cd /tmp
wget -q "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
rm -rf /usr/local/go
tar -C /usr/local -xzf "${GO_VERSION}.linux-amd64.tar.gz"
rm -f "${GO_VERSION}.linux-amd64.tar.gz"

echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
export PATH=$PATH:/usr/local/go/bin

go version
echo -e "${GREEN}✅ Go installed${NC}"

# ============================================================================
# PHASE 6: Rust
# ============================================================================
echo -e "${YELLOW}[6/6] Installing Rust...${NC}"

export DEBIAN_FRONTEND=noninteractive
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

source "$HOME/.cargo/env"
echo 'source $HOME/.cargo/env' >> /etc/profile.d/rust.sh
echo 'source $HOME/.cargo/env' >> ~/.bashrc

rustc --version
cargo --version
echo -e "${GREEN}✅ Rust installed${NC}"

# ============================================================================
# PHASE 7: Python Libraries for Installer
# ============================================================================
echo -e "${YELLOW}Installing Python libraries...${NC}"
python3 -m pip install --upgrade pip --break-system-packages
python3 -m pip install pandas openpyxl requests --break-system-packages

echo -e "${GREEN}✅ All prerequisites ready!${NC}"
echo ""

# ============================================================================
# PHASE 8: Create and Run Python Installer
# ============================================================================
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Starting OSINT Tools Installation                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

WORK_DIR="/opt/osint_installer"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

cat > install_all_osint.py << 'PYTHON_EOF'
import os
import sys
import subprocess
import pandas as pd
import re
import io
from datetime import datetime
from pathlib import Path

markdown_data = """
| # | Project / Repository | GitHub | Core Function | Category | AI |
| -- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | --------------------- | ----------------- |
| 1 | Sherlock | https://github.com/sherlock-project/sherlock | Search for username across multiple sites | Username Search | No |
| 2 | Maigret | https://github.com/soxoj/maigret | Account search and result analysis | Username Search | No |
| 3 | Social Analyzer | https://github.com/qeeqbox/social-analyzer | Account analysis and social network presence | Social Analysis | Some features |
| 4 | Blackbird | https://github.com/antoniaci/blackbird | Search for usernames and emails | Username / Email | Yes, per list |
| 5 | User Scanner | https://github.com/kaifcodec/user-scanner | Scan usernames on platforms | Username Search | No |
| 6 | Aliens Eye | https://github.com/arxhr007/Aliens_eye | Search accounts with match probability scoring | Username / AI | Yes |
| 7 | Snoop | https://github.com/snooppr/snoop | Username search with reporting and filtering options | Username Search | No |
| 8 | Enola | https://github.com/TheYahya/enola | Search for usernames across multiple sites | Username Search | No |
| 9 | Naminter | https://github.com/naminter/naminter | Search using username databases | Username Search | No |
| 10 | gosearch | https://github.com/ibnaleem/gosearch | Search for accounts linked to a username | Username Search | No |
| 11 | Tookie OSINT | https://github.com/Alfredredbird/tookie-osint | OSINT tool for account searching | Username Search | No |
| 12 | vesper | SEARCH_LINK | Search accounts with confidence scoring | Username Search | No |
| 13 | Linkook | https://github.com/JackJuly/linkook | Discover linked accounts and analyze connections | Account Correlation | No |
| 14 | socid-extractor | https://github.com/soxoj/socid-extractor | Extract IDs from social media pages | Data Extraction | No |
| 15 | Marple | https://github.com/soxoj/marple | Collect and analyze account information | OSINT Analysis | No |
| 16 | Investigo | SEARCH_LINK | Search usernames using Sherlock's database | Username Search | No |
| 17 | nexfil | SEARCH_LINK | Search accounts across various sites | Username Search | No |
| 18 | DetectDee | SEARCH_LINK | Search using username, email, or phone | Multi-Identity Search | No |
| 19 | Emora | https://github.com/idefasoft/Emora-Project | OSINT project and information analysis | OSINT | Uncertain |
| 20 | Consensus OSINT | https://github.com/OSINT-Experts-Society/Consensus-OSINT | Aggregate and analyze OSINT results | OSINT Analysis | Yes / Integrations |
| 21 | Wiwok | https://github.com/Kirozaku/Wiwok | Search for identity-linked information | OSINT | Uncertain |
| 22 | FindME | SEARCH_LINK | Search for accounts | Username Search | No |
| 23 | SearchMyName | https://github.com/Niko13teen/SearchMyName | Search username across platforms | Username Search | No |
| 24 | WhatsMyName | https://github.com/WebBreacher/WhatsMyName | Database of sites to verify usernames | Username Dataset | No |
| 25 | socialscan | https://github.com/iojw/socialscan | Check availability of usernames and emails | Availability Check | No |
| 26 | username-anarchy | https://github.com/urbanadventurer/username-anarchy | Generate username permutations | Username Generation | No |
| 27 | MCP Maigret | https://github.com/w0h1v/mcp-maigret | Run Maigret via MCP | MCP Integration | AI Integration |
| 28 | OWASP Social OSINT Agent | https://github.com/bm-github/owasp-social-osint-agent | OSINT agent for social search and analysis | AI Agent | Yes |
| 29 | Social OSINT | https://github.com/krishpranav/socialosint | Collect info from social platforms | Social OSINT | Uncertain |
| 30 | OSINT AI Agent | https://github.com/sumba101/OSINT-AI-Agent | AI agent for OSINT tasks | AI Agent | Yes |
| 31 | linkedin2username | SEARCH_LINK | Generate usernames based on LinkedIn data | Username Generation | No |
| 32 | UserReCon | SEARCH_LINK | Search usernames on multiple sites | Username Search | No |
| 33 | GhostTrack | SEARCH_LINK | Gather info using username and other data | Multi-Identity OSINT | No |
| 34 | NameSpi | https://github.com/waffl3ss/NameSpi | Search for usernames | Username Search | No |
| 35 | UsernameSearchOSINT | SEARCH_LINK | Search for usernames | Username Search | No |
| 36 | aka-osint-username-search | SEARCH_LINK | Search for usernames | Username Search | No |
| 37 | watson-username-footprint-finder | SEARCH_LINK | Collect digital footprint of a username | Digital Footprint | No |
| 38 | HandleHawk | SEARCH_LINK | Search for usernames | Username Search | No |
| 39 | gitrecon | SEARCH_LINK | Recon and analyze Git information | Git OSINT | No |
| 40 | Username-OSINT-Finder | SEARCH_LINK | Search for user accounts | Username Search | No |
| 41 | Social-Finder | SEARCH_LINK | Find social accounts | Social Search | No |
| 42 | Navarro | SEARCH_LINK | OSINT project for information search | OSINT | Uncertain |
| 43 | ProfileScan | SEARCH_LINK | Scan and analyze profiles | Profile Analysis | No |
| 44 | Namechk | https://namechk.com | Check username availability on platforms | Username Availability | No |
"""

lines = markdown_data.strip().split('\n')
clean_lines = [line.strip() for line in lines if line.strip() and not line.startswith('| --')]
df = pd.read_csv(io.StringIO('\n'.join(clean_lines)), sep='|', skipinitialspace=True)
df = df.apply(lambda x: x.str.strip() if x.dtype == "object" else x)
df = df.iloc[:, 1:-1]

SCRIPT_DIR = Path(__file__).parent.resolve()
MASTER_DIR = SCRIPT_DIR / "OSINT_Master"
MASTER_DIR.mkdir(exist_ok=True)

log_file = MASTER_DIR / "installation_log.txt"
with open(log_file, "w", encoding="utf-8") as f:
    f.write(f"--- Starting Installation: {datetime.now()} ---\n")

def log(msg):
    print(msg)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

USE_VENV = True
PIP_CMD = [sys.executable, "-m", "pip"]

log("🔄 Creating unified virtual environment...")
venv_path = MASTER_DIR / "master_env"
venv_result = subprocess.run(
    [sys.executable, "-m", "venv", str(venv_path)],
    capture_output=True, text=True
)

if venv_result.returncode != 0:
    log(f"⚠️  venv failed: {venv_result.stderr.strip()}")
    log("💡 Falling back to SYSTEM-WIDE installation\n")
    USE_VENV = False
else:
    log("✅ Virtual environment created.")
    PIP_CMD = [str(venv_path / "bin" / "pip")]
    subprocess.run(PIP_CMD + ["install", "--upgrade", "pip"], capture_output=True)

log(f"📍 Master directory: {MASTER_DIR}")
log(f"📍 Using {'venv' if USE_VENV else 'system'} Python: {sys.executable}\n")

log("📥 Starting tool installation...\n")

for index, row in df.iterrows():
    project = row['Project / Repository']
    url = row['GitHub']
    
    if 'SEARCH_LINK' in url or 'namechk.com' in url:
        log(f"⏭️  Skipping: {project}")
        continue

    match = re.search(r'github\.com/([^/]+/[^/]+)', url)
    if not match:
        log(f"❌ Failed to extract link for: {project}")
        continue
        
    repo_full = match.group(1).replace('.git', '')
    repo_name = repo_full.split('/')[-1]
    tool_dir = MASTER_DIR / repo_name
    
    log(f"📦 Processing: {project} ({repo_name})...")
    
    if tool_dir.exists():
        log(f"   ℹ️  Already exists, pulling updates...")
        subprocess.run(["git", "-C", str(tool_dir), "pull"], capture_output=True)
    else:
        clone_result = subprocess.run(
            ["git", "clone", "--depth=1", f"https://github.com/{repo_full}.git", str(tool_dir)],
            capture_output=True, text=True
        )
        if clone_result.returncode != 0:
            log(f"   ⚠️ Clone failed: {clone_result.stderr.strip()}")
            continue
    
    installed = False
    
    # Python
    req_txt = tool_dir / "requirements.txt"
    if req_txt.exists():
        log("   🐍 Installing Python requirements...")
        if USE_VENV:
            cmd = PIP_CMD + ["install", "-r", str(req_txt)]
        else:
            cmd = [sys.executable, "-m", "pip", "install", "--break-system-packages", "-r", str(req_txt)]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Python requirements installed.")
            installed = True
        else:
            log(f"   ⚠️ Python install had issues (continuing): {res.stderr[:150]}")
            installed = True  # Continue anyway
    
    # Node.js
    pkg_json = tool_dir / "package.json"
    if pkg_json.exists():
        log("   🟢 Installing Node.js requirements...")
        res = subprocess.run(["npm", "install", "--no-optional"], cwd=str(tool_dir), capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Node.js requirements installed.")
            installed = True
        else:
            log(f"   ⚠️ Node.js install had issues: {res.stderr[:150]}")
            installed = True

    # Go
    go_mod = tool_dir / "go.mod"
    if go_mod.exists():
        log("   🔵 Downloading Go requirements...")
        env = os.environ.copy()
        env['PATH'] = '/usr/local/go/bin:' + env.get('PATH', '')
        res = subprocess.run(["go", "mod", "download"], cwd=str(tool_dir), capture_output=True, text=True, env=env)
        if res.returncode == 0:
            log("   ✅ Go requirements downloaded.")
            installed = True
        else:
            log(f"   ⚠️ Go install had issues: {res.stderr[:150]}")
            installed = True

    # Rust
    cargo_toml = tool_dir / "Cargo.toml"
    if cargo_toml.exists():
        log("   🦀 Building Rust tool...")
        env = os.environ.copy()
        cargo_env = os.path.expanduser("~/.cargo/env")
        if os.path.exists(cargo_env):
            with open(cargo_env) as f:
                for line in f:
                    if 'export' in line:
                        parts = line.replace('export ', '').strip().split('=', 1)
                        if len(parts) == 2:
                            env[parts[0]] = parts[1].strip('"')
        res = subprocess.run(["cargo", "build", "--release"], cwd=str(tool_dir), capture_output=True, text=True, env=env)
        if res.returncode == 0:
            log("   ✅ Rust tool built.")
            installed = True
        else:
            log(f"   ⚠️ Rust build had issues: {res.stderr[:150]}")
            installed = True

    if not installed:
        log("   ℹ️  No standard requirement files found.")

log("\n" + "="*60)
log("🎉 Installation process complete!")
log(f"📁 All tools are in: {MASTER_DIR}")
log(f"📜 Full log: {log_file}")
if USE_VENV:
    log(f"\n💡 Activate environment with:")
    log(f"   source {venv_path}/bin/activate")
else:
    log(f"\n💡 Tools installed system-wide.")
log("="*60)
PYTHON_EOF

# Run installer
python3 install_all_osint.py

# ============================================================================
# Final Summary
# ============================================================================
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Installation Complete!                                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ All OSINT tools installed!${NC}"
echo ""
echo -e "${YELLOW}📍 Tools location:${NC} /opt/osint_installer/OSINT_Master/"
echo -e "${YELLOW}📜 Log:${NC} /opt/osint_installer/OSINT_Master/installation_log.txt"
echo ""
echo -e "${YELLOW}🔧 Usage:${NC}"
echo -e "   source /opt/osint_installer/OSINT_Master/master_env/bin/activate"
echo -e "   cd /opt/osint_installer/OSINT_Master/sherlock"
echo -e "   python3 sherlock.py test_user"
echo ""
echo -e "${GREEN}🎉 Done!${NC}"