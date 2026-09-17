-- Deterministic event ordering: the provider's own source order, breaking
-- ties between normalized events that share an occurredAt. Existing rows
-- default to 0 (the engine then falls back to a content-based tiebreak) and
-- pick up real values the next time their case is renormalized, since
-- normalization regenerates a case's events wholesale.
ALTER TABLE "normalized_events" ADD COLUMN "sourceSequence" INTEGER NOT NULL DEFAULT 0;
