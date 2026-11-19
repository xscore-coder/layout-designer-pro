cat << 'EOF' > os.sh
#!/usr/bin/env bash
# People OSINT Manager v5 — Fixed & Clean Version
set -Euo pipefail
IFS=$'\n\t'

ROOT="${OSINT_HOME:-$HOME/People-OSINT}"
LOG="$ROOT/manager.log"
mkdir -p "$ROOT"

C_RESET='\033[0m'; C_RED='\033[31m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_CYAN='\033[36m'

need(){ command -v "$1" >/dev/null 2>&1; }
log(){ printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }

# Fields: id|name|source/repo|type|status|install|description
EMAIL_TOOLS=(
'holehe|Holehe|megadose/holehe|GitHub|REVIEW|manual|Checks public registration indicators'
'ghunt|GHunt|mxrch/GHunt|GitHub|REVIEW|manual|Google-account OSINT'
'h8mail|h8mail|khast3x/h8mail|GitHub|REVIEW|manual|Breach-source lookups'
'socialscan|Socialscan|iojw/socialscan|GitHub|REVIEW|manual|Service-registration checks'
'mosint|Mosint|alpkeskin/mosint|GitHub|REVIEW|manual|Email OSINT aggregator'
'theharvester|theHarvester|laramies/theHarvester|APT|APT|theharvester|Collects public emails, hosts and names'
'spiderfoot|SpiderFoot|smicallef/spiderfoot|APT|APT|spiderfoot|Multi-source OSINT automation'
)

USERNAME_TOOLS=(
'sherlock|Sherlock|sherlock-project/sherlock|GitHub|REVIEW|manual|Public username-to-profile search'
'maigret|Maigret|soxoj/maigret|GitHub|REVIEW|manual|Username search and report generation'
'blackbird|Blackbird|antoniaci/blackbird|GitHub|REVIEW|manual|Username/email search'
'snoop|Snoop|snooppr/snoop|GitHub|REVIEW|manual|Username search with site database'
'nexfil|Nexfil|thewhiteh4t/nexfil|GitHub|REVIEW|manual|Username profile search'
'social-analyzer|Social Analyzer|qeeqbox/social-analyzer|GitHub|REVIEW|manual|Profile discovery'
'enola|Enola|TheYahya/enola|GitHub|REVIEW|manual|Username search; Go-based CLI'
'socid-extractor|socid-extractor|soxoj/socid-extractor|GitHub|REVIEW|manual|Extracts structured data from profile URLs'
)

PHONE_TOOLS=(
'phoneinfoga|PhoneInfoga|sundowndev/phoneinfoga|GitHub|REVIEW|manual|Public phone-number metadata'
'phunter|Phunter|N0rz3/Phunter|GitHub|REVIEW|manual|Phone OSINT aggregator'
'ignorant|Ignorant|megadose/ignorant|GitHub|REVIEW|manual|Checks service-registration indicators'
'phoneint|PhoneInt|SagarBiswas-MultiHAT/Phoneint-OSINT-Toolkit|GitHub|REVIEW|manual|CLI phone parsing'
)

GENERAL_TOOLS=(
'dmitry|Dmitry|jaygreig86/dmitry|APT|APT|dmitry|Domain/host information gathering'
'metagoofil|Metagoofil|laramies/metagoofil|APT|APT|metagoofil|Searches public documents for metadata'
'ghostintel|GhostIntel|ruyynn/GhostIntel|GitHub|REVIEW|manual|Multi-source framework'
)

get_array(){
  case "$1" in
    Email) printf '%s\n' "${EMAIL_TOOLS[@]}";;
    Username) printf '%s\n' "${USERNAME_TOOLS[@]}";;
    Phone) printf '%s\n' "${PHONE_TOOLS[@]}";;
    General) printf '%s\n' "${GENERAL_TOOLS[@]}";;
  esac
}

list_section(){
  local section="$1" id name source type status install desc
  printf '\n%b=== %s ===%b\n' "$C_CYAN" "$section" "$C_RESET"
  printf '%-20s %-11s %-18s %s\n' 'TOOL' 'STATUS' 'INSTALL' 'SOURCE'
  printf '%s\n' '--------------------------------------------------------------------------------'
  while IFS='|' read -r id name source type status install desc; do
    [[ -z "$id" ]] && continue
    case "$status" in
      APT) printf '%-20s %b%-11s%b %-18s %s\n' "$name" "$C_GREEN" "$status" "$C_RESET" "$install" "$source";;
      DISABLED) printf '%-20s %b%-11s%b %-18s %s\n' "$name" "$C_RED" "$status" "$C_RESET" "$install" "$source";;
      *) printf '%-20s %b%-11s%b %-18s %s\n' "$name" "$C_YELLOW" "$status" "$C_RESET" "$install" "$source";;
    esac
    printf '  %s\n' "$desc"
  done < <(get_array "$section")
}

base_check(){
  local missing=() c
  for c in git curl python3; do need "$c" || missing+=("$c"); done
  if ! python3 -m venv --help >/dev/null 2>&1; then missing+=(python3-venv); fi
  if ((${#missing[@]})); then
    echo -e "${C_RED}Missing: ${missing[*]}${C_RESET}"
    echo 'Install: sudo apt update && sudo apt install -y git curl python3 python3-venv python3-pip'
    return 1
  fi
  echo -e "${C_GREEN}Base dependencies: OK${C_RESET}"
}

apt_install(){
  local pkg="$1" candidate
  need apt-cache || { echo 'apt is unavailable.'; return 1; }
  candidate="$(apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/ {print $2; exit}')"
  if [[ -z "$candidate" || "$candidate" == '(none)' ]]; then
    echo "Package '$pkg' is not available."
    return 2
  fi
  echo "Package found: $pkg ($candidate)"
  read -rp 'Install with sudo apt? [y/N] ' ans
  [[ "$ans" =~ ^[Yy]$ ]] || return 0
  sudo apt-get install -y "$pkg"
}

install_by_id(){
  local section="$1" wanted="$2" id name source type status install desc
  while IFS='|' read -r id name source type status install desc; do
    [[ "$id" == "$wanted" ]] || continue
    case "$status" in
      APT) apt_install "$install"; return $?;;
      DISABLED) echo "Blocked: $name — $desc"; return 2;;
      REVIEW)
        echo "$name is REVIEW-only; no automatic execution or installation."
        if [[ "$source" == http://* || "$source" == https://* ]]; then
          echo "Review repository: $source"
        else
          echo "Review repository: https://github.com/$source"
        fi
        return 2;;
    esac
  done < <(get_array "$section")
  echo 'Unknown tool ID.'; return 1
}

section_menu(){
  local section="$1" id
  while true; do
    printf '\n%b=== %s ===%b\n' "$C_CYAN" "$section" "$C_RESET"
    echo '1) List tools'
    echo '2) Install an available APT package'
    echo '3) Back'
    read -rp 'Choice: ' c
    case "$c" in
      1) list_section "$section";;
      2) read -rp 'Tool ID (see list): ' id; install_by_id "$section" "$id" || true;;
      3) return;;
      *) echo 'Invalid choice.';;
    esac
  done
}

# CLI arguments
if [[ "${1:-}" == '--list' ]]; then
  list_section Email; list_section Username; list_section Phone; list_section General; exit 0
fi
if [[ "${1:-}" == '--check' ]]; then base_check; exit $?; fi

# Interactive menu
while true; do
  echo ""
  echo -e "${C_CYAN}╔═══════════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_CYAN}║  PEOPLE OSINT MANAGER v5 — TERMINAL ONLY                  ║${C_RESET}"
  echo -e "${C_CYAN}╚═══════════════════════════════════════════════════════════╝${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}1)${C_RESET} Email tools"
  echo -e "  ${C_GREEN}2)${C_RESET} Username tools"
  echo -e "  ${C_GREEN}3)${C_RESET} Phone tools"
  echo -e "  ${C_GREEN}4)${C_RESET} General CLI tools"
  echo -e "  ${C_YELLOW}5)${C_RESET} Check base dependencies"
  echo -e "  ${C_YELLOW}6)${C_RESET} List everything"
  echo -e "  ${C_RED}7)${C_RESET} Exit"
  echo ""
  read -rp '  Choose: ' choice
  case "$choice" in
    1) section_menu Email;;
    2) section_menu Username;;
    3) section_menu Phone;;
    4) section_menu General;;
    5) base_check || true;;
    6) list_section Email; list_section Username; list_section Phone; list_section General;;
    7) echo "Goodbye!"; exit 0;;
    *) echo 'Invalid choice.';;
  esac
done
EOF