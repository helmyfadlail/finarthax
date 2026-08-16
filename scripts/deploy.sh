#!/usr/bin/env bash
#
# Deploys a commit onto a native Node + systemd server (Path B in DEPLOYMENT.md).
#
# Runs *on the VPS*, as the service user, from the checkout in $APP_DIR. It updates an install that
# already exists - the checkout, the unit and the sealed .env are provisioned once by hand. CI calls
# it over SSH, but it is a normal script - run it by hand for a manual release or a rollback.
#
#   scripts/deploy.sh <git-ref>          # deploy that commit
#   scripts/deploy.sh --rollback-to <sha>
#
# The order matters: build first, restart last. `npm run build` takes a minute or two and the old
# version keeps serving the whole time, so the only visible downtime is the restart itself.
#
# Requires, once, a sudo rule for the service user (see DEPLOYMENT.md):
#   finarthax ALL=(root) NOPASSWD: /bin/systemctl restart finarthax, /bin/systemctl is-active finarthax

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/finarthax/app}"
SERVICE_NAME="${SERVICE_NAME:-finarthax}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
ENV_KEY_FILE="${ENV_KEY_FILE:-/etc/finarthax/env.key}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/finarthax}"
RUN_SEED="${RUN_SEED:-true}"
# What the caller believes about this release: "true", "false" or "unknown". CI works it out from
# the diff between the running commit and the target. It never decides anything here - Prisma does -
# but a disagreement between the two is worth saying out loud.
EXPECT_MIGRATIONS="${EXPECT_MIGRATIONS:-unknown}"

log()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

ROLLBACK_MODE=false
TARGET_REF=""

while [ $# -gt 0 ]; do
  case "$1" in
    --rollback-to) ROLLBACK_MODE=true; TARGET_REF="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) TARGET_REF="$1"; shift ;;
  esac
done

[ -n "$TARGET_REF" ] || die "No ref given. Usage: scripts/deploy.sh <git-ref>"
[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout"

cd "$APP_DIR"

# The sealed .env cannot be opened without this, so every npm/prisma call below needs it in the
# environment. The service itself gets it from its EnvironmentFile.
if [ -z "${ENV_ENCRYPTION_KEY:-}" ] && [ -r "$ENV_KEY_FILE" ]; then
  ENV_ENCRYPTION_KEY="$(cat "$ENV_KEY_FILE")"
  export ENV_ENCRYPTION_KEY
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"

log "Fetching $TARGET_REF from $GIT_REMOTE"
git fetch --prune --tags "$GIT_REMOTE"
TARGET_SHA="$(git rev-parse --verify "${TARGET_REF}^{commit}")" || die "Unknown ref: $TARGET_REF"

info "current:  $PREVIOUS_SHA"
info "deploying: $TARGET_SHA"

if [ "$PREVIOUS_SHA" = "$TARGET_SHA" ]; then
  info "Already at this commit - continuing anyway so a half-finished deploy is completed."
fi

# ── Build the new version ────────────────────────────────────────────────────

build_checkout() {
  local sha="$1"

  log "Checking out $sha"
  git checkout --detach --force "$sha"

  log "Installing dependencies"
  # `npm ci` and not `npm install`: the lockfile is the only thing that makes this deploy the same
  # as the one CI verified. Dev dependencies are needed - next build uses typescript and tailwind.
  npm ci --no-audit --no-fund

  log "Generating the Prisma client"
  npx prisma generate

  log "Building"
  npm run build
}

# ── Database ─────────────────────────────────────────────────────────────────

pending_migrations() {
  # `migrate status` exits non-zero when anything is unapplied; the wording is what tells the two
  # apart, so both are checked.
  local output
  output="$(npx prisma migrate status 2>&1 || true)"
  printf '%s' "$output" | grep -qiE 'not yet been applied|following migrations? have not'
}

backup_database() {
  command -v pg_dump >/dev/null 2>&1 || { warn "pg_dump is not installed - skipping the pre-migration backup"; return 0; }

  local url
  url="$(npx tsx -e 'import "dotenv/config"; import { loadEncryptedEnv } from "./scripts/load-encrypted-env"; loadEncryptedEnv(); process.stdout.write(process.env.DATABASE_URL ?? "")' 2>/dev/null || true)"
  [ -n "$url" ] || { warn "Could not resolve DATABASE_URL - skipping the pre-migration backup"; return 0; }

  mkdir -p "$BACKUP_DIR" 2>/dev/null || { warn "$BACKUP_DIR is not writable - skipping the pre-migration backup"; return 0; }

  BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"

  if pg_dump "$url" | gzip > "$BACKUP_FILE"; then
    info "backup: $BACKUP_FILE"
  else
    rm -f "$BACKUP_FILE"
    BACKUP_FILE=""
    # A migration is the one step a rollback cannot undo, so refusing to go on without a backup is
    # the safer failure.
    die "Database backup failed and this release has migrations to apply. Nothing has changed yet."
  fi
}

BACKUP_FILE=""

# ── Restart and verify ───────────────────────────────────────────────────────

restart_service() {
  log "Restarting $SERVICE_NAME"
  sudo -n systemctl restart "$SERVICE_NAME"
}

# Everything below is best effort and must never fail the caller: this runs when something has
# already gone wrong, and losing the rollback because the diagnosis itself errored would be worse
# than having no diagnosis at all.
diagnose_health() {
  warn "No answer from $HEALTH_URL after ${HEALTH_TIMEOUT}s."

  info "unit:  $(systemctl is-active "$SERVICE_NAME" 2>&1 || true) / $(systemctl is-failed "$SERVICE_NAME" 2>&1 || true)"
  info "port:  $( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -F ':3000' || echo 'nothing is listening on 3000')"

  # A reply at all separates "the app is up and unhealthy" - which curl -f hides behind a bare
  # failure, because /api/health answers 503 when the database is unreachable - from "nothing is
  # listening", which is a different problem with a different fix.
  info "health:"
  curl -sS --max-time 5 -w '\n  → http %{http_code}\n' "$HEALTH_URL" 2>&1 | sed 's/^/  /' || true

  if journalctl -u "$SERVICE_NAME" -n 40 --no-pager >/dev/null 2>&1; then
    info "last 40 journal lines:"
    journalctl -u "$SERVICE_NAME" -n 40 --no-pager 2>&1 | sed 's/^/  /' || true
  else
    info "the journal is not readable as this user - run: sudo journalctl -u $SERVICE_NAME -n 100"
  fi
}

wait_for_health() {
  log "Waiting for $HEALTH_URL"

  local waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      info "healthy after ${waited}s"
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done

  diagnose_health
  return 1
}

rollback() {
  warn "Rolling back to $PREVIOUS_SHA"

  # Best effort by design: if the rollback build also fails there is nothing left to try
  # automatically, and the message below is what the operator needs.
  if build_checkout "$PREVIOUS_SHA" && restart_service && wait_for_health; then
    warn "Rolled back to $PREVIOUS_SHA and the previous version is healthy."
  else
    die "Rollback also failed. Check: journalctl -u $SERVICE_NAME -n 100"
  fi

  if [ -n "$BACKUP_FILE" ]; then
    warn "Migrations from this release are NOT reversed. If the schema is the problem, restore: gunzip -c $BACKUP_FILE | psql \"\$DATABASE_URL\""
  fi

  exit 1
}

# ── Run ──────────────────────────────────────────────────────────────────────

if [ "$ROLLBACK_MODE" = true ]; then
  log "Rollback requested"
  build_checkout "$TARGET_SHA"
  restart_service
  wait_for_health || die "The rolled-back version is not healthy. Check: journalctl -u $SERVICE_NAME -n 100"
  log "Rolled back to $TARGET_SHA"
  exit 0
fi

build_checkout "$TARGET_SHA"

if pending_migrations; then
  if [ "$EXPECT_MIGRATIONS" = "false" ]; then
    warn "This release adds no migration folder, yet Prisma reports one unapplied. Applying it - then check whether a migration was reverted in git or the database is behind by more than this release."
  fi

  log "Applying migrations"
  backup_database
  # `migrate deploy` and never `migrate dev`: it applies committed migrations without prompting and
  # without the reset that `dev` is willing to perform.
  npx prisma migrate deploy || { warn "Migration failed - the old version is still running."; rollback; }
elif [ "$EXPECT_MIGRATIONS" = "true" ]; then
  # Not an error: re-running the same deploy lands here, and so does a migration someone applied by
  # hand. Worth naming, because the alternative reading is that the release never reached the server.
  warn "This release adds a migration, but Prisma reports nothing pending - it is already applied."
else
  info "No pending migrations"
fi

if [ "$RUN_SEED" = "true" ]; then
  log "Syncing the app-settings catalogue"
  # Idempotent: it fills in settings a release added and leaves values edited from the admin screen
  # alone. Also what promotes SUPERADMIN_EMAIL.
  npx prisma db seed || warn "Seeding failed - the app still runs on its built-in defaults."
fi

restart_service
wait_for_health || rollback

log "Deployed $TARGET_SHA"
[ -n "$BACKUP_FILE" ] && info "pre-deploy backup: $BACKUP_FILE"
exit 0
