# Used by the migrate image: it applies ent/migrate/migrations to the database in DATABASE_URL.
env "deploy" {
  url = getenv("DATABASE_URL")
  migration {
    dir = "file:///migrations"
  }
}
