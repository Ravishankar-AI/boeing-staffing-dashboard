-- Engagements become Change Requests with many-to-many business owners.
-- Data-preserving: rows keep their ids, so positions, candidates and resumes
-- stay attached. Engagements whose names share a CR code (e.g. "CR04 ·
-- Navneet" and "CR04 · Lakshmi / Christos") are merged into one CR.

-- 1. Rename the table and the position foreign key in place.
ALTER TABLE "Engagement" RENAME TO "ChangeRequest";
ALTER TABLE "ChangeRequest" RENAME CONSTRAINT "Engagement_pkey" TO "ChangeRequest_pkey";
ALTER INDEX "Engagement_code_key" RENAME TO "ChangeRequest_code_key";
ALTER TABLE "ChangeRequest" ADD COLUMN "title" TEXT;

ALTER TABLE "Position" RENAME COLUMN "engagementId" TO "changeRequestId";
ALTER TABLE "Position" RENAME CONSTRAINT "Position_engagementId_fkey" TO "Position_changeRequestId_fkey";
ALTER TABLE "Position" ADD COLUMN "businessOwnerId" TEXT;

CREATE TABLE "BusinessOwner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessOwner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessOwner_name_key" ON "BusinessOwner"("name");

CREATE TABLE "ChangeRequestOwner" (
    "changeRequestId" TEXT NOT NULL,
    "businessOwnerId" TEXT NOT NULL,
    CONSTRAINT "ChangeRequestOwner_pkey" PRIMARY KEY ("changeRequestId","businessOwnerId")
);
ALTER TABLE "ChangeRequestOwner" ADD CONSTRAINT "ChangeRequestOwner_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeRequestOwner" ADD CONSTRAINT "ChangeRequestOwner_businessOwnerId_fkey" FOREIGN KEY ("businessOwnerId") REFERENCES "BusinessOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_businessOwnerId_fkey" FOREIGN KEY ("businessOwnerId") REFERENCES "BusinessOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Owners from the old single POC field ("Lakshmi / Christos" → two).
INSERT INTO "BusinessOwner" ("id", "name")
SELECT 'bo_' || md5(n), n
FROM (
  SELECT DISTINCT trim(x) AS n
  FROM "ChangeRequest", regexp_split_to_table("boeingPoc", '\s*(/|,|&)\s*') AS x
) t
WHERE n <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "ChangeRequestOwner" ("changeRequestId", "businessOwnerId")
SELECT cr."id", bo."id"
FROM "ChangeRequest" cr
CROSS JOIN LATERAL regexp_split_to_table(cr."boeingPoc", '\s*(/|,|&)\s*') AS x
JOIN "BusinessOwner" bo ON bo."name" = trim(x)
ON CONFLICT DO NOTHING;

-- 3. Each opening's owner: the CR's only owner, or else the owner whose
--    name matches the opening's Boeing reviewer. Anything left is set in
--    the app (Openings page).
UPDATE "Position" p SET "businessOwnerId" = o."businessOwnerId"
FROM (
  SELECT "changeRequestId", min("businessOwnerId") AS "businessOwnerId"
  FROM "ChangeRequestOwner" GROUP BY "changeRequestId" HAVING count(*) = 1
) o
WHERE o."changeRequestId" = p."changeRequestId";

UPDATE "Position" p SET "businessOwnerId" = bo."id"
FROM "ChangeRequestOwner" cro
JOIN "BusinessOwner" bo ON bo."id" = cro."businessOwnerId"
WHERE p."businessOwnerId" IS NULL
  AND cro."changeRequestId" = p."changeRequestId"
  AND lower(trim(p."hiringManager")) = lower(bo."name");

-- 4. CR code = the part of the old name before " · " ("CR04 · Navneet" →
--    "CR04"). Rows that share a code merge into the earliest one.
ALTER TABLE "ChangeRequest" ADD COLUMN "newCode" TEXT;
UPDATE "ChangeRequest" SET "newCode" = COALESCE(NULLIF(trim(split_part("name", '·', 1)), ''), "name");

CREATE TEMP TABLE cr_merge AS
SELECT "id", first_value("id") OVER (PARTITION BY "newCode" ORDER BY "createdAt", "id") AS keep
FROM "ChangeRequest";

UPDATE "Position" p SET "changeRequestId" = m.keep
FROM cr_merge m WHERE p."changeRequestId" = m."id" AND m."id" <> m.keep;

INSERT INTO "ChangeRequestOwner" ("changeRequestId", "businessOwnerId")
SELECT m.keep, cro."businessOwnerId"
FROM "ChangeRequestOwner" cro JOIN cr_merge m ON m."id" = cro."changeRequestId"
WHERE m."id" <> m.keep
ON CONFLICT DO NOTHING;

DELETE FROM "ChangeRequest" WHERE "id" IN (SELECT "id" FROM cr_merge WHERE "id" <> keep);

UPDATE "ChangeRequest" SET "code" = "newCode";
ALTER TABLE "ChangeRequest" DROP COLUMN "newCode", DROP COLUMN "name", DROP COLUMN "boeingPoc";
DROP TABLE cr_merge;
