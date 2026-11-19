#!/usr/bin/env python3
"""
People OSINT Manager v5 — Terminal-only catalogue and safe installer for Debian/Kali.
Does not add Kali repositories to Debian. REVIEW tools are never auto-installed.
"""

import os
import sys
import shutil
import subprocess
from datetime import datetime

# --- Configuration & Setup ---
ROOT = os.environ.get('OSINT_HOME', os.path.expanduser('~/People-OSINT'))
LOG_FILE = os.path.join(ROOT, 'manager.log')
os.makedirs(ROOT, exist_ok=True)

# ANSI Color Codes
C_RESET = '\033[0m'
C_RED = '\033[31m'
C_GREEN = '\033[32m'
C_YELLOW = '\033[33m'
C_CYAN = '\033[36m'

# --- Helper Functions ---
def need(cmd):
    """Check if a command exists in the system PATH."""
    return shutil.which(cmd) is not None

def log(msg):
    """Print to stdout and append to log file."""
    timestamp = datetime.now().strftime('%F %T')
    log_entry = f"[{timestamp}] {msg}\n"
    print(msg)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_entry)

# --- Data Structures ---
# Format: id, name, source/repo, type, status, install, description
TOOLS = {
    "Email": [
        {"id": "holehe", "name": "Holehe", "source": "megadose/holehe", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Checks public registration indicators; can make requests to services"},
        {"id": "ghunt", "name": "GHunt", "source": "mxrch/GHunt", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Google-account OSINT; may require authenticated session"},
        {"id": "h8mail", "name": "h8mail", "source": "khast3x/h8mail", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Breach-source lookups; never retrieve or use exposed passwords"},
        {"id": "socialscan", "name": "Socialscan", "source": "iojw/socialscan", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Service-registration checks; may be active"},
        {"id": "mosint", "name": "Mosint", "source": "alpkeskin/mosint", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Email OSINT aggregator; verify APIs and build instructions"},
        {"id": "zehef", "name": "Zehef", "source": "N0rz3/Zehef", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Experimental email OSINT project; verify provenance"},
        {"id": "mailcat", "name": "Mailcat", "source": "sharsil/mailcat", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Email discovery from nickname; verify maintenance"},
        {"id": "mailaccess", "name": "MailAccess", "source": "KatrielMoses/MailAccess", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Email/identity project; inspect code and data handling"},
        {"id": "pwnedornot", "name": "pwnedOrNot", "source": "thewhiteh4t/pwnedOrNot", "type": "GitHub", "status": "DISABLED", "install": "blocked", "desc": "Breach/password-focused; excluded from installation"},
        {"id": "email2phone", "name": "email2phonenumber", "source": "martinvigo/email2phonenumber", "type": "GitHub", "status": "DISABLED", "install": "blocked", "desc": "Account-recovery pivots; excluded from installation"},
        {"id": "theharvester", "name": "theHarvester", "source": "laramies/theHarvester", "type": "Kali/Debian package", "status": "APT", "install": "theharvester", "desc": "Collects public emails, hosts and names related to a domain"},
        {"id": "osrframework", "name": "OSRFramework mailfy", "source": "https://github.com/i3visio/osrframework", "type": "Kali package", "status": "APT", "install": "osrframework", "desc": "Email-related username/email footprint modules; verify package availability"},
        {"id": "spiderfoot", "name": "SpiderFoot", "source": "https://github.com/smicallef/spiderfoot", "type": "Kali package", "status": "APT", "install": "spiderfoot", "desc": "Multi-source OSINT automation; CLI/headless use supported"},
        {"id": "whatbreach", "name": "WhatBreach", "source": "Ekultek/WhatBreach", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Breach metadata search; inspect data sources and legal scope"},
        {"id": "gitrecon", "name": "GitRecon", "source": "GONZOsint/gitrecon", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Finds public email disclosures in GitHub/GitLab commits"},
        {"id": "odin", "name": "ODIN", "source": "chrismaddalena/ODIN", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Broader asset, email and social-profile discovery"},
        {"id": "reconspider", "name": "ReconSpider", "source": "bhavsec/reconspider", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Multi-target OSINT framework; inspect dependencies"},
        {"id": "poastal", "name": "Poastal", "source": "jakecreps/poastal", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Email OSINT web app; requires Python dependencies and a GitHub API key for its GitHub module; review before use"},
    ],
    "Username": [
        {"id": "sherlock", "name": "Sherlock", "source": "sherlock-project/sherlock", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Public username-to-profile search"},
        {"id": "maigret", "name": "Maigret", "source": "soxoj/maigret", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username search and report generation"},
        {"id": "blackbird", "name": "Blackbird", "source": "antoniaci/blackbird", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username/email search; verify current sources"},
        {"id": "snoop", "name": "Snoop", "source": "snooppr/snoop", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username search with site database"},
        {"id": "nexfil", "name": "Nexfil", "source": "thewhiteh4t/nexfil", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username profile search; verify install instructions"},
        {"id": "social-analyzer", "name": "Social Analyzer", "source": "qeeqbox/social-analyzer", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Profile discovery; may require Docker/configuration"},
        {"id": "username-anarchy", "name": "Username Anarchy", "source": "urbanadventurer/username-anarchy", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Offline username-variant generator"},
        {"id": "linkedin2username", "name": "LinkedIn2Username", "source": "initstring/linkedin2username", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Generates possible username patterns from public organization data"},
        {"id": "vesper", "name": "Vesper", "source": "krishpranav/vesper", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username OSINT; verify repository provenance"},
        {"id": "linkook", "name": "Linkook", "source": "JackJuly/linkook", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username pivoting; verify project status"},
        {"id": "marple", "name": "Marple", "source": "soxoj/marple", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Search-engine profile link collection"},
        {"id": "enola", "name": "Enola", "source": "TheYahya/enola", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username search; Go-based CLI"},
        {"id": "usersearch", "name": "UserSearch", "source": "codassassin/UserSearch", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Username search across social sites; inspect site coverage"},
        {"id": "socid-extractor", "name": "socid-extractor", "source": "soxoj/socid-extractor", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Extracts structured data from a profile URL; not username-only"},
        {"id": "whatsmyname", "name": "WhatsMyName", "source": "WebBreacher/WhatsMyName", "type": "GitHub dataset", "status": "REVIEW", "install": "manual", "desc": "Archived dataset/project; treat as data source, not maintained app"},
        {"id": "whatsmyname-python", "name": "WhatsMyName Python", "source": "C3n7ral051nt4g3ncy/WhatsMyName-Python", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Community implementation; verify code and status"},
        {"id": "osrframework-userfy", "name": "OSRFramework usufy", "source": "https://github.com/i3visio/osrframework", "type": "Kali package", "status": "APT", "install": "osrframework", "desc": "Username footprint search module"},
        {"id": "recon-ng", "name": "Recon-ng", "source": "https://github.com/lanmaster53/recon-ng", "type": "Kali package", "status": "APT", "install": "recon-ng", "desc": "Modular reconnaissance framework; terminal interface"},
        {"id": "twofi", "name": "Twofi", "source": "https://github.com/Twofi/Twofi", "type": "Kali package", "status": "APT", "install": "twofi", "desc": "Generates wordlists from public social content; use only lawful public sources"},
        {"id": "photon", "name": "Photon", "source": "s0md3v/Photon", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Website crawler that can collect public usernames, emails and URLs"},
    ],
    "Phone": [
        {"id": "phoneinfoga", "name": "PhoneInfoga", "source": "sundowndev/phoneinfoga", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Public phone-number metadata and formatting/validation"},
        {"id": "phunter", "name": "Phunter", "source": "N0rz3/Phunter", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Phone OSINT aggregator; verify source quality"},
        {"id": "searchphone", "name": "SearchPhone", "source": "HackUnderway/SearchPhone", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Phone investigation aggregator; check APIs"},
        {"id": "osintnum", "name": "OsintNum", "source": "HackUnderway/OsintNum", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "May require external number-verification API"},
        {"id": "numint", "name": "Numint", "source": "whoamitang/numint", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Phone OSINT project; inspect privacy behavior"},
        {"id": "telespot", "name": "Telespot", "source": "thumpersecure/Telespot", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Phone search project; verify repo and sources"},
        {"id": "telespotter", "name": "Telespotter", "source": "thumpersecure/Telespotter", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Phone search project; verify build steps"},
        {"id": "phone-number-osint", "name": "PhoneNumber-OSINT", "source": "spider863644/PhoneNumber-OSINT", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Community phone OSINT project; inspect before use"},
        {"id": "ignorant", "name": "Ignorant", "source": "megadose/ignorant", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Checks service-registration indicators; may send requests to platforms"},
        {"id": "okru-checker", "name": "Odnoklassniki Checker", "source": "OSINT-mindset/odnoklassniki-checker", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Looks up public OK.ru account information by phone/email"},
        {"id": "osrframework-phonefy", "name": "OSRFramework phonefy", "source": "https://github.com/i3visio/osrframework", "type": "Kali package", "status": "APT", "install": "osrframework", "desc": "Phone-related footprint module; availability/results vary"},
        {"id": "phoneint", "name": "phoneint (Phoneint OSINT Toolkit)", "source": "SagarBiswas-MultiHAT/Phoneint-OSINT-Toolkit", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "CLI phone parsing and public-metadata enrichment; Python 3.11+; optional adapters may query public sources"},
    ],
    "General": [
        {"id": "dmitry", "name": "Dmitry", "source": "https://github.com/jaygreig86/dmitry", "type": "Kali package", "status": "APT", "install": "dmitry", "desc": "Domain/host information gathering"},
        {"id": "metagoofil", "name": "Metagoofil", "source": "https://github.com/laramies/metagoofil", "type": "Kali package", "status": "APT", "install": "metagoofil", "desc": "Searches public documents and extracts metadata"},
        {"id": "ghostintel", "name": "GhostIntel", "source": "ruyynn/GhostIntel", "type": "GitHub", "status": "REVIEW", "install": "manual", "desc": "Multi-source framework covering email, username and phone among other inputs; includes web UI and batch features; review scope and dependencies"},
    ]
}

# --- Core Functions ---

def list_section(section):
    print(f"\n{C_CYAN}=== {section} ==={C_RESET}")
    print(f"{'TOOL':<20} {'STATUS':<11} {'INSTALL':<18} SOURCE")
    print("-" * 80)
    
    for tool in TOOLS.get(section, []):
        status_color = C_RESET
        if tool['status'] == 'APT':
            status_color = C_GREEN
        elif tool['status'] == 'DISABLED':
            status_color = C_RED
        else:
            status_color = C_YELLOW
            
        print(f"{tool['name']:<20} {status_color}{tool['status']:<11}{C_RESET} {tool['install']:<18} {tool['source']}")
        print(f"  {tool['desc']}")

def base_check():
    missing = []
    for cmd in ['git', 'curl', 'python3']:
        if not need(cmd):
            missing.append(cmd)
            
    # Check python3-venv
    try:
        subprocess.run(['python3', '-m', 'venv', '--help'], 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        missing.append('python3-venv')

    if missing:
        print(f"Missing: {' '.join(missing)}")
        print('Install: sudo apt update && sudo apt install -y git curl python3 python3-venv python3-pip pipx')
        return False
    
    print('Base dependencies: OK')
    return True

def apt_install(pkg):
    if not need('apt-cache'):
        print('apt is unavailable.')
        return False
        
    try:
        result = subprocess.run(['apt-cache', 'policy', pkg], 
                                capture_output=True, text=True, check=True)
        for line in result.stdout.splitlines():
            if line.strip().startswith('Candidate:'):
                candidate = line.split(':')[1].strip()
                if candidate == '(none)':
                    print(f"Package '{pkg}' is not available in the currently configured repositories.")
                    print('No Kali repository will be added automatically. Use Kali itself or review an isolated upstream install method.')
                    return False
                print(f"Package found: {pkg} ({candidate})")
                ans = input('Install with sudo apt? [y/N] ').strip().lower()
                if ans in ['y', 'yes']:
                    subprocess.run(['sudo', 'apt-get', 'install', '-y', pkg])
                return True
    except subprocess.CalledProcessError:
        print(f"Failed to query apt-cache for {pkg}")
        return False

def install_by_id(section, wanted_id):
    for tool in TOOLS.get(section, []):
        if tool['id'] == wanted_id:
            if tool['status'] == 'APT':
                return apt_install(tool['install'])
            elif tool['status'] == 'DISABLED':
                print(f"Blocked: {tool['name']} — {tool['desc']}")
                return False
            elif tool['status'] == 'REVIEW':
                print(f"{tool['name']} is REVIEW-only; no automatic execution or installation.")
                source = tool['source']
                if not source.startswith('http'):
                    source = f"https://github.com/{source}"
                print(f"Review repository: {source}")
                print('Check source code, license, dependencies, maintenance, API requirements and network behavior first.')
                return False
    print('Unknown tool ID.')
    return False

def section_menu(section):
    while True:
        print(f"\n{section}")
        print("1) List tools")
        print("2) Install an available APT package")
        print("3) Back")
        
        c = input('Choice: ').strip()
        if c == '1':
            list_section(section)
        elif c == '2':
            tool_id = input('Tool ID (see list): ').strip()
            install_by_id(section, tool_id)
        elif c == '3':
            break
        else:
            print('Invalid choice.')

# --- Main Execution ---

def main():
    # CLI Arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == '--list':
            for sec in TOOLS:
                list_section(sec)
            sys.exit(0)
        elif sys.argv[1] == '--check':
            success = base_check()
            sys.exit(0 if success else 1)

    # Interactive Menu
    while True:
        print("\nPEOPLE OSINT MANAGER v5 — TERMINAL ONLY")
        print("1) Email tools")
        print("2) Username tools")
        print("3) Phone tools")
        print("4) General Kali CLI tools")
        print("5) Check base dependencies")
        print("6) List everything")
        print("7) Exit")
        
        choice = input('Choose: ').strip()
        
        if choice == '1':
            section_menu('Email')
        elif choice == '2':
            section_menu('Username')
        elif choice == '3':
            section_menu('Phone')
        elif choice == '4':
            section_menu('General')
        elif choice == '5':
            base_check()
        elif choice == '6':
            for sec in TOOLS:
                list_section(sec)
        elif choice == '7':
            print("Goodbye!")
            sys.exit(0)
        else:
            print('Invalid choice.')

if __name__ == '__main__':
    main()