#!/usr/bin/env bash
#
# Deploys a commit onto the VPS (native Node + systemd, Path B in DEPLOYMENT.md).
#
# Runs *on the server*, as the service user, in $APP_DIR. CI calls it over SSH, but it is a normal
# script - run it by hand any time:
#
#   scripts/deploy.sh origin/main     # deploy the latest commit
#   scripts/deploy.sh <sha>           # go back to an older one (this is how you roll back)
#
# Build first, restart last: the old version keeps serving for the couple of minutes the build takes,
# so the only downtime is the restart itself. If the new version does not come up, the script says so
# and stops - it does not rebuild anything behind your back. Going back is one command, printed for
# you at that point.
#
# Requires, once, a sudo rule for the service user (see DEPLOYMENT.md):
#   finarthax ALL=(root) NOPASSWD: /bin/systemctl restart finarthax

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/finarthax/app}"
SERVICE_NAME="${SERVICE_NAME:-finarthax}"
ENV_KEY_FILE="${ENV_KEY_FILE:-/etc/finarthax/env.key}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/finarthax}"
RUN_SEED="${RUN_SEED:-true}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"

log()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

TARGET_REF="${1:-}"
[ -n "$TARGET_REF" ] || die "No ref given. Usage: scripts/deploy.sh <git-ref>"
[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout"

cd "$APP_DIR"

# The sealed .env cannot be opened without this, so every npm/prisma call below needs it. The service
# itself gets it from its EnvironmentFile.
if [ -z "${ENV_ENCRYPTION_KEY:-}" ] && [ -r "$ENV_KEY_FILE" ]; then
  ENV_ENCRYPTION_KEY="$(cat "$ENV_KEY_FILE")"
  export ENV_ENCRYPTION_KEY
fi

# The port comes from the unit, not from a constant here: this machine also hosts other apps, and a
# health check aimed at a port one of them happens to own reports someone else's 404 as our failure.
if [ -z "${PORT:-}" ]; then
  PORT="$(systemctl show "$SERVICE_NAME" -p Environment --value 2>/dev/null | tr ' ' '\n' | sed -n 's/^PORT=//p' | tail -1)"
fi
[ -n "${PORT:-}" ] || die "The $SERVICE_NAME unit does not set PORT. Add 'Environment=PORT=…' to it, or run this with PORT=… in the environment."

HEALTH_URL="http://127.0.0.1:$PORT/api/health"

# ── Build ────────────────────────────────────────────────────────────────────

PREVIOUS_SHA="$(git rev-parse HEAD)"

log "Fetching from origin"
git fetch --prune --tags origin
TARGET_SHA="$(git rev-parse --verify "${TARGET_REF}^{commit}")" || die "Unknown ref: $TARGET_REF"

info "current:   $PREVIOUS_SHA"
info "deploying: $TARGET_SHA"

log "Checking out $TARGET_SHA"
git checkout --detach --force "$TARGET_SHA"

log "Installing dependencies"
# `npm ci`, not `npm install`: the lockfile is what makes this the same build CI verified. Dev
# dependencies are needed - next build uses typescript and tailwind.
npm ci --no-audit --no-fund

log "Generating the Prisma client"
npx prisma generate

log "Building"
npm run build

# ── Database ─────────────────────────────────────────────────────────────────

# `migrate status` exits non-zero when anything is unapplied; the wording is what tells the reasons
# apart, so that is what is matched.
if npx prisma migrate status 2>&1 | grep -qiE 'not yet been applied|following migrations? have not'; then
  log "Applying migrations"

  # A migration is the one step going back to the old commit cannot undo, so it gets a backup first.
  if command -v pg_dump >/dev/null 2>&1; then
    DATABASE_URL="$(npx tsx -e 'import "dotenv/config"; import { loadEncryptedEnv } from "./scripts/load-encrypted-env"; loadEncryptedEnv(); process.stdout.write(process.env.DATABASE_URL ?? "")' 2>/dev/null || true)"
    if [ -n "$DATABASE_URL" ] && mkdir -p "$BACKUP_DIR" 2>/dev/null; then
      BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"
      pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE" || die "Database backup failed and this release has migrations. Nothing has changed yet."
      info "backup: $BACKUP_FILE"
    else
      warn "Could not write a backup - continuing without one."
    fi
  else
    warn "pg_dump is not installed - continuing without a backup."
  fi

  # `migrate deploy` and never `migrate dev`: it applies committed migrations without prompting and
  # without the reset that `dev` is willing to perform.
  npx prisma migrate deploy
else
  info "No pending migrations"
fi

if [ "$RUN_SEED" = "true" ]; then
  log "Syncing the app-settings catalogue"
  # Idempotent: fills in settings a release added, leaves values edited from the admin screen alone.
  # Also what promotes SUPERADMIN_EMAIL.
  npx prisma db seed || warn "Seeding failed - the app still runs on its built-in defaults."
fi

# ── Restart and verify ───────────────────────────────────────────────────────

log "Restarting $SERVICE_NAME"
sudo -n systemctl restart "$SERVICE_NAME"

log "Waiting for $HEALTH_URL"
waited=0
while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    log "Deployed $TARGET_SHA"
    exit 0
  fi
  sleep 3
  waited=$((waited + 3))
done

# Failed. Say what is known and hand over - the new version is running and broken, and which way to
# go from here is a decision, not something to guess at.
warn "No answer from $HEALTH_URL after ${HEALTH_TIMEOUT}s."
info "unit: $(systemctl is-active "$SERVICE_NAME" 2>&1 || true)"
info ""
info "logs:    journalctl -u $SERVICE_NAME -n 100 --no-pager"
info "go back: scripts/deploy.sh $PREVIOUS_SHA"
exit 1
