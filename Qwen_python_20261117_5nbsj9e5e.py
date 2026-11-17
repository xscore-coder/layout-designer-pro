import os
import subprocess
import pandas as pd
import re
import io
from datetime import datetime

# 1. Table Data (Translated to English)
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

# Setup Master Directory and Unified Environment
MASTER_DIR = "OSINT_Master"
os.makedirs(MASTER_DIR, exist_ok=True)
os.chdir(MASTER_DIR)

log_file = "installation_log.txt"
with open(log_file, "w", encoding="utf-8") as f:
    f.write(f"--- Starting Unified Installation: {datetime.now()} ---\n")

def log(msg):
    print(msg)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

log("🔄 Creating Unified Master Environment...")
# Note: We use a unified venv to protect your base system, but it acts as the "main environment" for this project
subprocess.run(["python3", "-m", "venv", "master_env"], capture_output=True)
pip_cmd = ["master_env/bin/pip", "install", "--upgrade", "pip"]
subprocess.run(pip_cmd, capture_output=True)

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
    
    log(f"📦 Processing: {project} ({repo_name})...")
    
    # Clone the repository
    clone_result = subprocess.run(["git", "clone", f"https://github.com/{repo_full}.git", repo_name], capture_output=True, text=True)
    if clone_result.returncode != 0:
        log(f"   ⚠️ Clone failed: {clone_result.stderr.strip()}")
        continue
        
    os.chdir(repo_name)
    
    # Detect tool type and install requirements
    installed = False
    
    # 1. Python tools
    if os.path.exists("requirements.txt"):
        log("   🐍 Detected Python requirements... Installing into master env.")
        res = subprocess.run(["../master_env/bin/pip", "install", "-r", "requirements.txt"], capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Python requirements installed successfully.")
            installed = True
        else:
            log(f"   ❌ Python install failed (possible conflict): {res.stderr[:200]}")
            
    # 2. Node.js tools
    if os.path.exists("package.json"):
        log("   🟢 Detected Node.js requirements... Installing.")
        res = subprocess.run(["npm", "install"], capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Node.js requirements installed successfully.")
            installed = True
        else:
            log(f"   ❌ Node.js install failed: {res.stderr[:200]}")

    # 3. Go tools
    if os.path.exists("go.mod"):
        log("   🔵 Detected Go requirements... Downloading.")
        res = subprocess.run(["go", "mod", "download"], capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Go requirements downloaded successfully.")
            installed = True
        else:
            log(f"   ❌ Go install failed: {res.stderr[:200]}")

    # 4. Rust tools
    if os.path.exists("Cargo.toml"):
        log("   🦀 Detected Rust requirements... Building.")
        res = subprocess.run(["cargo", "build", "--release"], capture_output=True, text=True)
        if res.returncode == 0:
            log("   ✅ Rust tool built successfully.")
            installed = True
        else:
            log(f"   ❌ Rust build failed: {res.stderr[:200]}")

    if not installed:
        log("   ℹ️ No standard requirement files found (might be a script or need no installation).")

    os.chdir("..")

log("\n🎉 Unified installation process complete!")
log("📁 All tools are located in the folder: OSINT_Master")
log("📜 Review installation_log.txt for details and errors.")
log("\n💡 To activate the Unified Master Environment and use the tools, always run:")
log("   source OSINT_Master/master_env/bin/activate")