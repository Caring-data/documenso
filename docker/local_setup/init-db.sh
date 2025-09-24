#!/bin/sh
set -eu

CONTAINER="${CONTAINER:-cd_postgres_local}"
ROLE="${ROLE:-cd_documenso_user}"
ROLE_PW="${ROLE_PW:-cd_documenso_password}"
DB="${DB:-cd_documenso}"
RETRIES=20
SLEEP=2

command -v docker >/dev/null 2>&1 || { echo "docker is not installed"; exit 1; }

# Wait for postgres to be ready
i=0
printf "Waiting for postgres in container %s to be ready..." "$CONTAINER"
while ! docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge "$RETRIES" ]; then
    echo "\nPostgres did not become ready"
    docker logs "$CONTAINER" --tail 200
    exit 2
  fi
  printf "."
  sleep "$SLEEP"
done
echo " ready."

# Create/update role (idempotent)
if docker exec "$CONTAINER" psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE';" | grep -q 1; then
  echo "Role $ROLE exists. Altering password and granting CREATEDB."
  docker exec "$CONTAINER" psql -U postgres -c "ALTER ROLE \"$ROLE\" WITH LOGIN PASSWORD '$ROLE_PW' CREATEDB;"
else
  echo "Creating role $ROLE with CREATEDB."
  docker exec "$CONTAINER" psql -U postgres -c "CREATE ROLE \"$ROLE\" WITH LOGIN PASSWORD '$ROLE_PW' CREATEDB;"
fi

# Create database if it doesn't exist
if docker exec "$CONTAINER" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB';" | grep -q 1; then
  echo "Database $DB already exists."
else
  echo "Creating database $DB owned by $ROLE."
  docker exec "$CONTAINER" psql -U postgres -c "CREATE DATABASE \"$DB\" OWNER \"$ROLE\";"
fi

# Apply extensions and DB settings
echo "Applying extensions and DB settings..."
docker exec "$CONTAINER" psql -U postgres -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker exec "$CONTAINER" psql -U postgres -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
docker exec "$CONTAINER" psql -U postgres -c "ALTER DATABASE \"$DB\" SET timezone TO 'UTC';"
docker exec "$CONTAINER" psql -U postgres -c "ALTER DATABASE \"$DB\" SET log_statement TO 'all';"

echo "Init complete."
