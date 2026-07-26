#!/bin/bash
# ==============================================================================
# LifeOS Iterative Airlock - Phase 1 Cloud Migration Engine
# Architecture: Sequential Pull -> Extract -> Push -> Scrub
# ==============================================================================

set -euo pipefail

# --- CONFIGURATION & TUNING ---
GOOGLE_COOKIE="NID=531=fbjK5frN9Dj4ZPSlrIkPfXUf9yQ75mXYbVpRUPCVKHOa__yehuAD-90CZr0S94wJyy1a56lCb4c37JWRpGrEnnVJTc2Nz2pOM8thwoASIU9VUAWWBUafW_XmI3sEJrmE1JJH7lCd8TKZzf4SVID9XP7saH_8A0tz5cdVM04O4lh4EwLgmaglZDfhm50Kk8R0Un7ZFhwkZ892oxD6LDWbdj_rvEJFC5AtBYVv-fnkVQCsCsXKnORilGQYAFRCIBlHD49RdOQ0isW3kG9Rrj1X_4ygfCYJBlMxcAjzXml0-WKB6S0AXoGBsUXwsi71GloTdTRi10EM0CJ6CY1Y_RKW96MDiCmwfSy_ArZzd-afXFTHm1ydLq2uEZoBi6NlPomawI1y6Qi5O6ktWTSZIe8ETTmKpBefpccC4Q1cBNPGqa-jyC36vcikstl5KRZL3oZo7A4TBfPyMa2ZS8GhtlT1jx83N77VNIgoe4pTUNNGvDhKpHV6mx84V6qG7AerApBVxEUObXub7xJpYmw-rdALaRGEsvDMgtelXLiT1NuBB2YQACOW4KYBmx7ggbPqhpFkxnIJxcP2I-F-Ggain0--i72vLIH7shHOWPNVz_EsaErJ3Pu1uTILDzPzAZ7N0skO8BAG1Nt21s0sLpfb1DeRRuL-I0hO6WKURSUiByJlWdc-aTW5AA; SID=g.a000-gi4nRMJcRYwmwVDORx70YUO_wwrb8dSZX3ocEajO5anllTNXzlWqj67G0HdzEiSYJcxxgACgYKAe8SARcSFQHGX2Mi3_AbfvRWKR94HGm-InHWMxoVAUF8yKpQ_G4Sswz6hRAlGd87oR4a0076; __Secure-1PSID=g.a000-gi4nRMJcRYwmwVDORx70YUO_wwrb8dSZX3ocEajO5anllTN-bx4aMJGW1uTgciIpzAMJAACgYKATASARcSFQHGX2MilldofAMduJhE0nepuMU5OBoVAUF8yKo9bt2kyrliLL0nQHCRng430076; __Secure-3PSID=g.a000-gi4nRMJcRYwmwVDORx70YUO_wwrb8dSZX3ocEajO5anllTNcdA7m8zppwP7rLNMTavSrwACgYKASQSARcSFQHGX2MieTEoFK2aDrcirITgDBN6NBoVAUF8yKqWpHPvVNc_756pgO6EGJUF0076; HSID=AR-dIO8aDvCbNJq7-; SSID=ACJOh8H7eXyn1B5zz; APISID=IqtGf9F7fqo2GVJV/AxbRtuRXEOfn0uZsA; SAPISID=sEKsvGIPrVwI8bvz/A7GKm5PsiOIGSXVyA; __Secure-1PAPISID=sEKsvGIPrVwI8bvz/A7GKm5PsiOIGSXVyA; __Secure-3PAPISID=sEKsvGIPrVwI8bvz/A7GKm5PsiOIGSXVyA; OTZ=8627327_72_76_104100_72_446760; __Secure-1PSIDTS=sidts-CjEBhkeRd-bVHbXxZGXDWmjuaPaQf2H7a1_niyY2eDJUdObRegZ20sd0YYg_0y-0ekzqEAA; __Secure-3PSIDTS=sidts-CjEBhkeRd-bVHbXxZGXDWmjuaPaQf2H7a1_niyY2eDJUdObRegZ20sd0YYg_0y-0ekzqEAA; OSID=g.a000-Qi4nZHg2eICOr-CDM7tB6WRXCJ2PpV3GOe0G01EUFgrrOqvGeU2QOepVPjtetnvjbte_gACgYKAU8SARcSFQHGX2MiXHQQhWCs2fS_9pn-bCWLNRoVAUF8yKqmDPo9t4J14rUgDxot3Ea70076; __Secure-OSID=g.a000-Qi4nZHg2eICOr-CDM7tB6WRXCJ2PpV3GOe0G01EUFgrrOqvdTWdNXmhWdWTOMCSZHuHyQACgYKAZMSARcSFQHGX2Mi2ne0POWKBogi03Rhs42ayhoVAUF8yKpJCJrjRnUbAjIArgRKrZjM0076; SIDCC=AKEyXzU9DCfusqI4CMsVzk8ZE4A31Z_ipgXm9KsXVjqI3hQFfJMqKlo3-cetfZe8oN79e1EwYg; __Secure-1PSIDCC=AKEyXzUadUSgbaCrQilqD1jIc7eRmNKw13BrB5m7zyZq-PjP52yrbJw-eedEJO-QTof5JwEH; __Secure-3PSIDCC=AKEyXzWpRtt3be0An9afGwggukDFtW7lgVNPfWsAUqTzENxRYKpykEhPfix9ReoqDd7vhAgxBQ"

# ARIA_THREADS: Number of concurrent connections per server. 
# Recommended: 16 for Google CDN (maximizes throughput without triggering abuse blocks).
ARIA_THREADS=16

# ARIA_MAX_SPEED: Bandwidth limit for the download.
# Recommended: e.g., "800M", "500M", or "0" for unlimited. 
# Tune this based on your Droplet's network capacity to avoid saturating the link.
ARIA_MAX_SPEED="0"

# B2_THREADS: Concurrent upload threads for Backblaze B2.
# Recommended: 8-12 is a safe, balanced default for most VPS CPU/Memory limits.
B2_THREADS=10

TARGET_PREFIX="LifeOS_Takeout"  # Prefix folder in the B2 bucket
B2_BUCKET="b2://raw_ingest"
STAGING_DIR="/staging_unpacked"
TMP_DL="/tmp_download"
LOGFILE="$(pwd)/airlock.log"

# --- COLORS ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${CYAN}${msg}${NC}"
    echo "$msg" >> "$LOGFILE"
}

warn() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] [WARNING] $1"
    echo -e "${YELLOW}${msg}${NC}"
    echo "$msg" >> "$LOGFILE"
}

error() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}${msg}${NC}"
    echo "$msg" >> "$LOGFILE"
}

success() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
    echo -e "${GREEN}${msg}${NC}"
    echo "$msg" >> "$LOGFILE"
}

# --- DEFENSIVE CLEANUP TRAP ---
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Script interrupted or failed with exit code $exit_code. Executing emergency cleanup..."
    fi
    # Only clean up staging and tmp files, do not touch the logs or B2 contents
    log "Purging temporary buffers to maintain NVMe integrity..."
    rm -f "$TMP_DL/takeout_payload.zip" || true
    rm -rf "$STAGING_DIR" || true
    if [ $exit_code -ne 0 ]; then
        error "Airlock process halted prematurely."
    else
        success "Airlock pipeline gracefully closed."
    fi
    exit $exit_code
}
trap cleanup EXIT ERR SIGINT SIGTERM

# --- DISK USAGE CHECK ---
check_disk_space() {
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -ge 80 ]; then
        warn "Disk usage is critically high at ${usage}%."
        read -p "Press Enter to acknowledge and continue, or Ctrl+C to abort..."
    else
        log "Disk usage is healthy at ${usage}%."
    fi
}

# --- INITIALIZATION ---
echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}      LIFEOS AIRLOCK INITIATED - PHASE 1 CLOUD INGESTION         ${NC}"
echo -e "${CYAN}=================================================================${NC}"

mkdir -p "$STAGING_DIR"
mkdir -p "$TMP_DL"
touch "$LOGFILE"

# Make sure b2 is authorized
if ! command -v b2 &> /dev/null; then
    error "Backblaze B2 CLI is not installed or not in PATH."
    exit 1
fi

read -p "Paste the base Google Takeout CDN URL (File 001): " BASE_URL

# Robust URL parsing supporting both Legacy and New Google Takeout URL structures
if [[ "$BASE_URL" == *"takeout-download.usercontent.google.com"* ]]; then
    # Legacy Format
    JOB_ID=$(echo "$BASE_URL" | grep -o 'j=[^&]*' | head -1)
    USER_PARAM=$(echo "$BASE_URL" | grep -o 'user=[^&]*' | head -1)
    AUTH_PARAM=$(echo "$BASE_URL" | grep -o 'authuser=[^&]*' | head -1)
    BASE_PREFIX=$(echo "$BASE_URL" | sed -E 's/(.*-)[0-9]{3}\.zip.*/\1/')
    URL_FORMAT="OLD"
elif [[ "$BASE_URL" == *"takeout.google.com/takeout/download"* ]]; then
    # New Format
    BASE_PATH="https://takeout.google.com/takeout/download"
    JOB_ID=$(echo "$BASE_URL" | grep -o 'j=[^&]*' | head -1)
    USER_PARAM=$(echo "$BASE_URL" | grep -o 'user=[^&]*' | head -1)
    RAPT_PARAM=$(echo "$BASE_URL" | grep -o 'rapt=[^&]*' | head -1)
    URL_FORMAT="NEW"
else
    error "Unrecognized Takeout URL format. Please provide a valid Takeout URL."
    exit 1
fi

if [ -z "$JOB_ID" ] || [ -z "$USER_PARAM" ]; then
    error "Failed to parse base URL parameters (missing Job ID or User ID)."
    exit 1
fi

TOTAL_FILES=14

for N in $(seq 1 $TOTAL_FILES); do
    PADDED_N=$(printf "%03d" $N)
    I_INDEX=$((N - 1))
    
    # Construct dynamic URL based on format
    if [ "$URL_FORMAT" == "OLD" ]; then
        # Handled the double-hyphen by joining directly
        DYNAMIC_URL="${BASE_PREFIX}${PADDED_N}.zip?${JOB_ID}&i=${I_INDEX}&${USER_PARAM}&${AUTH_PARAM}"
    else
        DYNAMIC_URL="${BASE_PATH}?${JOB_ID}&i=${I_INDEX}&${USER_PARAM}&${RAPT_PARAM}"
    fi
    
    echo -e "\n${CYAN}=================================================================${NC}"
    log "Processing File $N of $TOTAL_FILES: -${PADDED_N}.zip"
    echo -e "${CYAN}=================================================================${NC}"
    
    check_disk_space

    # 1. HTTP 403 Kill Switch
    log "Checking Google CDN token validity..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $GOOGLE_COOKIE" -I "$DYNAMIC_URL")
    if [ "$HTTP_CODE" == "403" ]; then
        error "Google Takeout token has expired (HTTP 403). Cannot proceed with File $N. HALTING."
        exit 1
    elif [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ]; then
        warn "Received HTTP $HTTP_CODE from CDN. Attempting to proceed, but expect potential aria2c failure."
    else
        success "CDN Token Valid (HTTP $HTTP_CODE)."
    fi

    # 2. Download Payload
    log "Stage 1: PULL - Downloading payload with aria2c (${ARIA_THREADS} threads)..."
    if ! aria2c -x "$ARIA_THREADS" -s "$ARIA_THREADS" -k 100M \
        --header="Cookie: $GOOGLE_COOKIE" \
        --max-download-limit="$ARIA_MAX_SPEED" \
        --continue=true --timeout=60 --max-tries=3 --retry-wait=15 --summary-interval=5 \
        -d "$TMP_DL" -o "takeout_payload.zip" \
        "$DYNAMIC_URL" 2>&1 | tee -a "$LOGFILE"; then
        error "aria2c encountered a critical failure. HALTING."
        exit 1
    fi

    if [ ! -f "$TMP_DL/takeout_payload.zip" ]; then
        error "Download failed: File not found on disk. HALTING."
        exit 1
    fi

    FILE_SIZE=$(stat -c%s "$TMP_DL/takeout_payload.zip" 2>/dev/null || stat -f%z "$TMP_DL/takeout_payload.zip" || echo 0)
    if [ "$FILE_SIZE" -lt 104857600 ]; then # 100MB
        error "Download failed: File is smaller than 100MB (${FILE_SIZE} bytes). Likely an auth error body. HALTING."
        exit 1
    fi
    success "Download verified (${FILE_SIZE} bytes)."

    # 3. Extract Payload
    log "Stage 2: EXTRACT - Unpacking archive to NVMe buffer..."
    # Ensure STAGING_DIR is clean before extraction
    rm -rf "$STAGING_DIR"
    mkdir -p "$STAGING_DIR"

    if ! unzip -q "$TMP_DL/takeout_payload.zip" -d "$STAGING_DIR" 2>&1 | tee -a "$LOGFILE"; then
        error "Extraction failed or archive is corrupted. HALTING."
        exit 1
    fi
    success "Extraction complete."

    # Scrub original zip to maintain NVMe buffer space
    log "Scrubbing source ZIP to free NVMe capacity..."
    rm -f "$TMP_DL/takeout_payload.zip"

    # 4. Push to Backblaze B2
    log "Stage 3: PUSH - Starting B2 upload of extracted contents to raw_ingest/... (${B2_THREADS} threads)"
    if ! b2 sync --threads "$B2_THREADS" --progress --replaceNewer "$STAGING_DIR/" "${B2_BUCKET}/${TARGET_PREFIX}/" 2>&1 | tee -a "$LOGFILE"; then
        error "B2 Sync encountered a critical error. Halting pipeline to prevent data loss. HALTING."
        exit 1
    fi
    success "Upload complete: Extracted files transferred."

    # 5. Scrub
    log "Stage 4: SCRUB - Executing nuke-and-pave of staging environment..."
    rm -rf "$STAGING_DIR"
    mkdir -p "$STAGING_DIR"
    
    success "Cycle $N complete. Buffer cleared."
done

echo -e "\n${GREEN}=================================================================${NC}"
echo -e "${GREEN}[MISSION CONTROL] All 14 Takeout files successfully processed and synced!${NC}"
echo -e "${GREEN}=================================================================${NC}\n"

# Trap will run success cleanup upon normal exit.
