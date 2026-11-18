#!/bin/bash

# ============================================================================
# OSINT Tools - Complete Installation Script for Debian Netinst
# Works on minimal Debian installations with no pre-installed packages
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  OSINT Tools - Complete Installation for Debian Netinst      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# ============================================================================
# PHASE 1: System Update & Basic Tools
# ============================================================================
echo -e "${YELLOW}[1/6] Updating system packages...${NC}"
apt update -y
apt upgrade -y

echo -e "${YELLOW}[2/6] Installing basic system tools...${NC}"
apt install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    sudo

# ============================================================================
# PHASE 2: Python Installation
# ============================================================================
echo -e "${YELLOW}[3/6] Installing Python and development tools...${NC}"
apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-full \
    python3-dev \
    python3-setuptools \
    python3-wheel

# Verify Python
python3 --version
echo -e "${GREEN}✅ Python installed successfully${NC}"

# ============================================================================
# PHASE 3: Node.js Installation (Latest LTS)
# ============================================================================
echo -e "${YELLOW}[4/6] Installing Node.js (LTS version)...${NC}"

# Remove old Node.js if exists
apt remove -y nodejs npm 2>/dev/null || true

# Install NodeSource repository for latest LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js
node --version
npm --version
echo -e "${GREEN}✅ Node.js installed successfully${NC}"

# ============================================================================
# PHASE 4: Go Installation
# ============================================================================
echo -e "${YELLOW}[5/6] Installing Go programming language...${NC}"

# Get latest Go version
GO_VERSION=$(curl -s https://go.dev/VERSION?m=text | head -n 1)
if [ -z "$GO_VERSION" ]; then
    GO_VERSION="go1.21.5"  # Fallback version
fi

# Download and install Go
cd /tmp
wget -q "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
rm -rf /usr/local/go
tar -C /usr/local -xzf "${GO_VERSION}.linux-amd64.tar.gz"
rm "${GO_VERSION}.linux-amd64.tar.gz"

# Add Go to PATH for all users
echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
export PATH=$PATH:/usr/local/go/bin

# Verify Go
go version
echo -e "${GREEN}✅ Go installed successfully${NC}"

# ============================================================================
# PHASE 5: Rust Installation
# ============================================================================
echo -e "${YELLOW}[6/6] Installing Rust programming language...${NC}"

# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Add Rust to PATH
source "$HOME/.cargo/env"
echo 'source $HOME/.cargo/env' >> /etc/profile.d/rust.sh
echo 'source $HOME/.cargo/env' >> ~/.bashrc

# Verify Rust
rustc --version
cargo --version
echo -e "${GREEN}✅ Rust installed successfully${NC}"

# ============================================================================
# PHASE 6: Install Python Libraries for Installer
# ============================================================================
echo -e "${YELLOW}Installing Python libraries for the installer script...${NC}"
python3 -m pip install --upgrade pip
python3 -m pip install pandas openpyxl requests --break-system-packages

echo -e "${GREEN}✅ All prerequisites installed successfully!${NC}"
echo ""

# ============================================================================
# PHASE 7: Download and Run Python Installer
# ============================================================================
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Starting OSINT Tools Installation                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create working directory
WORK_DIR="/opt/osint_installer"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Create the Python installer script
cat > install_all_osint.py << 'PYTHON_EOF'
import os
import sys
import subprocess
import pandas as pd
import re
import io
from datetime import datetime
from pathlib import Path

# Table Data
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

# Setup Master Directory
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

# ============================================
# Detect Installation Mode (venv vs system)
# ============================================
USE_VENV = True
PIP_CMD = [sys.executable, "-m", "pip"]

# Try to create venv
log("🔄 Attempting to create unified virtual environment...")
venv_path = MASTER_DIR / "master_env"
venv_result = subprocess.run(
    [sys.executable, "-m", "venv", str(venv_path)],
    capture_output=True, text=True
)

if venv_result.returncode != 0:
    log(f"⚠️  venv creation failed: {venv_result.stderr.strip()}")
    log("💡 Falling back to SYSTEM-WIDE installation.")
    log("   (This requires --break-system-packages on Debian 12+)\n")
    USE_VENV = False
    PIP_CMD = [sys.executable, "-m", "pip", "install", "--break-system-packages"]
else:
    log("✅ Virtual environment created successfully.")
    PIP_CMD = [str(venv_path / "bin" / "pip")]
    # Upgrade pip in venv
    subprocess.run(PIP_CMD + ["install", "--upgrade", "pip"], capture_output=True)

log(f"📍 Master directory: {MASTER_DIR}")
log(f"📍 Using {'venv' if USE_VENV else 'system'} Python: {sys.executable}\n")

# ============================================
# Install Tools
# ============================================
log("📥 Starting tool download and installation...\n")

for index, row in df.iterrows():
    project = row['Project / Repository']
    url = row['GitHub']
    
    if 'SEARCH_LINK' in url or 'namechk.com' in url:
        log(f"⏭️  Skipping: {project} (Manual search link or website)")
        continue

    match = re.search(r'github\.com/([^/]+/[^/]+)', url)
    if not match:
        log(f"❌ Failed to extract link for: {project}")
        continue
        
    repo_full = match.group(1).replace('.git', '')
    repo_name = repo_full.split('/')[-1]
    tool_dir = MASTER_DIR / repo_name
    
    log(f"📦 Processing: {project} ({repo_name})...")
    
    # Clone (skip if already exists)
    if tool_dir.exists():
        log(f"   ℹ️  Already cloned. Pulling latest changes...")
        subprocess.run(["git", "-C", str(tool_dir), "pull"], capture_output=True)
    else:
        clone_result = subprocess.run(
            ["git", "clone", f"https://github.com/{repo_full}.git", str(tool_dir)],
            capture_output=True, text=True
        )
        if clone_result.returncode != 0:
            log(f"   ⚠️ Clone failed: {clone_result.stderr.strip()}")
            continue
    
    # Detect and install requirements
    installed = False
    
    # Python
    req_txt = tool_dir / "requirements.txt"
    if req_txt.exists():
        log("   🐍 Installing Python requirements...")
        cmd = PIP_CMD + ["install", "-r", str(req_txt)]
        if not USE_VENV:
            cmd = [sys.executable, "-m", "pip", "install", "--break-system-packages", "-r", str(req_txt)]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Python requirements installed.")
            installed = True
        else:
            # Try with --ignore-installed to bypass conflicts
            log("   ⚠️ First attempt failed. Retrying with --ignore-installed...")
            cmd_retry = cmd[:-2] + ["--ignore-installed", "-r", str(req_txt)]
            res2 = subprocess.run(cmd_retry, capture_output=True, text=True)
            if res2.returncode == 0:
                log("   ✅ Python requirements installed (with ignore-installed).")
                installed = True
            else:
                log(f"   ❌ Python install failed: {res2.stderr[:300]}")
    
    # Node.js
    pkg_json = tool_dir / "package.json"
    if pkg_json.exists():
        log("   🟢 Installing Node.js requirements...")
        res = subprocess.run(["npm", "install"], cwd=str(tool_dir), capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Node.js requirements installed.")
            installed = True
        else:
            log(f"   ❌ Node.js install failed: {res.stderr[:200]}")

    # Go
    go_mod = tool_dir / "go.mod"
    if go_mod.exists():
        log("   🔵 Downloading Go requirements...")
        res = subprocess.run(["go", "mod", "download"], cwd=str(tool_dir), capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Go requirements downloaded.")
            installed = True
        else:
            log(f"   ❌ Go install failed: {res.stderr[:200]}")

    # Rust
    cargo_toml = tool_dir / "Cargo.toml"
    if cargo_toml.exists():
        log("   🦀 Building Rust tool...")
        res = subprocess.run(["cargo", "build", "--release"], cwd=str(tool_dir), capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Rust tool built.")
            installed = True
        else:
            log(f"   ❌ Rust build failed: {res.stderr[:200]}")

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
    log(f"\n💡 Tools installed system-wide. Run directly from their folders.")
log("="*60)
PYTHON_EOF

# Run the Python installer
python3 install_all_osint.py

# ============================================================================
# Final Setup
# ============================================================================
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Installation Complete!                                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ All OSINT tools have been installed!${NC}"
echo ""
echo -e "${YELLOW}📍 Tools location:${NC} /opt/osint_installer/OSINT_Master/"
echo -e "${YELLOW}📜 Installation log:${NC} /opt/osint_installer/OSINT_Master/installation_log.txt"
echo ""
echo -e "${YELLOW}🔧 To use the tools:${NC}"
echo -e "   1. Activate the environment:"
echo -e "      ${BLUE}source /opt/osint_installer/OSINT_Master/master_env/bin/activate${NC}"
echo ""
echo -e "   2. Navigate to a tool and run it:"
echo -e "      ${BLUE}cd /opt/osint_installer/OSINT_Master/sherlock${NC}"
echo -e "      ${BLUE}python3 sherlock.py --help${NC}"
echo ""
echo -e "${YELLOW}💡 Quick test commands:${NC}"
echo -e "   ${BLUE}cd /opt/osint_installer/OSINT_Master/sherlock && python3 sherlock.py test_user${NC}"
echo -e "   ${BLUE}cd /opt/osint_installer/OSINT_Master/maigret && maigret --help${NC}"
echo ""
echo -e "${GREEN}🎉 Enjoy your OSINT toolkit!${NC}"