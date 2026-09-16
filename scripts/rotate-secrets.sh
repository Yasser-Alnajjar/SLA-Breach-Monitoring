#!/usr/bin/env sh
# Generates new values for the secrets in a production env file, in place:
# POSTGRES_PASSWORD (and the password inside DATABASE_URL), NEXTAUTH_SECRET,
# INTEGRATION_CONFIG_ENCRYPTION_KEY, and SMTP_ENCRYPTION_KEY. See "Rotating
# secrets" in docs/deployment.md. New values are never printed.
#
# Usage: scripts/rotate-secrets.sh [--apply-to-db] [--yes] [ENV_FILE]
#
#   ENV_FILE       env file to rewrite                          (.env.prod)
#   --apply-to-db  also run ALTER USER in the running `postgres` container,
#                  for a database whose volume already exists (Postgres only
#                  reads POSTGRES_PASSWORD when it first creates the volume)
#   --yes          skip the confirmation prompt
#
# Environment (optional):
#   COMPOSE_FILE   compose file with the `postgres` service   (docker-compose.prod.yml)
#
# Rotating the two encryption keys makes every saved integration OAuth
# secret and SMTP password in the database unreadable. Each organization then
# has to re-enter them. Third-party credentials (OPS_ALERT_SMTP_PASSWORD,
# OAuth apps, webhooks) can't be generated here: revoke and replace those
# with their provider.
set -eu

cd "$(dirname "$0")/.."

ENV_FILE=".env.prod"
APPLY_TO_DB=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --apply-to-db) APPLY_TO_DB=1 ;;
    --yes) ASSUME_YES=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) ENV_FILE="$arg" ;;
  esac
done
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "No such env file: $ENV_FILE" >&2
  exit 1
fi

for key in POSTGRES_PASSWORD DATABASE_URL NEXTAUTH_SECRET INTEGRATION_CONFIG_ENCRYPTION_KEY SMTP_ENCRYPTION_KEY; do
  if ! grep -q "^$key=" "$ENV_FILE"; then
    echo "$ENV_FILE has no $key= line" >&2
    exit 1
  fi
done

read_var() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

POSTGRES_USER_VALUE="$(read_var POSTGRES_USER)"
POSTGRES_DB_VALUE="$(read_var POSTGRES_DB)"

if [ "$ASSUME_YES" -ne 1 ]; then
  echo "This replaces POSTGRES_PASSWORD, DATABASE_URL's password, NEXTAUTH_SECRET,"
  echo "INTEGRATION_CONFIG_ENCRYPTION_KEY, and SMTP_ENCRYPTION_KEY in $ENV_FILE."
  echo "Existing sessions are signed out, and saved integration secrets and SMTP"
  echo "passwords become unreadable."
  printf 'Type "rotate" to continue: '
  read -r answer
  if [ "$answer" != "rotate" ]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

umask 077
# Hex keeps the password safe inside DATABASE_URL and SQL without escaping.
NEW_POSTGRES_PASSWORD="$(openssl rand -hex 24)"
NEW_NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEW_INTEGRATION_CONFIG_ENCRYPTION_KEY="$(openssl rand -base64 32)"
NEW_SMTP_ENCRYPTION_KEY="$(openssl rand -base64 32)"

if [ "$APPLY_TO_DB" -eq 1 ]; then
  if [ -z "$POSTGRES_USER_VALUE" ] || [ -z "$POSTGRES_DB_VALUE" ]; then
    echo "--apply-to-db needs POSTGRES_USER and POSTGRES_DB in $ENV_FILE" >&2
    exit 1
  fi
  # The SQL goes over stdin, so the password never appears in a process list.
  # Runs before the file is rewritten: if it fails, nothing has changed.
  printf 'ALTER USER "%s" WITH PASSWORD '"'"'%s'"'"';\n' "$POSTGRES_USER_VALUE" "$NEW_POSTGRES_PASSWORD" |
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
      psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" >/dev/null
  echo "Updated the database user's password."
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="$ENV_FILE.before-rotate-$stamp"
cp -p "$ENV_FILE" "$backup"
chmod 600 "$backup"

tmp="$ENV_FILE.rotating"
trap 'rm -f "$tmp"' EXIT

# Values go through the environment, not awk -v, so base64's `/` and `+` and
# any backslashes are taken literally.
NEW_POSTGRES_PASSWORD="$NEW_POSTGRES_PASSWORD" \
NEW_NEXTAUTH_SECRET="$NEW_NEXTAUTH_SECRET" \
NEW_INTEGRATION_CONFIG_ENCRYPTION_KEY="$NEW_INTEGRATION_CONFIG_ENCRYPTION_KEY" \
NEW_SMTP_ENCRYPTION_KEY="$NEW_SMTP_ENCRYPTION_KEY" \
awk '
  /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" ENVIRON["NEW_POSTGRES_PASSWORD"]; next }
  /^NEXTAUTH_SECRET=/ { print "NEXTAUTH_SECRET=" ENVIRON["NEW_NEXTAUTH_SECRET"]; next }
  /^INTEGRATION_CONFIG_ENCRYPTION_KEY=/ { print "INTEGRATION_CONFIG_ENCRYPTION_KEY=" ENVIRON["NEW_INTEGRATION_CONFIG_ENCRYPTION_KEY"]; next }
  /^SMTP_ENCRYPTION_KEY=/ { print "SMTP_ENCRYPTION_KEY=" ENVIRON["NEW_SMTP_ENCRYPTION_KEY"]; next }
  /^DATABASE_URL=/ {
    line = $0
    at = index(line, "@")
    scheme_end = index(line, "://")
    if (at == 0 || scheme_end == 0) { print "DATABASE_URL has no user:password@ part" > "/dev/stderr"; exit 3 }
    userinfo = substr(line, scheme_end + 3, at - scheme_end - 3)
    colon = index(userinfo, ":")
    user = colon ? substr(userinfo, 1, colon - 1) : userinfo
    print substr(line, 1, scheme_end + 2) user ":" ENVIRON["NEW_POSTGRES_PASSWORD"] substr(line, at)
    next
  }
  { print }
' "$ENV_FILE" > "$tmp"

chmod 600 "$tmp"
mv "$tmp" "$ENV_FILE"
trap - EXIT

echo "Rotated secrets in $ENV_FILE (previous file saved as $backup; delete it once the stack is healthy)."
if [ "$APPLY_TO_DB" -ne 1 ]; then
  echo "If the postgres volume already exists, the database still has the old password."
  echo "Re-run with --apply-to-db (it rotates again and updates the database too)."
fi
echo "Next: restart the stack so web and worker pick up the new values:"
echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
