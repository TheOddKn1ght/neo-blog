#!/usr/bin/env bash
# Experimental Debian/Ubuntu deployment. Inspection is the default; no Docker.
set -euo pipefail

APP_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
APPLY=false
DOMAIN=
APP_USER=${SUDO_USER:-$(id -un)}
WEB_ROOT=/var/www/neo-blog
MESSAGE_UPSTREAM=
BUN_VERSION=1.4.2
BUN_BIN=
TLS_CERT=
TLS_KEY=
SITE=/etc/nginx/sites-available/neo-blog
ENABLED=/etc/nginx/sites-enabled/neo-blog

usage() {
  cat <<'HELP'
Usage: bash scripts/setup-experimental.sh --domain blog.example.com [options]

  --check                 Inspect only (default; no writes or downloads)
  --apply                 Install missing tools, build, publish static files and reload Nginx
  --user NAME             Existing non-root account that owns the checkout
  --app-dir PATH          Existing checkout (defaults to this script's parent)
  --web-root PATH         Managed release directory (default: /var/www/neo-blog)
  --message-upstream URL  Optional existing HTTP(S) backend for /message
  --bun-version VERSION   Exact Bun version to install/reuse (default: 1.4.2)
  --bun-bin PATH          Existing Bun binary; otherwise USER_HOME/.bun/bin/bun
  --tls-cert PATH         Existing PEM certificate/full chain (enables HTTPS)
  --tls-key PATH          Matching existing PEM private key
  -h, --help              Show this help

Run on Debian/Ubuntu with systemd. Run inspection via sudo to read system config.
Existing matching configs are reused; differing configs stop setup unchanged.
No cloning, user creation, DNS/firewall changes, or certificate issuance.
Bun is used only to install dependencies and build. Nginx serves static files.
No application service or environment file is created. /message returns 503 unless
--message-upstream is supplied. HTTPS uses existing certificates; no issuance.
HELP
}
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*"; }
value() { [[ $# -ge 2 && -n $2 && $2 != --* ]] || fail "Missing value for $1"; }
while (($#)); do
  case "$1" in
    --check) APPLY=false; shift ;;
    --apply) APPLY=true; shift ;;
    --domain) value "$@"; DOMAIN=$2; shift 2 ;;
    --user) value "$@"; APP_USER=$2; shift 2 ;;
    --app-dir) value "$@"; APP_DIR=$2; shift 2 ;;
    --web-root) value "$@"; WEB_ROOT=$2; shift 2 ;;
    --message-upstream) value "$@"; MESSAGE_UPSTREAM=$2; shift 2 ;;
    --bun-version) value "$@"; BUN_VERSION=$2; shift 2 ;;
    --bun-bin) value "$@"; BUN_BIN=$2; shift 2 ;;
    --tls-cert) value "$@"; TLS_CERT=$2; shift 2 ;;
    --tls-key) value "$@"; TLS_KEY=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ $DOMAIN =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && $DOMAIN == *.* && $DOMAIN != *..* ]] || fail 'Supply a lowercase DNS name with --domain.'
[[ $APP_USER =~ ^[a-z_][a-z0-9_-]*$ && $APP_USER != root ]] || fail 'Supply an existing non-root account with --user.'
[[ -z $MESSAGE_UPSTREAM || $MESSAGE_UPSTREAM =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$ ]] || fail 'Message upstream must be an HTTP(S) origin without credentials, a path, or query.' 
[[ $BUN_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Invalid Bun version.'
[[ $(uname -s) == Linux && -r /etc/os-release ]] || fail 'This experimental installer supports Debian/Ubuntu Linux only.'
# /etc/os-release is trusted operating-system metadata, never application config.
. /etc/os-release
[[ ${ID:-} == debian || ${ID:-} == ubuntu ]] || fail 'Only Debian and Ubuntu are supported.'
[[ -d /run/systemd/system ]] || fail 'systemd must be running.'
id "$APP_USER" >/dev/null 2>&1 || fail "Account does not exist: $APP_USER"
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
[[ -n $BUN_BIN ]] || BUN_BIN=$APP_HOME/.bun/bin/bun
APP_DIR=$(cd -- "$APP_DIR" && pwd -P)
WEB_ROOT=$(realpath -m -- "$WEB_ROOT")
# Restrict paths so they can be used literally in Nginx config.
for path in "$APP_DIR" "$BUN_BIN" "$WEB_ROOT" "$TLS_CERT" "$TLS_KEY"; do
  [[ -z $path || $path =~ ^/[a-zA-Z0-9_./-]+$ ]] || fail "Unsupported path (use an absolute path without spaces): $path"
done
for file in package.json bun.lock build.ts; do
  [[ -f $APP_DIR/$file ]] || fail "Not a complete checkout: missing $file"
done
[[ -z $TLS_CERT && -z $TLS_KEY || -n $TLS_CERT && -n $TLS_KEY ]] || fail 'Supply both TLS paths.'
if [[ -n $TLS_CERT ]]; then
  [[ -r $TLS_CERT && -r $TLS_KEY ]] || fail 'Cannot read the TLS certificate/key; inspect with sudo.'
fi
if $APPLY; then
  ((EUID == 0)) || fail 'Use sudo with --apply.'
  exec 9>/run/lock/neo-blog-setup.lock
  flock -n 9 || fail 'Another setup is running.'
fi

render_static() {
  cat <<STATIC
    root $WEB_ROOT/current;
    index index.html;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options DENY always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Cache-Control "no-cache" always;
    location /content/ { try_files \$uri =404; }
    location ~ /\\. { deny all; }
    location ~* \\.[a-z0-9]+$ { try_files \$uri =404; }
    location / { try_files \$uri \$uri/ /index.html; }
    location = /message {
STATIC
  if [[ -n $MESSAGE_UPSTREAM ]]; then
    cat <<UPSTREAM
        proxy_pass $MESSAGE_UPSTREAM;
        proxy_ssl_server_name on;
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_set_header Host \$proxy_host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
UPSTREAM
  else
    cat <<'UNAVAILABLE'
        default_type application/json;
        return 503 '{"error":"Messaging is unavailable on this static deployment"}';
UNAVAILABLE
  fi
  printf '    }\n'
}
render_marker() { printf 'neo-blog-static-v1\n%s\n%s\n' "$DOMAIN" "$APP_DIR"; }
render_site() {
  printf '# Managed by neo-blog experimental setup\nserver {\n    listen 80;\n    server_name %s;\n' "$DOMAIN"
  if [[ -n $TLS_CERT ]]; then
    printf '    return 301 https://%s$request_uri;\n}\nserver {\n    listen 443 ssl;\n    server_name %s;\n' "$DOMAIN" "$DOMAIN"
    printf '    ssl_certificate %s;\n    ssl_certificate_key %s;\n    ssl_protocols TLSv1.2 TLSv1.3;\n' "$TLS_CERT" "$TLS_KEY"
  fi
  render_static
  printf '}\n'
}
check_config() {
  local path=$1 renderer=$2
  [[ ! -L $path ]] || fail "Refusing symlink config: $path"
  if [[ -e $path ]]; then
    [[ -f $path && -r $path ]] || fail "Cannot inspect config: $path"
    if cmp -s "$path" <("$renderer"); then
      log "REUSE matching configuration: $path"
    else
      fail "Existing configuration differs: $path. Preserved; reconcile it manually or select matching options."
    fi
  else
    log "CREATE missing configuration: $path"
  fi
}

log "Inspecting $APP_DIR for $DOMAIN (build user=$APP_USER, static root=$WEB_ROOT)"
# Refuse to take over existing files that this script did not publish.
[[ ! -L $WEB_ROOT ]] || fail 'Web root must not be a symlink.'
if [[ -e $WEB_ROOT ]]; then
  [[ -d $WEB_ROOT && -f $WEB_ROOT/.neo-blog-static && ! -L $WEB_ROOT/.neo-blog-static ]] || fail 'Existing web root is unmanaged; choose an empty --web-root path.'
  cmp -s "$WEB_ROOT/.neo-blog-static" <(render_marker) || fail 'Web root belongs to another deployment; preserved.'
  [[ -d $WEB_ROOT/releases && ! -L $WEB_ROOT/releases ]] || fail 'Invalid release directory; preserved.'
  if [[ -e $WEB_ROOT/current || -L $WEB_ROOT/current ]]; then
    [[ -L $WEB_ROOT/current && -d $WEB_ROOT/current ]] || fail 'Existing current path is not a valid release link.'
    case $(readlink -f "$WEB_ROOT/current") in
      "$WEB_ROOT/releases/"*) ;; *) fail 'Current link points outside managed releases.' ;;
    esac
  fi
  log "REUSE managed release directory: $WEB_ROOT"
else
  log "CREATE managed release directory: $WEB_ROOT"
fi
check_config "$SITE" render_site
if systemctl is-active --quiet neo-blog.service; then
  fail 'Legacy neo-blog.service is running. Stop/disable it manually before migrating; it was not changed.'
fi
[[ ! -e /etc/neo-blog.env ]] || log 'Existing /etc/neo-blog.env is unused by static hosting and will be preserved.'
if [[ -L $ENABLED ]]; then
  [[ $(readlink -f "$ENABLED") == "$SITE" ]] || fail "Conflicting enabled site: $ENABLED"
elif [[ -e $ENABLED ]]; then
  fail "Existing enabled site is not the expected symlink: $ENABLED"
fi
# Catch an already-configured domain, even under a different site filename.
for config in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
  [[ -f $config ]] || continue
  [[ $(readlink -f "$config") != "$SITE" ]] || continue
  if awk -v domain="$DOMAIN" '{ sub(/#.*/, ""); gsub(/;/, " "); for (i=1;i<=NF;i++) if ($i==domain) found=1 } END { exit !found }' "$config"; then
    fail "Domain already appears in $config; existing site preserved."
  fi
done
if [[ -e $BUN_BIN ]]; then
  [[ -x $BUN_BIN ]] || fail "Bun is not executable: $BUN_BIN"
  [[ $("$BUN_BIN" --version) == "$BUN_VERSION" ]] || fail 'Existing Bun version differs; select it with --bun-version or use another --bun-bin. No upgrade performed.'
  log "REUSE Bun $BUN_VERSION: $BUN_BIN"
else
  [[ $BUN_BIN == "$APP_HOME/.bun/bin/bun" ]] || fail '--bun-bin must point to an existing executable.'
  log "INSTALL Bun $BUN_VERSION for $APP_USER"
fi
if command -v nginx >/dev/null; then
  nginx -t || fail 'Existing Nginx configuration is invalid or unreadable; inspect with sudo.'
else
  log 'INSTALL Nginx and required system packages'
fi
if ! $APPLY; then
  log 'Inspection complete. Nothing changed. Rerun with the same options and --apply to install.'
  exit 0
fi

# Run all package installation and builds as the checkout owner, never as root.
runuser -u "$APP_USER" -- test -w "$APP_DIR" || fail "Checkout is not writable by $APP_USER; ownership was not changed."
missing_packages=()
for package in ca-certificates curl unzip nginx rsync; do
  installed=$(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true)
  [[ $installed == 'install ok installed' ]] || missing_packages+=("$package")
done
if ((${#missing_packages[@]})); then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing_packages[@]}"
fi
if [[ ! -x $BUN_BIN ]]; then
  installer=$(mktemp /tmp/neo-blog-bun.XXXXXX)
  trap 'rm -f -- "${installer:-}"' EXIT
  curl --fail --silent --show-error --location https://bun.com/install -o "$installer"
  chmod 644 "$installer"
  runuser -u "$APP_USER" -- env BUN_INSTALL="$APP_HOME/.bun" bash "$installer" "bun-v$BUN_VERSION"
  rm -f -- "$installer"
  trap - EXIT
fi
[[ $("$BUN_BIN" --version) == "$BUN_VERSION" ]] || fail 'Unexpected Bun version after installation.'
(
  cd -- "$APP_DIR"
  runuser -u "$APP_USER" -- "$BUN_BIN" install --frozen-lockfile
  runuser -u "$APP_USER" -- env PATH="$(dirname -- "$BUN_BIN"):$PATH" "$BUN_BIN" run build
)
# Publish a separate release; a failed build never changes the currently served files.
[[ -f $APP_DIR/dist/index.html ]] || fail 'Build did not produce dist/index.html.'
check_config "$SITE" render_site
if [[ ! -e $WEB_ROOT ]]; then
  install -d -m 755 "$WEB_ROOT" "$WEB_ROOT/releases"
  (umask 022; set -o noclobber; render_marker > "$WEB_ROOT/.neo-blog-static")
fi
release=$(mktemp -d "$WEB_ROOT/releases/release.XXXXXXXX")
chmod 755 "$release"
rsync -rtp --chmod=D755,F644 "$APP_DIR/dist/" "$release/"
[[ -f $release/index.html && ! -L $release/index.html ]] || fail 'Release is missing index.html.'
[[ -e $SITE ]] || (umask 022; set -o noclobber; render_site > "$SITE")
[[ -L $ENABLED ]] || ln -s "$SITE" "$ENABLED"
nginx -t || fail 'Nginx validation failed; existing release remains selected and Nginx was not reloaded.'
previous=$(readlink "$WEB_ROOT/current" 2>/dev/null || true)
# Same-filesystem rename switches the complete release atomically.
link=$WEB_ROOT/.current.$$
ln -s "$release" "$link"
mv -Tf "$link" "$WEB_ROOT/current"
rollback_release() {
  if [[ -n $previous ]]; then
    ln -s "$previous" "$link"
    mv -Tf "$link" "$WEB_ROOT/current"
  else
    rm -f "$WEB_ROOT/current"
  fi
}
if ! systemctl enable --now nginx || ! systemctl reload nginx; then
  rollback_release
  fail 'Nginx start/reload failed; release selection rolled back. Inspect systemctl status nginx.'
fi
healthy=false
if [[ -n $TLS_CERT ]]; then
  curl --fail --silent --show-error --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" -o /dev/null && healthy=true
else
  curl --fail --silent --show-error --max-time 10 -H "Host: $DOMAIN" http://127.0.0.1/ -o /dev/null && healthy=true
fi
if ! $healthy; then
  rollback_release
  fail 'Nginx HTTP check failed; release selection rolled back. Configuration is retained for inspection.'
fi
log "Static deployment complete: $release. Nginx serves files directly; no Bun server is running."
log 'Previous releases are retained for manual rollback/cleanup. Certificate renewals, DNS and firewall rules are managed separately.'
