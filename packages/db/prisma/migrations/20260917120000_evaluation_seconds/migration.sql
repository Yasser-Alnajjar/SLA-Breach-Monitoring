-- Evaluation durations move from whole minutes to whole seconds, so a
-- sub-minute snapshot (e.g. 86s remaining) is no longer truncated to 1 minute.
-- Existing rows only ever held whole minutes, so ×60 converts them exactly
-- (their lost fractions can't be recovered). Renamed, not dropped, so no
-- row loses its value.
ALTER TABLE "evaluations" RENAME COLUMN "elapsedWorkingMinutes" TO "elapsedSeconds";
ALTER TABLE "evaluations" RENAME COLUMN "remainingMinutes" TO "remainingSeconds";
ALTER TABLE "evaluations" RENAME COLUMN "breachedByMinutes" TO "breachedBySeconds";

UPDATE "evaluations"
SET "elapsedSeconds" = "elapsedSeconds" * 60,
    "remainingSeconds" = "remainingSeconds" * 60,
    "breachedBySeconds" = "breachedBySeconds" * 60;
