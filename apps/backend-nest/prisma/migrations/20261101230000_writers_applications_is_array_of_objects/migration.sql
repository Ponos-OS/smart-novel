-- Prisma cannot declare a CHECK, so this is written by hand and the generated baseline is left alone.
-- The constraint exists in production only: the local stack and the e2e tests build the schema with `prisma db push`, where `parseApplications` is the check.
-- Only the shape of the column is enforced (an array whose entries are all objects); the fields of an entry are validated by the application.
ALTER TABLE "writers"
  ADD CONSTRAINT "writers_applications_is_array_of_objects"
  CHECK (
    jsonb_typeof("applications") = 'array'
    AND NOT jsonb_path_exists("applications", '$[*] ? (@.type() != "object")')
  );
