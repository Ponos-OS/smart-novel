-- Create "chapter_contents" table
CREATE TABLE "chapter_contents" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "content" text NOT NULL, "content_tsv" tsvector NULL, "content_hash" character varying NOT NULL, PRIMARY KEY ("id"));
-- Create index "chapter_contents_content_hash_idx" to table: "chapter_contents"
CREATE INDEX "chapter_contents_content_hash_idx" ON "chapter_contents" ("content_hash");
-- Create index "chapter_contents_content_tsv_idx" to table: "chapter_contents"
CREATE INDEX "chapter_contents_content_tsv_idx" ON "chapter_contents" USING gin ("content_tsv");
-- Create "platform_terms_acceptances" table
CREATE TABLE "platform_terms_acceptances" ("id" uuid NOT NULL, "user_id" character varying NOT NULL, "terms_version" bigint NOT NULL, "accepted_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"));
-- Create index "IDX_platform_terms_acceptances_user" to table: "platform_terms_acceptances"
CREATE INDEX "IDX_platform_terms_acceptances_user" ON "platform_terms_acceptances" ("user_id");
-- Create index "platform_terms_acceptances_user_id_terms_version_key" to table: "platform_terms_acceptances"
CREATE UNIQUE INDEX "platform_terms_acceptances_user_id_terms_version_key" ON "platform_terms_acceptances" ("user_id", "terms_version");
-- Create "stats_snapshots" table
CREATE TABLE "stats_snapshots" ("id" uuid NOT NULL, "day" date NOT NULL, "novel_count" bigint NOT NULL, "chapter_count" bigint NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"));
-- Create index "UQ_stats_snapshots_day" to table: "stats_snapshots"
CREATE UNIQUE INDEX "UQ_stats_snapshots_day" ON "stats_snapshots" ("day");
-- Create "licenses" table
CREATE TABLE "licenses" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "name" character varying NOT NULL, "text" text NOT NULL, "text_hash" character varying NULL, "source_type" character varying NOT NULL, "canonical_id" character varying NULL, "is_default" boolean NOT NULL DEFAULT false, "is_draft" boolean NOT NULL DEFAULT false, "owner_id" character varying NOT NULL DEFAULT 'system', PRIMARY KEY ("id"));
-- Create index "licenses_owner_id_text_hash_key" to table: "licenses"
CREATE UNIQUE INDEX "licenses_owner_id_text_hash_key" ON "licenses" ("owner_id", "text_hash");
-- Create "writers" table
CREATE TABLE "writers" ("id" uuid NOT NULL, "user_id" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "pen_name" citext NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "applications" jsonb NOT NULL DEFAULT '[]', "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"), CONSTRAINT "writers_applications_is_array_of_objects" CHECK ((jsonb_typeof(applications) = 'array'::text) AND (NOT jsonb_path_exists(applications, '$[*]?(@.type() != "object")'::jsonpath))));
-- Create index "IDX_writers_status_created_at" to table: "writers"
CREATE INDEX "IDX_writers_status_created_at" ON "writers" ("status", "created_at");
-- Create index "UQ_writers_pen_name" to table: "writers"
CREATE UNIQUE INDEX "UQ_writers_pen_name" ON "writers" ("pen_name");
-- Create index "UQ_writers_user" to table: "writers"
CREATE UNIQUE INDEX "UQ_writers_user" ON "writers" ("user_id");
-- Create "novels" table
CREATE TABLE "novels" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "name" character varying NOT NULL, "description" text NOT NULL, "state" character varying NOT NULL DEFAULT 'ONGOING', "cover_url" character varying NULL, "first_chapter_created_at" timestamptz NULL, "license_id" uuid NOT NULL, "writer_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "novels_licenses_novels" FOREIGN KEY ("license_id") REFERENCES "licenses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, CONSTRAINT "novels_writers_novels" FOREIGN KEY ("writer_id") REFERENCES "writers" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT);
-- Create index "IDX_novels_first_chapter_created_at" to table: "novels"
CREATE INDEX "IDX_novels_first_chapter_created_at" ON "novels" ("first_chapter_created_at", "id");
-- Create index "IDX_novels_license" to table: "novels"
CREATE INDEX "IDX_novels_license" ON "novels" ("license_id");
-- Create index "IDX_novels_writer" to table: "novels"
CREATE INDEX "IDX_novels_writer" ON "novels" ("writer_id");
-- Create "chapters" table
CREATE TABLE "chapters" ("id" uuid NOT NULL, "title" character varying NOT NULL, "narration_status" character varying NULL, "narration_url" character varying NULL, "chapter_number" bigint NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "content_id" uuid NOT NULL, "novel_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "chapters_chapter_contents_chapter" FOREIGN KEY ("content_id") REFERENCES "chapter_contents" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "chapters_novels_chapters" FOREIGN KEY ("novel_id") REFERENCES "novels" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);
-- Create index "IDX_chapters_novel" to table: "chapters"
CREATE INDEX "IDX_chapters_novel" ON "chapters" ("novel_id");
-- Create index "chapters_content_id_key" to table: "chapters"
CREATE UNIQUE INDEX "chapters_content_id_key" ON "chapters" ("content_id");
-- Create "chapter_user_states" table
CREATE TABLE "chapter_user_states" ("id" uuid NOT NULL, "user_id" character varying NOT NULL, "first_read_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "chapter_id" uuid NOT NULL, "novel_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "chapter_user_states_chapters_user_states" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "chapter_user_states_novels_chapter_user_states" FOREIGN KEY ("novel_id") REFERENCES "novels" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);
-- Create index "IDX_chapter_user_states_novel" to table: "chapter_user_states"
CREATE INDEX "IDX_chapter_user_states_novel" ON "chapter_user_states" ("novel_id");
-- Create index "IDX_chapter_user_states_novel_chapter" to table: "chapter_user_states"
CREATE INDEX "IDX_chapter_user_states_novel_chapter" ON "chapter_user_states" ("novel_id", "chapter_id");
-- Create index "IDX_chapter_user_states_user_novel" to table: "chapter_user_states"
CREATE INDEX "IDX_chapter_user_states_user_novel" ON "chapter_user_states" ("user_id", "novel_id");
-- Create index "UQ_chapter_user_states_user_chapter" to table: "chapter_user_states"
CREATE UNIQUE INDEX "UQ_chapter_user_states_user_chapter" ON "chapter_user_states" ("user_id", "chapter_id");
-- Create "tags" table
CREATE TABLE "tags" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "name" citext NOT NULL, "description" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'APPROVED', "requester_user_id" character varying NULL, PRIMARY KEY ("id"));
-- Create index "IDX_tags_status_name" to table: "tags"
CREATE INDEX "IDX_tags_status_name" ON "tags" ("status", "name");
-- Create index "tags_name_key" to table: "tags"
CREATE UNIQUE INDEX "tags_name_key" ON "tags" ("name");
-- Create "novel_tags" table
CREATE TABLE "novel_tags" ("created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "novel_id" uuid NOT NULL, "tag_id" uuid NOT NULL, PRIMARY KEY ("novel_id", "tag_id"), CONSTRAINT "novel_tags_novels_novel" FOREIGN KEY ("novel_id") REFERENCES "novels" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "novel_tags_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);
-- Create index "IDX_novel_tags_novel" to table: "novel_tags"
CREATE INDEX "IDX_novel_tags_novel" ON "novel_tags" ("novel_id");
-- Create index "IDX_novel_tags_tag" to table: "novel_tags"
CREATE INDEX "IDX_novel_tags_tag" ON "novel_tags" ("tag_id");
