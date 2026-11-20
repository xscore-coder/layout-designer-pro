#!/usr/bin/env python3
import json
import os
import subprocess
import argparse
import sys
import sysconfig
from pathlib import Path

INSTALL_DIR = Path("osint-tools")

# Requirements that cannot be reliably installed by pip/npm alone. These are
# reported before installation so a failed repository has an actionable cause.
TOOL_REQUIREMENTS = {
    "theHarvester": ["Python >= 3.14"],
    "dnstwist": ["Python development headers (Python.h)", "C/C++ compiler"],
    "sn0int": ["Rust toolchain (cargo)"],
    "subfinder": ["Go toolchain (go)"],
    "PhoneInfoga": ["Go toolchain (go)"],
    "phonenumbers": ["Go toolchain (go)"],
    "go-osint": ["Go toolchain (go)"],
    "trufflehog": ["Go toolchain (go)"],
    "gitleaks": ["Go toolchain (go)"],
    "lu1tr0n/nationid": ["Node.js and npm"],
    "clearbit-python": ["A complete repository checkout including README.rst"],
}


def command_available(command):
    """Return whether an executable is available on PATH."""
    return subprocess.run(
        ["sh", "-c", f"command -v {command} >/dev/null 2>&1"],
        check=False,
    ).returncode == 0


def requirement_status(name, folder=None):
    """Return missing prerequisite descriptions for a repository."""
    missing = []
    if name == "theHarvester" and sys.version_info < (3, 14):
        missing.append(f"Python >= 3.14 (running {sys.version_info.major}.{sys.version_info.minor})")
    if name == "dnstwist":
        python_include = Path(sysconfig.get_path("include")) / "Python.h"
        if not python_include.exists():
            missing.append("Python development headers (Python.h)")
        if not command_available("cc") and not command_available("gcc"):
            missing.append("C/C++ compiler")
    if name in {"sn0int"} and not command_available("cargo"):
        missing.append("Rust toolchain (cargo)")
    if name in {"subfinder", "PhoneInfoga", "phonenumbers", "go-osint", "trufflehog", "gitleaks"} and not command_available("go"):
        missing.append("Go toolchain (go)")
    if name == "clearbit-python" and folder is not None and not (folder / "README.rst").exists():
        missing.append("README.rst in the repository checkout")
    if name == "lu1tr0n/nationid" and not command_available("npm"):
        missing.append("Node.js/npm")
    return missing

CATEGORIES = {
    'mail': [
        ('holehe', 'https://github.com/megadose/holehe'),
        ('h8mail', 'https://github.com/khast3x/h8mail'),
        ('poastal', 'https://github.com/jakecreps/poastal'),
        ('next-sight-osint', 'https://github.com/ZvonkoNS/next-sight-osint'),
        ('email-osint', 'https://github.com/drooling/email-osint'),
        ('Duolingo-email-osint', 'https://github.com/gn0sys11root/Duolingo-email-osint'),
        ('Dropbox-email-osint', 'https://github.com/gn0sys11root/Dropbox-email-osint'),
        ('EmailScraper', 'https://github.com/NyaMeeEain/EmailScraper'),
        ('Gitsint', 'https://github.com/Zerostats/Gitsint'),
        ('philINT', 'https://github.com/ajuelosemmanuel/philINT'),
        ('gumshoe', 'https://github.com/asharbinkhalil/gumshoe'),
        ('osintr', 'https://github.com/pdudotdev/osintr'),
        ('theHarvester', 'https://github.com/laramies/theHarvester'),
        ('GHunt', 'https://github.com/mxrch/GHunt'),
        ('pwnedOrNot', 'https://github.com/thewhiteh4t/pwnedOrNot'),
        ('EmailHarvester', 'https://github.com/maldevel/EmailHarvester'),
        ('pwndb', 'https://github.com/davidtavarez/pwndb'),
        ('dnstwist', 'https://github.com/elceef/dnstwist'),
        ('mailchecker', 'https://github.com/FGRibreau/mailchecker'),
        ('disposable-email-domains', 'https://github.com/disposable-email-domains/disposable-email-domains'),
        ('clearbit-python', 'https://github.com/clearbit/clearbit-python'),
        ('OSINT-Email-Discovery', 'https://github.com/galaxy3-net/OSINT-Email-Discovery'),
        ('sn0int', 'https://github.com/kpcyrd/sn0int'),
        ('dnsrecon', 'https://github.com/darkoperator/dnsrecon'),
        ('subfinder', 'https://github.com/projectdiscovery/subfinder'),
    ],
    'phone': [
        ('PhoneInfoga', 'https://github.com/sundowndev/phoneinfoga'),
        ('telegram-phone-number-checker', 'https://github.com/bellingcat/telegram-phone-number-checker'),
        ('ignorant', 'https://github.com/megadose/ignorant'),
        ('email2phonenumber', 'https://github.com/martinvigo/email2phonenumber'),
        ('libphonenumber', 'https://github.com/google/libphonenumber'),
        ('python-phonenumbers', 'https://github.com/daviddrysdale/python-phonenumbers'),
        ('libphonenumber-js', 'https://github.com/catamphetamine/libphonenumber-js'),
        ('libphonenumber-for-php', 'https://github.com/giggsey/libphonenumber-for-php'),
        ('phonenumbers', 'https://github.com/nyaruka/phonenumbers'),
        ('libphonenumber-csharp', 'https://github.com/twcclegg/libphonenumber-csharp'),
        ('libphonenumber-android', 'https://github.com/MichaelRocks/libphonenumber-android'),
        ('PhoneNumberKit', 'https://github.com/PhoneNumberKit/PhoneNumberKit'),
        ('libPhoneNumber-iOS', 'https://github.com/iziz/libPhoneNumber-iOS'),
        ('google-libphonenumber', 'https://github.com/ruimarinho/google-libphonenumber'),
        ('phone-number-validator-js', 'https://github.com/phone-check-app/phone-number-validator-js'),
        ('phonenumber', 'https://github.com/brick/phonenumber'),
        ('Owl-sint', 'https://github.com/IccTeam/Owl-sint'),
    ],
    'username': [
        ('sherlock', 'https://github.com/sherlock-project/sherlock'),
        ('maigret', 'https://github.com/soxoj/maigret'),
        ('social-analyzer', 'https://github.com/qeeqbox/social-analyzer'),
        ('holehe', 'https://github.com/megadose/holehe'),
        ('blackbird', 'https://github.com/p1ngul1n0/blackbird'),
        ('WhatsMyName', 'https://github.com/WebBreacher/WhatsMyName'),
        ('theHarvester', 'https://github.com/laramies/theHarvester'),
        ('GHunt', 'https://github.com/mxrch/GHunt'),
        ('NebulaOSINT', 'https://github.com/ismailtsdln/NebulaOSINT'),
        ('RhinoUserChecker', 'https://github.com/degun-osint/RhinoUserChecker'),
        ('scan_user', 'https://github.com/faciltech/scan_user'),
        ('profile-hound', 'https://github.com/socalit/profile-hound'),
        ('philINT', 'https://github.com/ajuelosemmanuel/philINT'),
        ('go-osint', 'https://github.com/vehbiu/go-osint'),
        ('Argus-OSINT-Tool', 'https://github.com/kadirsenturk/Argus-OSINT-Tool'),
        ('osintr', 'https://github.com/pdudotdev/osintr'),
        ('gumshoe', 'https://github.com/asharbinkhalil/gumshoe'),
        ('socialscan', 'https://github.com/iojw/socialscan'),
        ('Osintgram', 'https://github.com/Datalux/Osintgram'),
        ('twint', 'https://github.com/twintproject/twint'),
        ('snscrape', 'https://github.com/JustAnotherArchivist/snscrape'),
        ('instaloader', 'https://github.com/instaloader/instaloader'),
        ('github-search', 'https://github.com/gwen001/github-search'),
        ('gitrob', 'https://github.com/michenriksen/gitrob'),
        ('trufflehog', 'https://github.com/trufflesecurity/trufflehog'),
        ('gitleaks', 'https://github.com/gitleaks/gitleaks'),
        ('github-email', 'https://github.com/paulirish/github-email'),
        ('h8mail', 'https://github.com/khast3x/h8mail'),
        ('pwnedOrNot', 'https://github.com/thewhiteh4t/pwnedOrNot'),
        ('recon-ng', 'https://github.com/lanmaster53/recon-ng'),
        ('Photon', 'https://github.com/s0md3v/Photon'),
        ('spiderfoot', 'https://github.com/smicallef/spiderfoot'),
        ('maltego-trx', 'https://github.com/paterva/maltego-trx'),
        ('seeker', 'https://github.com/thewhiteh4t/seeker'),
        ('social_mapper', 'https://github.com/Greenwolf/social_mapper'),
        ('WhatsMyName-Client', 'https://github.com/grabowskiadrian/WhatsMyName-Client'),
        ('WhatsMyName-Python', 'https://github.com/C3n7ral051nt4g3ncy/WhatsMyName-Python'),
    ],
    'id': [
        ('arthurdejong/python-stdnum', 'https://github.com/arthurdejong/python-stdnum'),
        ('adieyal/id_validation', 'https://github.com/adieyal/id_validation'),
        ('identique/idnumbers-npm', 'https://github.com/identique/idnumbers-npm'),
        ('lu1tr0n/nationid', 'https://github.com/lu1tr0n/nationid'),
        ('Edditoria/validid', 'https://github.com/Edditoria/validid'),
        ('jukbot/thai-citizen-id-validator', 'https://github.com/jukbot/thai-citizen-id-validator'),
        ('josegoval/nif-dni-nie-cif-validation', 'https://github.com/josegoval/nif-dni-nie-cif-validation'),
        ('hamed-zeidabadi/iranian-national-id-validator', 'https://github.com/hamed-zeidabadi/iranian-national-id-validator'),
        ('MohamedAAbdallah/Egyptian-ID-Validator-Py', 'https://github.com/MohamedAAbdallah/Egyptian-ID-Validator-Py'),
        ('aboueleyes/id-validator', 'https://github.com/aboueleyes/id-validator'),
        ('wmthor/mykad', 'https://github.com/wmthor/mykad'),
        ('openbancor/catalogmx', 'https://github.com/openbancor/catalogmx'),
        ('bensondevs/indonesian-ktp', 'https://github.com/bensondevs/indonesian-ktp'),
        ('mikaello/norwegian-national-id-validator', 'https://github.com/mikaello/norwegian-national-id-validator'),
        ('fabiocaccamo/python-codicefiscale', 'https://github.com/fabiocaccamo/python-codicefiscale'),
        ('Reguity/validate-nin', 'https://github.com/Reguity/validate-nin'),
    ],
    'Osint-Termux': [
        ('holehe', 'https://github.com/megadose/holehe'),
        ('h8mail', 'https://github.com/khast3x/h8mail'),
        ('theHarvester', 'https://github.com/laramies/theHarvester'),
        ('sherlock', 'https://github.com/sherlock-project/sherlock'),
        ('maigret', 'https://github.com/soxoj/maigret'),
        ('PhoneInfoga', 'https://github.com/sundowndev/phoneinfoga'),
        ('ignorant', 'https://github.com/megadose/ignorant'),
        ('arthurdejong/python-stdnum', 'https://github.com/arthurdejong/python-stdnum'),
        ('adieyal/id_validation', 'https://github.com/adieyal/id_validation'),
        ('MohamedAAbdallah/Egyptian-ID-Validator-Py', 'https://github.com/MohamedAAbdallah/Egyptian-ID-Validator-Py'),
    ],
}

def run_command(command, cwd=None):
    try:
        environment = os.environ.copy()
        if command and command[0] == "go":
            environment["GOTOOLCHAIN"] = "local"
        return subprocess.run(command, cwd=cwd, env=environment, timeout=300).returncode == 0
    except FileNotFoundError:
        print("MISSING COMMAND:", command[0])
        return False
    except subprocess.TimeoutExpired:
        print("TIMEOUT:", command[0])
        return False

def ready(folder, url):
    marker = folder / ".osint-installed.json"
    if not folder.is_dir() or not (folder / ".git").exists() or not marker.exists():
        return False
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
        if data.get("url") != url:
            return False
        return run_command(["git", "-C", str(folder), "rev-parse", "--is-inside-work-tree"]) 
    except (OSError, ValueError, json.JSONDecodeError):
        return False

def main():
    parser = argparse.ArgumentParser(description="Clone and prepare OSINT repositories by category.")
    parser.add_argument("--dry-run", action="store_true", help="Show the planned repositories without cloning or installing anything.")
    parser.add_argument("--check-requirements", action="store_true", help="Report missing prerequisites without cloning or installing anything.")
    parser.add_argument("--install-dir", type=Path, default=INSTALL_DIR, help="Directory where repositories will be stored.")
    args = parser.parse_args()

    print("1. mail")
    print("2. phone")
    print("3. username")
    print("4. id")
    print("5. Osint-Termux")
    print("6. all")
    try:
        choice = input("Choose category: ").strip().lower()
    except EOFError:
        print("No category selected.", file=os.sys.stderr)
        return 1
    category = {"1":"mail", "2":"phone", "3":"username", "4":"id", "5":"Osint-Termux", "6":"all", "mail":"mail", "phone":"phone", "username":"username", "id":"id", "osint-termux":"Osint-Termux"}.get(choice)
    if category is None:
        print("Invalid choice", file=os.sys.stderr)
        return 1

    repositories = []
    for key, items in CATEGORIES.items():
        if category == "all" or category == key:
            repositories.extend(items)
    unique_repositories = []
    seen_urls = set()
    for name, url in repositories:
        if url not in seen_urls:
            seen_urls.add(url)
            unique_repositories.append((name, url))
    repositories = unique_repositories

    if args.check_requirements:
        print("Requirement check:")
        for name, url in repositories:
            folder = args.install_dir / url.rstrip("/").split("/")[-1]
            missing = requirement_status(name, folder)
            if missing:
                print(f"MISSING REQUIREMENTS: {name}: {', '.join(missing)}")
            else:
                print(f"OK: {name}")
        return 0

    if args.dry_run:
        print(f"Dry run: {len(repositories)} unique repositories selected.")
        for name, url in repositories:
            print(f"- {name}: {url}")
        return 0

    args.install_dir.mkdir(parents=True, exist_ok=True)
    for name, url in repositories:
        folder = args.install_dir / url.rstrip("/").split("/")[-1]
        missing = requirement_status(name, folder)
        if missing:
            print(f"MISSING REQUIREMENTS: {name}: {', '.join(missing)}")
            print("SKIP unavailable requirements:", name)
            continue
        if ready(folder, url):
            print("SKIP already installed and working:", name)
            continue
        if not folder.exists():
            if not run_command(["git", "clone", "--depth", "1", url, str(folder)]):
                print("FAILED clone:", name)
                continue
        success = True
        if (folder / "requirements.txt").exists():
            success = run_command(["python3", "-m", "pip", "install", "-r", str(folder / "requirements.txt")])
        elif (folder / "pyproject.toml").exists() or (folder / "setup.py").exists():
            success = run_command(["python3", "-m", "pip", "install", str(folder)])
        elif (folder / "package.json").exists():
            success = run_command(["npm", "install"], cwd=folder)
        elif (folder / "go.mod").exists():
            success = run_command(["go", "mod", "download"], cwd=folder)
        elif (folder / "Cargo.toml").exists():
            success = run_command(["cargo", "fetch"], cwd=folder)
        if success:
            (folder / ".osint-installed.json").write_text(json.dumps({"url": url, "name": name}, indent=2), encoding="utf-8")
            print("INSTALLED:", name)
        else:
            print("FAILED requirements:", name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
