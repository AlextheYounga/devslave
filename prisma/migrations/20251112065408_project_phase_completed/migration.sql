-- Align legacy COMPLETE phase values with the new COMPLETED enum variant
UPDATE "codebases"
SET "phase" = 'COMPLETED'
WHERE "phase" = 'COMPLETE';
