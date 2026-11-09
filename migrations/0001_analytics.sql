-- One row per page view. The collector updates scroll/engaged on the same row as the visitor reads.
CREATE TABLE pageviews (
  id TEXT PRIMARY KEY,          -- random per page view, made by the browser
  ts INTEGER NOT NULL,          -- unix ms
  day TEXT NOT NULL,            -- YYYY-MM-DD in the site's time zone
  visitor TEXT NOT NULL,        -- hash of IP + user agent + a salt that's deleted after a day
  path TEXT NOT NULL,
  not_found INTEGER NOT NULL DEFAULT 0,
  referrer TEXT,                -- external referrer's host only
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,                 -- ISO code from Cloudflare
  region TEXT,
  city TEXT,
  device TEXT,                  -- mobile | tablet | desktop
  browser TEXT,
  os TEXT,
  lang TEXT,
  scroll INTEGER NOT NULL DEFAULT 0,   -- max scroll depth, percent
  engaged INTEGER NOT NULL DEFAULT 0   -- seconds the tab was visible
);
CREATE INDEX pageviews_day ON pageviews (day);

-- Interactions: outbound clicks, searches, copies and data-track clicks.
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  pageview TEXT,
  path TEXT NOT NULL,
  type TEXT NOT NULL,           -- outbound | search | copy | click
  name TEXT,                    -- outbound: host; search: query; copy: text; click: data-track value
  target TEXT                   -- outbound: URL; search: chosen result
);
CREATE INDEX events_day ON events (day, type);

-- Today's salt only; older salts are deleted so visitor hashes can't be linked across days.
CREATE TABLE salts (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL
);
