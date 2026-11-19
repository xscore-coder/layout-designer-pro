# ═══════════════════════════════════════════════════════════════════════════
# PASTEL UI COMPONENTS — Centered Header + Left-Aligned Menus
# ═══════════════════════════════════════════════════════════════════════════

# Get terminal width (default 80)
get_term_width(){
  local w
  w=$(tput cols 2>/dev/null) || w=80
  echo "${w:-80}"
}

# Centered header with pastel Kali styling
print_header(){
  local title="$1" subtitle="${2:-}"
  local width
  width=$(get_term_width)
  local border="═"
  local inner="═"
  
  # Build full-width border
  local full_border=""
  for ((i=0; i<width; i++)); do full_border+="═"; done
  
  echo ""
  echo -e "${C_DARK}${full_border}${C_RESET}"
  
  # Center the title
  local title_len=${#title}
  local padding=$(( (width - title_len - 4) / 2 ))
  local left_pad="" right_pad=""
  for ((i=0; i<padding; i++)); do left_pad+=" "; done
  local right_len=$(( width - title_len - 4 - padding ))
  for ((i=0; i<right_len; i++)); do right_pad+=" "; done
  
  echo -e "${C_DARK}║${C_RESET}${C_BG_DARK}${C_CYAN}${left_pad}  ${title}  ${right_pad}${C_RESET}${C_DARK}║${C_RESET}"
  
  # Subtitle (centered too)
  if [[ -n "$subtitle" ]]; then
    local sub_len=${#subtitle}
    local sub_padding=$(( (width - sub_len - 4) / 2 ))
    local sub_left="" sub_right=""
    for ((i=0; i<sub_padding; i++)); do sub_left+=" "; done
    local sub_right_len=$(( width - sub_len - 4 - sub_padding ))
    for ((i=0; i<sub_right_len; i++)); do sub_right+=" "; done
    echo -e "${C_DARK}║${C_RESET}${C_BG_DARK}${C_WHITE}${sub_left} ${subtitle} ${sub_right}${C_RESET}${C_DARK}║${C_RESET}"
  else
    local empty_padding=$(( (width - 4) / 2 ))
    local empty_left="" empty_right=""
    for ((i=0; i<empty_padding; i++)); do empty_left+=" "; done
    local empty_right_len=$(( width - 4 - empty_padding ))
    for ((i=0; i<empty_right_len; i++)); do empty_right+=" "; done
    echo -e "${C_DARK}║${C_RESET}${empty_left}${empty_right}${C_DARK}║${C_RESET}"
  fi
  
  echo -e "${C_DARK}${full_border}${C_RESET}"
  echo ""
}

# Section header — left-aligned with accent
print_section_header(){
  local title="$1"
  local width
  width=$(get_term_width)
  local border="─"
  local full_border=""
  for ((i=0; i<width; i++)); do full_border+="─"; done
  
  echo ""
  echo -e "${C_DARK}${full_border}${C_RESET}"
  echo -e "${C_DARK}│${C_RESET} ${C_CYAN}▸${C_RESET} ${C_WHITE}${title}${C_RESET}"
  echo -e "${C_DARK}${full_border}${C_RESET}"
}

# ═══════════════════════════════════════════════════════════════════════════
# SECTION MENU — Left-Aligned
# ═══════════════════════════════════════════════════════════════════════════

section_menu(){
  local section="$1"
  while true; do
    print_section_header "SECTION: $section"
    echo ""
    echo -e "  ${C_CYAN}[1]${C_RESET} List tools"
    echo -e "  ${C_CYAN}[2]${C_RESET} Health check this section"
    echo -e "  ${C_CYAN}[3]${C_RESET} Install missing tools in this section"
    echo -e "  ${C_CYAN}[4]${C_RESET} Bulk scan target (use ALL tools in section)"
    echo -e "  ${C_CYAN}[5]${C_RESET} Run single tool on target"
    echo -e "  ${C_CYAN}[6]${C_RESET} Back to main menu"
    echo ""
    read -rp '  > Choice: ' c
    case "$c" in
      1) list_section "$section";;
      2) health_check_section "$section";;
      3) install_missing_section "$section";;
      4) bulk_scan_section "$section";;
      5) single_tool_run "$section";;
      6) return;;
      *) echo -e "  ${C_RED}${MARK_FAIL} Invalid choice.${C_RESET}";;
    esac
  done
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN MENU — Centered Header + Left-Aligned Options
# ═══════════════════════════════════════════════════════════════════════════

main_menu(){
  while true; do
    print_header "PEOPLE OSINT MANAGER v9" "Pastel Kali Linux Theme | System-Wide Install | No venvs"

    echo -e "  ${C_CYAN}── OSINT SECTIONS ──${C_RESET}"
    echo -e "  ${C_CYAN}[1]${C_RESET}  Identity / ID tools"
    echo -e "  ${C_CYAN}[2]${C_RESET}  Email tools"
    echo -e "  ${C_CYAN}[3]${C_RESET}  Username tools"
    echo -e "  ${C_CYAN}[4]${C_RESET}  Phone tools"
    echo -e "  ${C_CYAN}[5]${C_RESET}  General OSINT tools"
    echo ""
    echo -e "  ${C_MAGENTA}── SYSTEM INTEGRATION ──${C_RESET}"
    echo -e "  ${C_MAGENTA}[6]${C_RESET}  System & Network tools"
    echo -e "  ${C_MAGENTA}[7]${C_RESET}  Security & Penetration tools"
    echo -e "  ${C_MAGENTA}[8]${C_RESET}  Forensics tools"
    echo ""
    echo -e "  ${C_YELLOW}── GLOBAL ACTIONS ──${C_RESET}"
    echo -e "  ${C_YELLOW}[9]${C_RESET}   Full Health Check (ALL sections)"
    echo -e "  ${C_YELLOW}[10]${C_RESET}  Install ALL missing tools"
    echo -e "  ${C_YELLOW}[11]${C_RESET}  Check base dependencies"
    echo -e "  ${C_YELLOW}[12]${C_RESET}  List everything"
    echo -e "  ${C_YELLOW}[13]${C_RESET}  Show installed tools"
    echo ""
    echo -e "  ${C_RED}[14]${C_RESET}  Exit"
    echo ""
    read -rp '  > Choose: ' choice
    case "$choice" in
      1) section_menu ID;;
      2) section_menu Email;;
      3) section_menu Username;;
      4) section_menu Phone;;
      5) section_menu General;;
      6) section_menu System;;
      7) section_menu Security;;
      8) section_menu Forensics;;
      9) full_health_check;;
      10) install_all_missing;;
      11) base_check || true;;
      12)
        while IFS= read -r s; do list_section "$s"; done < <(all_sections)
        ;;
      13)
        echo -e "\n  ${C_CYAN}Installed tools:${C_RESET}"
        [[ -f "$INSTALLED_FILE" && -s "$INSTALLED_FILE" ]] && cat "$INSTALLED_FILE" || echo -e "  ${C_DARK}(none)${C_RESET}"
        ;;
      14)
        echo -e "\n  ${C_CYAN}Goodbye!${C_RESET}"
        exit 0
        ;;
      *) echo -e "  ${C_RED}${MARK_FAIL} Invalid choice.${C_RESET}";;
    esac
  done
}