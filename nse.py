#!/usr/bin/env python3
"""Clone and prepare OSINT repositories by category.

Self-healing installer:
  * installs missing system prerequisites (git, compiler, Python headers/venv,
    Go, Rust, Node.js) with apt (Debian/Ubuntu/Kali) or pkg (Termux)
  * puts every Python tool in its own virtualenv (avoids PEP 668
    "externally-managed-environment" errors)
  * fetches the Python version a tool needs with uv (e.g. Python 3.14)
  * builds Go / Rust tools, runs npm install for Node tools
  * retries failed clones and falls back to lenient dependency installs
"""
import argparse
from datetime import datetime, timezone
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

INSTALL_DIR = Path("osint-tools")
DEFAULT_TIMEOUT = 1800  # seconds per command (Rust/Go builds can be slow)

CONFIG = {"timeout": DEFAULT_TIMEOUT, "auto_install": True, "apt_updated": False}

# Prerequisites per tool, used by --check-requirements. Anything missing is
# installed automatically during a normal run.
TOOL_REQUIREMENTS = {
    "dnstwist": ["compiler", "python"],
    "sn0int": ["cargo", "rust-libs"],
    "subfinder": ["go"],
    "PhoneInfoga": ["go"],
    "phonenumbers": ["go"],
    "go-osint": ["go"],
    "trufflehog": ["go"],
    "gitleaks": ["go"],
    "lu1tr0n/nationid": ["npm"],
    "social-analyzer": ["npm"],
}

# PyPI fallback names when installing from the repository checkout fails.
PYPI_NAMES = {
    "sherlock": "sherlock-project",
    "clearbit-python": "clearbit",
    "python-phonenumbers": "phonenumbers",
}

# ---------------------------------------------------------------------------
# System prerequisites
# ---------------------------------------------------------------------------
SYSTEM_PACKAGES = {
    "git": {"apt": ["git"], "termux": ["git"]},
    "go": {"apt": ["golang-go"], "termux": ["golang"]},
    "cargo": {"apt": ["cargo", "rustc"], "termux": ["rust"]},
    "rust-libs": {
        "apt": ["pkg-config", "libssl-dev", "libsodium-dev", "libseccomp-dev", "libsqlite3-dev"],
        "termux": ["openssl", "libsodium", "libsqlite"],
    },
    "npm": {"apt": ["nodejs", "npm"], "termux": ["nodejs"]},
    "compiler": {
        "apt": ["build-essential", "pkg-config", "libffi-dev", "libssl-dev",
                "libxml2-dev", "libxslt1-dev", "zlib1g-dev"],
        "termux": ["clang", "make", "libffi", "openssl", "libxml2", "libxslt"],
    },
    # Debian 13 may split ensurepip/venv support from the base interpreter.
    "python": {"apt": ["python3-venv", "python3-full", "python3-pip", "python3-dev"], "termux": ["python"]},
}


def is_termux():
    return "com.termux" in os.environ.get("PREFIX", "")


def command_available(command):
    return shutil.which(command) is not None


def python_ready():
    """Check that the active interpreter can create virtual environments."""
    try:
        import venv  # noqa: F401
        import ensurepip  # noqa: F401
        return Path(sys.executable).exists()
    except (ImportError, ValueError):
        return False


CHECKS = {
    "git": lambda: command_available("git"),
    "go": lambda: command_available("go"),
    "cargo": lambda: command_available("cargo"),
    "npm": lambda: command_available("npm"),
    "compiler": lambda: any(command_available(c) for c in ("cc", "gcc", "clang")),
    "python": python_ready,
    "rust-libs": lambda: is_termux() or (
        command_available("pkg-config")
        and subprocess.run(["pkg-config", "--exists", "libsodium"]).returncode == 0
    ),
}


def run_command(command, cwd=None, quiet=False, timeout=None):
    """Run a command; return True on exit code 0. Never raises."""
    normalized_command = [str(c) for c in command]
    if any("\x00" in item for item in normalized_command):
        print("INVALID COMMAND: embedded NUL byte")
        return False
    environment = os.environ.copy()
    environment["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"
    # PEP 668-safe guard: even if a code path accidentally targets the
    # system interpreter, pip must refuse instead of modifying Debian Python.
    environment["PIP_REQUIRE_VIRTUALENV"] = "1"
    environment["GIT_TERMINAL_PROMPT"] = "0"  # never hang on credential prompts
    if command and command[0] == "go":
        environment.setdefault("GOTOOLCHAIN", "auto")  # allow Go to fetch a newer toolchain
        if environment["GOTOOLCHAIN"] == "local":
            environment["GOTOOLCHAIN"] = "auto"
    try:
        return subprocess.run(
            normalized_command,
            cwd=cwd,
            env=environment,
            timeout=timeout or CONFIG["timeout"],
            stdout=subprocess.DEVNULL if quiet else None,
            stderr=subprocess.DEVNULL if quiet else None,
        ).returncode == 0
    except FileNotFoundError:
        print("MISSING COMMAND:", command[0])
    except subprocess.TimeoutExpired:
        print("TIMEOUT:", command[0])
    except OSError as error:
        print("OS ERROR:", command[0], error)
    except ValueError as error:
        # subprocess raises ValueError for invalid argv/cwd values, including
        # embedded NUL bytes. Treat it like a failed dependency, not a crash.
        print("INVALID COMMAND:", command[0] if command else "<empty>", error)
    return False


def install_system_packages(packages):
    """Install OS packages with pkg (Termux) or apt-get. Returns True on success."""
    if is_termux():
        base = ["pkg", "install", "-y"]
        return run_command(base + packages) or all(run_command(base + [p]) for p in packages)
    if not command_available("apt-get"):
        print("No supported package manager (apt/pkg). Install manually:", " ".join(packages))
        return False
    prefix = []
    if getattr(os, "geteuid", lambda: 0)() != 0:
        if not command_available("sudo"):
            print("Root privileges are required. Run as root or install manually:")
            print("  apt-get install -y", " ".join(packages))
            return False
        prefix = ["sudo"]
    env_cmd = ["env", "DEBIAN_FRONTEND=noninteractive"]
    if not CONFIG["apt_updated"]:
        run_command(prefix + env_cmd + ["apt-get", "update"])
        CONFIG["apt_updated"] = True
    install = prefix + env_cmd + ["apt-get", "install", "-y"]
    if run_command(install + packages):
        return True
    # One unavailable package must not block the rest.
    results = [run_command(install + [package]) for package in packages]
    return any(results)


_ensured = {}


def ensure(kind):
    """Make sure a prerequisite is present, installing it if allowed."""
    if kind in _ensured:
        return _ensured[kind]
    if CHECKS[kind]():
        _ensured[kind] = True
        return True
    if not CONFIG["auto_install"]:
        print(f"MISSING REQUIREMENT: {kind} (auto-install disabled)")
        return False
    manager = "termux" if is_termux() else "apt"
    print(f"Installing prerequisite: {kind} ...")
    install_system_packages(SYSTEM_PACKAGES[kind][manager])
    _ensured[kind] = CHECKS[kind]()
    if not _ensured[kind]:
        print(f"COULD NOT INSTALL prerequisite: {kind}")
    return _ensured[kind]


def requirement_status(name):
    """Return the missing prerequisite names for a repository (check mode)."""
    return [kind for kind in TOOL_REQUIREMENTS.get(name, []) if not CHECKS[kind]()]


# ---------------------------------------------------------------------------
# Python tools: per-tool virtualenv (fixes PEP 668), optional uv-provided Python
# ---------------------------------------------------------------------------
def venv_python(folder):
    for candidate in (folder / ".venv" / "bin" / "python", folder / ".venv" / "Scripts" / "python.exe"):
        if candidate.exists():
            return candidate
    return None


def python_version_of(py):
    try:
        out = subprocess.run(
            [str(py), "-c", "import sys;print('%d.%d' % sys.version_info[:2])"],
            capture_output=True, text=True, timeout=60,
        )
        return out.stdout.strip() if out.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def is_virtualenv_python(py):
    """Return True only when `py` is running inside an actual virtualenv."""
    try:
        result = subprocess.run(
            [str(py), "-c", "import sys; print('1' if sys.prefix != sys.base_prefix else '0')"],
            capture_output=True, text=True, timeout=30,
        )
        return result.returncode == 0 and result.stdout.strip() == "1"
    except (OSError, subprocess.TimeoutExpired):
        return False


def python_requirement(folder):
    """Read the repository's declared Python requirement, if any."""
    patterns = [
        (folder / "pyproject.toml", r"requires-python\s*=\s*[\"']([^\"']+)[\"']"),
        (folder / "setup.py", r"python_requires\s*=\s*[\"']([^\"']+)[\"']"),
        (folder / "setup.cfg", r"python_requires\s*=\s*([^\n]+)"),
    ]
    for path, pattern in patterns:
        if path.exists():
            try:
                match = re.search(pattern, path.read_text(encoding="utf-8", errors="ignore"))
            except OSError:
                continue
            if match:
                return match.group(1).strip()
    return None


def choose_python(spec):
    """Return 'X.Y' if the running Python violates the spec, else None."""
    if not spec:
        return None
    current = sys.version_info[:2]
    lower = upper = None
    for part in spec.split(","):
        match = re.match(r"\s*(>=|>|<=|<|~=)\s*(\d+)\.(\d+)", part)
        if not match:
            continue
        op, major, minor = match.group(1), int(match.group(2)), int(match.group(3))
        if op in (">=", "~="):
            lower = (major, minor)
        elif op == ">":
            lower = (major, minor + 1)
        elif op == "<":
            upper = (major, minor)
        elif op == "<=":
            upper = (major, minor + 1)
    if lower and current < lower:
        return f"{lower[0]}.{lower[1]}"
    if upper and current >= upper and upper[1] > 0:
        return f"{upper[0]}.{upper[1] - 1}"
    return None


def ensure_uv(install_dir):
    existing = shutil.which("uv")
    if existing:
        return Path(existing)
    tools = install_dir / ".tools"
    for uv in (tools / "bin" / "uv", tools / "Scripts" / "uv.exe", tools / "Scripts" / "uv"):
        if uv.exists():
            return uv
    if not ensure("python"):
        return None
    if not run_command([sys.executable, "-m", "venv", str(tools)]):
        return None
    py = venv_python(tools)
    if py and pip(py, "uv"):
        for uv in (tools / "bin" / "uv", tools / "Scripts" / "uv.exe", tools / "Scripts" / "uv"):
            if uv.exists():
                return uv
    return None


def ensure_venv(folder, install_dir, target=None):
    """Create (or reuse) folder/.venv. `target` is an 'X.Y' Python to fetch via uv."""
    py = venv_python(folder)
    if py and is_virtualenv_python(py) and run_command([str(py), "-m", "pip", "--version"], quiet=True):
        if target is None or python_version_of(py) == target:
            return py
    shutil.rmtree(folder / ".venv", ignore_errors=True)
    if target:
        uv = ensure_uv(install_dir)
        if uv is None:
            print(f"Could not obtain uv to provide Python {target}.")
            return None
        print(f"Using Python {target} (fetched with uv) ...")
        created = run_command([uv, "venv", "--seed", "--python", target, str(folder / ".venv")])
    else:
        if not ensure("python"):
            return None
        created = run_command([sys.executable, "-m", "venv", str(folder / ".venv")])
    py = venv_python(folder)
    if not created or py is None or not is_virtualenv_python(py) or not run_command([str(py), "-m", "pip", "--version"], quiet=True):
        print("Could not create a working virtualenv.")
        shutil.rmtree(folder / ".venv", ignore_errors=True)
        return None
    run_command([str(py), "-m", "pip", "install", "--quiet", "--upgrade", "pip", "setuptools", "wheel"], quiet=True)
    return py


def pip(py, *args):
    if not is_virtualenv_python(py):
        print(f"REFUSING system Python pip install: {py}")
        return False
    if any("\x00" in str(arg) for arg in args):
        print("REFUSING invalid pip argument: embedded NUL byte")
        return False
    return run_command([str(py), "-m", "pip", "install", *args])


def install_requirements(py, req_file):
    """Install requirements; on failure retry unpinned and package-by-package."""
    if pip(py, "-r", str(req_file)):
        return True, []
    print("Bulk install failed; retrying packages individually (unpinned fallback) ...")
    try:
        lines = req_file.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return False, []
    installed, failed = 0, []
    for raw in lines:
        if "\x00" in raw:
            failed.append("<invalid requirement: embedded NUL byte>")
            continue
        line = raw.split("#")[0].strip()
        if not line or line.startswith("-r") or (line.startswith("-") and not line.startswith("-e")):
            continue
        spec = line.split(";")[0].strip()
        if pip(py, spec):
            installed += 1
            continue
        loose = re.match(r"^([A-Za-z0-9_.\-]+(?:\[[^\]]*\])?)", spec)
        if loose and not spec.startswith(("git+", "-e", "http")) and pip(py, loose.group(1)):
            installed += 1
        else:
            failed.append(spec)
    return installed > 0, failed


def install_python_tool(folder, install_dir):
    has_package = (folder / "pyproject.toml").exists() or (folder / "setup.py").exists()
    req_file = folder / "requirements.txt"
    ensure("compiler")
    py = ensure_venv(folder, install_dir, choose_python(python_requirement(folder)))
    if py is None:
        return False, ["virtualenv creation failed"]
    notes = []
    if has_package and pip(py, str(folder)):
        return True, notes
    if req_file.exists():
        ok, failed = install_requirements(py, req_file)
        if failed:
            notes.append("could not install: " + ", ".join(failed))
        if ok:
            return True, notes
    pypi_name = PYPI_NAMES.get(folder.name, folder.name)
    print(f"Trying PyPI package '{pypi_name}' as a fallback ...")
    if pip(py, pypi_name):
        return True, notes
    return False, notes


# ---------------------------------------------------------------------------
# Node / Go / Rust tools
# ---------------------------------------------------------------------------
def install_node_tool(folder):
    if not ensure("npm"):
        return False
    base = ["npm", "install", "--no-audit", "--no-fund"]
    return run_command(base, cwd=folder) or run_command(base + ["--legacy-peer-deps"], cwd=folder)


def install_go_tool(folder):
    if not ensure("go"):
        return False
    targets = []
    if (folder / "main.go").exists():
        targets.append((folder.name, "."))
    cmd_dir = folder / "cmd"
    if cmd_dir.is_dir():
        for sub in sorted(cmd_dir.iterdir()):
            if sub.is_dir() and any(sub.glob("*.go")):
                targets.append((sub.name, f"./cmd/{sub.name}"))
    if not targets:
        return run_command(["go", "mod", "download"], cwd=folder)
    (folder / "bin").mkdir(exist_ok=True)
    built = False
    for tool_name, package in targets:
        if run_command(["go", "build", "-o", str(folder / "bin" / tool_name), package], cwd=folder):
            built = True
    if built:
        return True
    print("go build failed; downloading modules only.")
    return run_command(["go", "mod", "download"], cwd=folder)


def install_rust_tool(folder):
    if not ensure("cargo"):
        return False
    ensure("rust-libs")
    ensure("compiler")
    if run_command(["cargo", "build", "--release"], cwd=folder):
        return True
    print("cargo build failed; fetching crates only.")
    return run_command(["cargo", "fetch"], cwd=folder)


# ---------------------------------------------------------------------------
# Repository handling
# ---------------------------------------------------------------------------
def clone_repo(url, folder):
    if not ensure("git"):
        return False
    if folder.exists() and not (folder / ".git").exists():
        shutil.rmtree(folder, ignore_errors=True)  # leftover from an interrupted clone
    if (folder / ".git").exists():
        return True
    for attempt in range(1, 4):
        if run_command(["git", "clone", "--depth", "1", url, str(folder)], timeout=600):
            return True
        shutil.rmtree(folder, ignore_errors=True)
        if attempt < 3:
            print(f"Clone failed, retrying ({attempt}/2) ...")
            time.sleep(3 * attempt)
    return False


def install_repo(folder, install_dir):
    """Install whatever the repository contains. Returns (success, parts, notes)."""
    parts, notes, attempted = [], [], 0
    if any((folder / f).exists() for f in ("requirements.txt", "pyproject.toml", "setup.py")):
        attempted += 1
        ok, extra = install_python_tool(folder, install_dir)
        notes += extra
        if ok:
            parts.append("python")
    if (folder / "package.json").exists():
        attempted += 1
        if install_node_tool(folder):
            parts.append("node")
    if (folder / "go.mod").exists():
        attempted += 1
        if install_go_tool(folder):
            parts.append("go")
    if (folder / "Cargo.toml").exists():
        attempted += 1
        if install_rust_tool(folder):
            parts.append("rust")
    if attempted == 0:
        return True, ["source only"], ["library/data repository, nothing to install"]
    failed_kinds = attempted - len(parts)
    if failed_kinds and parts:
        notes.append(f"{failed_kinds} optional component(s) failed")
    return bool(parts), parts, notes


def ready(folder, url):
    marker = folder / ".osint-installed.json"
    if not folder.is_dir() or not (folder / ".git").exists() or not marker.exists():
        return False
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
        if data.get("url") != url:
            return False
        return run_command(["git", "-C", str(folder), "rev-parse", "--is-inside-work-tree"], quiet=True)
    except (OSError, ValueError):
        return False


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


CATEGORY_ALIASES = {
    "1": "mail", "mail": "mail",
    "2": "phone", "phone": "phone",
    "3": "username", "username": "username",
    "4": "id", "id": "id",
    "5": "Osint-Termux", "osint-termux": "Osint-Termux",
    "6": "all", "all": "all",
}


# Search-OSINT is intentionally separate from the repository installer. These
# entries describe commands that may be available after installation; the
# search menu never installs or clones anything.
SEARCH_TOOLS = {
    "email": [
        {"id": "holehe", "label": "holehe", "repo": "holehe", "command": "holehe", "args": ["{target}"], "status": "supported"},
        {"id": "h8mail", "label": "h8mail", "repo": "h8mail", "command": "h8mail", "args": ["-t", "{target}"], "status": "supported"},
        {"id": "theHarvester", "label": "theHarvester", "repo": "theHarvester", "command": "theHarvester", "args": ["-d", "{target}", "-b", "all"], "status": "supported"},
    ],
    "username": [
        {"id": "sherlock", "label": "Sherlock", "repo": "sherlock", "command": "sherlock", "args": ["{target}"], "status": "supported"},
        {"id": "maigret", "label": "Maigret", "repo": "maigret", "command": "maigret", "args": ["{target}"], "status": "supported"},
        {"id": "social-analyzer", "label": "Social Analyzer", "repo": "social-analyzer", "command": "social-analyzer", "args": ["--username", "{target}"], "status": "supported"},
        {"id": "twint", "label": "Twint", "repo": "twint", "command": "twint", "args": ["-u", "{target}"], "status": "archived"},
    ],
    "phone": [
        {"id": "PhoneInfoga", "label": "PhoneInfoga", "repo": "PhoneInfoga", "command": "phoneinfoga", "args": ["scan", "-n", "{target}"], "status": "supported"},
        {"id": "ignorant", "label": "ignorant", "repo": "ignorant", "command": "ignorant", "args": ["{target}"], "status": "supported"},
    ],
    "id": [
        {"id": "egyptian-id-format", "label": "Egyptian ID format/date", "kind": "builtin", "status": "supported"},
        {"id": "luhn-checksum", "label": "Generic Luhn checksum", "kind": "builtin", "status": "supported"},
    ],
}

SEARCH_LABELS = {
    "email": "Email OSINT",
    "username": "Username OSINT",
    "phone": "Phone OSINT",
    "id": "National ID OSINT",
}


def _status_label(status):
    return {
        "supported": "supported",
        "archived": "archived",
        "incompatible": "incompatible",
        "not-installed": "not installed",
    }.get(status, status)


def _search_tool_path(spec, install_dir):
    """Find a tool in PATH or in the repository's common executable folders."""
    command = spec.get("command")
    if not command:
        return None
    found = shutil.which(command)
    if found:
        return Path(found)
    folder = install_dir / spec.get("repo", spec["id"])
    names = [command, f"{command}.exe"]
    locations = [
        folder / ".venv" / "bin",
        folder / ".venv" / "Scripts",
        folder / "bin",
        folder / "target" / "release",
        folder,
    ]
    for location in locations:
        for name in names:
            candidate = location / name
            if candidate.is_file():
                return candidate
    return None


def _validate_egyptian_id(target):
    """Validate Egyptian ID shape/date only; do not identify or look up a person."""
    value = target.strip()
    if not re.fullmatch(r"\d{14}", value):
        return False, "Expected exactly 14 digits."
    century = {"2": 1900, "3": 2000}.get(value[0])
    if century is None:
        return False, "The first digit must be 2 or 3."
    try:
        datetime(century + int(value[1:3]), int(value[3:5]), int(value[5:7]))
    except ValueError:
        return False, "The embedded birth date is invalid."
    if value[7:9] == "00":
        return False, "The governorate code cannot be 00."
    return True, "14-digit format and embedded date are valid; no identity lookup was performed."


def _validate_luhn(target):
    value = re.sub(r"[ -]", "", target.strip())
    if not value.isdigit() or not value:
        return False, "Expected a numeric value."
    total = 0
    parity = len(value) % 2
    for index, digit in enumerate(map(int, value)):
        number = digit * (2 if index % 2 == parity else 1)
        total += number - 9 if number > 9 else number
    return total % 10 == 0, "Luhn checksum is valid." if total % 10 == 0 else "Luhn checksum is invalid."


def _run_builtin_search(spec, target):
    if spec["id"] == "egyptian-id-format":
        return _validate_egyptian_id(target)
    if spec["id"] == "luhn-checksum":
        return _validate_luhn(target)
    return False, "Unknown built-in validator."


def _run_search_tool(spec, target, install_dir, timeout):
    started = time.monotonic()
    result = {
        "tool": spec["label"],
        "id": spec["id"],
        "status": "pending",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    if spec.get("status") in {"archived", "incompatible"}:
        result["status"] = spec["status"]
        result["message"] = spec.get("reason", spec["status"])
        return result
    if spec.get("kind") == "builtin":
        ok, message = _run_builtin_search(spec, target)
        result.update(status="success" if ok else "failed", message=message)
        result["duration_seconds"] = round(time.monotonic() - started, 3)
        return result
    executable = _search_tool_path(spec, install_dir)
    if executable is None:
        result.update(status="not-installed", message="Tool executable was not found.")
        return result
    command = [str(executable)] + [arg.replace("{target}", target) for arg in spec["args"]]
    repo_folder = install_dir / spec.get("repo", spec["id"])
    working_directory = repo_folder if repo_folder.is_dir() else None
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout,
                                   cwd=working_directory, env=os.environ.copy())
        output = (completed.stdout + ("\n" + completed.stderr if completed.stderr else "")).strip()
        result.update(status="success" if completed.returncode == 0 else "failed",
                      return_code=completed.returncode, output=output[-12000:])
    except subprocess.TimeoutExpired as error:
        output = ((error.stdout or "") + ("\n" + error.stderr if error.stderr else "")).strip()
        result.update(status="timeout", output=output[-12000:])
    except OSError as error:
        result.update(status="failed", message=str(error))
    result["duration_seconds"] = round(time.monotonic() - started, 3)
    return result


def _save_search_report(report, report_dir):
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    stem = report_dir / f"search-{report['section']}-{stamp}"
    json_path = stem.with_suffix(".json")
    txt_path = stem.with_suffix(".txt")
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = [f"Search-OSINT: {report['section_label']}", f"Target: {report['target']}", ""]
    for item in report["results"]:
        lines.append(f"[{item['status']}] {item['tool']}")
        if item.get("message"):
            lines.append(item["message"])
        if item.get("output"):
            lines.append(item["output"])
        lines.append("")
    txt_path.write_text("\n".join(lines), encoding="utf-8")
    return txt_path, json_path


def run_search_osint(install_dir, timeout):
    """Interactive Search-OSINT menu; does not clone, install, or modify tools."""
    while True:
        print("\n# Search-OSINT\n\nMain Menu")
        print("1. Email OSINT\n2. Username OSINT\n3. Phone OSINT\n4. National ID OSINT\n5. Back to Main Menu")
        choice = input("Choose search type: ").strip()
        section = {"1": "email", "2": "username", "3": "phone", "4": "id"}.get(choice)
        if choice == "5":
            return
        if section is None:
            print("Invalid choice.")
            continue
        target = input("Target: ").strip()
        if not target:
            print("Target cannot be empty.")
            continue
        print("Use this only with data you own or are authorized to assess.")
        if input("Type AUTHORIZED to continue: ").strip().upper() != "AUTHORIZED":
            print("Search cancelled.")
            continue
        specs = SEARCH_TOOLS[section]
        print(f"\nAvailable tools for {SEARCH_LABELS[section]}:")
        for index, spec in enumerate(specs, 1):
            status = spec.get("status", "supported")
            if status == "supported" and spec.get("kind") != "builtin" and _search_tool_path(spec, install_dir) is None:
                status = "not-installed"
            print(f"{index}. {spec['label']} [{_status_label(status)}]")
        print(f"{len(specs) + 1}. All supported tools")
        print(f"{len(specs) + 2}. Select tools manually")
        print(f"{len(specs) + 3}. Back")
        selection = input("Choose tools: ").strip()
        if selection == str(len(specs) + 3):
            continue
        if selection == str(len(specs) + 1):
            selected = [spec for spec in specs if spec.get("status") == "supported"]
        elif selection == str(len(specs) + 2):
            raw = input("Enter tool numbers separated by commas: ")
            numbers = {int(part.strip()) for part in raw.split(",") if part.strip().isdigit()}
            selected = [spec for index, spec in enumerate(specs, 1) if index in numbers]
        else:
            numbers = {int(part.strip()) for part in selection.split(",") if part.strip().isdigit()}
            selected = [spec for index, spec in enumerate(specs, 1) if index in numbers]
        if not selected:
            print("No tools selected.")
            continue
        unique = {spec["id"]: spec for spec in selected}
        print(f"\nRunning {len(unique)} tool(s), timeout per tool: {timeout}s")
        report = {
            "section": section,
            "section_label": SEARCH_LABELS[section],
            "target": target,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "timeout_seconds": timeout,
            "results": [],
        }
        for spec in unique.values():
            print(f"- {spec['label']} ...")
            result = _run_search_tool(spec, target, install_dir, timeout)
            report["results"].append(result)
            print(f"  {result['status']}")
        txt_path, json_path = _save_search_report(report, Path("search-results"))
        print(f"\nReports saved:\nTXT: {txt_path}\nJSON: {json_path}")


def unique_repositories(category):
    """Selected repositories, de-duplicated by URL with collision-free folder names."""
    selected, seen_urls, used_folders = [], set(), {}
    for key, items in CATEGORIES.items():
        if category != "all" and category != key:
            continue
        for name, url in items:
            if url in seen_urls:
                continue
            seen_urls.add(url)
            parts = url.rstrip("/").split("/")
            slug = parts[-1]
            if slug.lower() in used_folders:  # same repo name, different owner
                slug = f"{parts[-2]}-{parts[-1]}"
            used_folders[slug.lower()] = url
            selected.append((name, url, slug))
    return selected


def main():
    parser = argparse.ArgumentParser(description="Clone and prepare OSINT repositories by category.")
    parser.add_argument("--search", action="store_true", help="Open the separate Search-OSINT menu.")
    parser.add_argument("--dry-run", action="store_true", help="Show the planned repositories without cloning or installing anything.")
    parser.add_argument("--check-requirements", action="store_true", help="Report missing prerequisites without cloning or installing anything.")
    parser.add_argument("--install-dir", type=Path, default=INSTALL_DIR, help="Directory where repositories will be stored.")
    parser.add_argument("--category", help="mail, phone, username, id, osint-termux or all (skips the menu).")
    parser.add_argument("--force", action="store_true", help="Reinstall tools even if already marked as installed.")
    parser.add_argument("--no-auto-install", action="store_true", help="Do not install missing system packages automatically.")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Per-command timeout in seconds (default: %(default)s).")
    args = parser.parse_args()
    CONFIG["timeout"] = args.timeout
    CONFIG["auto_install"] = not args.no_auto_install

    if args.search:
        run_search_osint(args.install_dir.resolve(), args.timeout)
        return 0

    if args.category:
        choice = args.category.strip().lower()
    else:
        print("\nMain Menu")
        print("1. Search-OSINT")
        print("2. Install / prepare repositories")
        print("3. Exit")
        try:
            main_choice = input("Choose an option: ").strip()
        except EOFError:
            print("No option selected.", file=sys.stderr)
            return 1
        if main_choice == "1":
            run_search_osint(args.install_dir.resolve(), args.timeout)
            return 0
        if main_choice == "3":
            return 0
        if main_choice != "2":
            print("Invalid choice", file=sys.stderr)
            return 1
        print("\nInstall / prepare repositories")
        print("1. mail")
        print("2. phone")
        print("3. username")
        print("4. id")
        print("5. Osint-Termux")
        print("6. all")
        try:
            choice = input("Choose category: ").strip().lower()
        except EOFError:
            print("No category selected.", file=sys.stderr)
            return 1
    category = CATEGORY_ALIASES.get(choice)
    if category is None:
        print("Invalid choice", file=sys.stderr)
        return 1

    repositories = unique_repositories(category)
    install_dir = args.install_dir.resolve()

    if args.check_requirements:
        print("Requirement check (missing ones are installed automatically on a normal run):")
        for kind in ("git", "python"):
            print(f"{'OK' if CHECKS[kind]() else 'MISSING'}: {kind}")
        for name, url, slug in repositories:
            missing = requirement_status(name)
            if missing:
                print(f"MISSING REQUIREMENTS: {name}: {', '.join(missing)}")
            else:
                print(f"OK: {name}")
        return 0

    if args.dry_run:
        print(f"Dry run: {len(repositories)} unique repositories selected.")
        for name, url, slug in repositories:
            print(f"- {name}: {url}")
        return 0

    install_dir.mkdir(parents=True, exist_ok=True)
    ensure("git")
    installed, skipped, failed, warned = [], [], [], []
    try:
        for index, (name, url, slug) in enumerate(repositories, 1):
            folder = install_dir / slug
            print(f"\n[{index}/{len(repositories)}] {name}")
            if not args.force and ready(folder, url):
                print("SKIP already installed and working:", name)
                skipped.append(name)
                continue
            if not clone_repo(url, folder):
                print("FAILED clone:", name)
                failed.append(f"{name} (clone)")
                continue
            success, parts, notes = install_repo(folder, install_dir)
            for note in notes:
                print("NOTE:", note)
            if success:
                (folder / ".osint-installed.json").write_text(
                    json.dumps({"url": url, "name": name, "installed": parts}, indent=2), encoding="utf-8")
                print("INSTALLED:", name, f"({', '.join(parts)})")
                installed.append(name)
                if notes and parts != ["source only"]:
                    warned.append(f"{name}: {'; '.join(notes)}")
            else:
                print("FAILED requirements:", name)
                failed.append(f"{name} (install)")
    except KeyboardInterrupt:
        print("\nInterrupted. Re-run to continue; finished tools are skipped.")

    print("\n=== Summary ===")
    print(f"Installed: {len(installed)}  Skipped: {len(skipped)}  Failed: {len(failed)}")
    for item in warned:
        print("  warning:", item)
    for item in failed:
        print("  failed:", item)
    print("\nPython tools live in <tool>/.venv ; run e.g. "
          f"{install_dir / 'maigret' / '.venv' / 'bin' / 'maigret'} --help")
    print("Go/Rust binaries: <tool>/bin/ and <tool>/target/release/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
