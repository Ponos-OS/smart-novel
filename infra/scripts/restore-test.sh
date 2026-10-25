#!/bin/sh
# Restore test for a project's Postgres backup, with the commands its backup job runs:
# pg_dump (custom format) -> aws s3 cp to daily/<project>/<database>/<stamp>.dump -> download -> pg_restore into a scratch database.
# Needs Docker. Everything it starts is removed on exit.
#
# Usage: restore-test.sh
# Settings (environment): POSTGRES_IMAGE, PROJECT, DATABASE, AWS_CLI_IMAGE, S3_IMAGE
set -eu

POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:18.2-bookworm}"
PROJECT="${PROJECT:-smart-novel}"
DATABASE="${DATABASE:-smart_novel}"
AWS_CLI_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:2.38.1}"
S3_IMAGE="${S3_IMAGE:-minio/minio:RELEASE.2025-04-08T15-41-24Z}"

id="restore-test-$$"
bucket="backups"
password="3c9a1f0e7b2d4a68"
s3_key="restoretestkey"
s3_secret="restoretestsecret0123"
work="$(mktemp -d)"
chmod 777 "$work"

cleanup() {
  docker rm -f "$id-pg" "$id-s3" > /dev/null 2>&1 || true
  docker network rm "$id" > /dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT

aws() {
  docker run --rm --network "$id" -v "$work:/work" \
    -e AWS_ACCESS_KEY_ID="$s3_key" -e AWS_SECRET_ACCESS_KEY="$s3_secret" -e AWS_DEFAULT_REGION=us-east-1 \
    "$AWS_CLI_IMAGE" "$@" --endpoint-url "http://$id-s3:9000"
}

psql_in() {
  docker exec -e PGPASSWORD="$password" "$id-pg" psql -U postgres -d "$1" -Atq -v ON_ERROR_STOP=1 -c "$2"
}

docker network create "$id" > /dev/null
docker run -d --name "$id-pg" --network "$id" -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB="$DATABASE" "$POSTGRES_IMAGE" > /dev/null
docker run -d --name "$id-s3" --network "$id" -e MINIO_ROOT_USER="$s3_key" -e MINIO_ROOT_PASSWORD="$s3_secret" "$S3_IMAGE" server /data > /dev/null

echo "Waiting for PostgreSQL and the S3 server"
i=0
until psql_in "$DATABASE" "select 1" > /dev/null 2>&1 && aws s3 ls > /dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || { echo "Timed out waiting for the containers" >&2; exit 1; }
  sleep 2
done
aws s3 mb "s3://$bucket" > /dev/null

echo "Seeding $DATABASE"
psql_in "$DATABASE" "
  create table authors (id int primary key, name text not null);
  create table items (
    id int primary key,
    author_id int not null references authors (id),
    title text not null,
    body jsonb not null,
    tsv tsvector generated always as (to_tsvector('english', title)) stored
  );
  create index items_tsv on items using gin (tsv);
  insert into authors select g, 'author ' || g from generate_series(1, 50) g;
  insert into items select g, 1 + g % 50, 'novel chapter ' || g, jsonb_build_object('n', g, 'tags', jsonb_build_array('a', 'b')) from generate_series(1, 2000) g;
" > /dev/null

summary() {
  psql_in "$1" "select
    (select count(*) from authors),
    (select count(*) from items),
    (select md5(string_agg(t::text, ',' order by id)) from items t),
    (select count(*) from items where tsv @@ to_tsquery('english', 'chapter & 1999')),
    (select count(*) from pg_indexes where schemaname = 'public')"
}
before="$(summary "$DATABASE")"

echo "Backing up, as the job does"
database_url="postgresql://postgres:$password@$id-pg:5432/$DATABASE"
docker run --rm --network "$id" -v "$work:/backup" -e DATABASE_URL="$database_url" "$POSTGRES_IMAGE" \
  sh -c 'pg_dump --format=custom --file=/backup/dump "$DATABASE_URL"'
stamp="$(date -u +%Y-%m-%dT%H-%MZ)"
key="daily/$PROJECT/$DATABASE/$stamp.dump"
aws s3 cp /work/dump "s3://$bucket/$key" > /dev/null

echo "Checking the key"
listed="$(aws s3 ls "s3://$bucket/" --recursive | awk '{print $4}')"
[ "$listed" = "$key" ] || { echo "Unexpected objects: $listed" >&2; exit 1; }

echo "Restoring $key into a scratch database"
rm -f -- "$work/dump"
aws s3 cp "s3://$bucket/$key" /work/restored.dump > /dev/null
psql_in postgres "create database scratch" > /dev/null
docker run --rm --network "$id" -v "$work:/restore" "$POSTGRES_IMAGE" \
  pg_restore --no-owner --exit-on-error --dbname "postgresql://postgres:$password@$id-pg:5432/scratch" /restore/restored.dump
after="$(summary scratch)"

echo "source:   $before"
echo "restored: $after"
[ "$before" = "$after" ] || { echo "FAILED: the restored database differs from the source" >&2; exit 1; }
echo "OK: $key restored into a scratch database and matches the source"
