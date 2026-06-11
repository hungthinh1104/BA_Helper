ALTER TABLE "user"
ADD COLUMN "selected_project_id" TEXT;

ALTER TABLE "user"
ADD CONSTRAINT "user_selected_project_id_fkey"
FOREIGN KEY ("selected_project_id") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "user_selected_project_id_idx" ON "user"("selected_project_id");
