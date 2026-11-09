-- Visitor hashes now last a calendar month (Umami's default) instead of a day, so repeat visits within a
-- month can be counted. The salt row is keyed by month (YYYY-MM) and deleted when the month ends.
ALTER TABLE salts RENAME COLUMN day TO period;
DELETE FROM salts;

ALTER TABLE pageviews ADD COLUMN utm_content TEXT;
ALTER TABLE pageviews ADD COLUMN utm_term TEXT;

-- Returning-visitor lookups: has this visitor been here on an earlier day?
CREATE INDEX pageviews_visitor ON pageviews (visitor, day);
