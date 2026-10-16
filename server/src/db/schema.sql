-- KarabakhAgroInvest - PostgreSQL sxemi (idempotent)

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY,
  voen        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  company     TEXT,
  role        TEXT NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registration profile fields + approval status (idempotent migrations)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
-- Account type chosen at registration: 'sahibkar' (entrepreneur) or 'investor'
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'sahibkar';

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS lands (
  id            UUID PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  district      TEXT NOT NULL,
  district_name TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  purpose_label TEXT NOT NULL,
  color         TEXT,
  area_ha       NUMERIC NOT NULL,
  ph            NUMERIC,
  fertility     INTEGER,
  water_km      NUMERIC,
  sun_days      INTEGER,
  status        TEXT NOT NULL DEFAULT 'available',
  cadence       TEXT,
  geometry      JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitions (
  id           UUID PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  short        TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'upcoming',
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  total_budget NUMERIC,
  currency     TEXT DEFAULT 'AZN',
  categories   TEXT[] DEFAULT '{}',
  incentives   TEXT[] DEFAULT '{}',
  eligibility  TEXT[] DEFAULT '{}',
  stages       TEXT[] DEFAULT '{}',
  current_stage INTEGER
);

CREATE TABLE IF NOT EXISTS applications (
  id                UUID PRIMARY KEY,
  tracking_code     TEXT UNIQUE NOT NULL,
  voen              TEXT,
  applicant_name    TEXT,
  company           TEXT,
  land_id           UUID REFERENCES lands(id) ON DELETE SET NULL,
  land_code         TEXT,
  district          TEXT,
  district_name     TEXT,
  purpose           TEXT,
  purpose_label     TEXT,
  area_ha           NUMERIC,
  investment_amount NUMERIC,
  business_plan     TEXT,
  files             JSONB NOT NULL DEFAULT '[]',
  roi               JSONB,
  score             JSONB,
  competition_id    UUID REFERENCES competitions(id) ON DELETE SET NULL,
  competition_title TEXT,
  status            TEXT NOT NULL DEFAULT 'submitted',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  timeline          JSONB NOT NULL DEFAULT '[]'
);

-- Project attributes (idempotent migrations): modern-tech & value-chain tags + impact metrics
ALTER TABLE applications ADD COLUMN IF NOT EXISTS technologies      TEXT[] DEFAULT '{}';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS value_chain       TEXT[] DEFAULT '{}';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS arable_area_ha    NUMERIC;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS permanent_jobs    INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS seasonal_jobs     INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS annual_output_tons NUMERIC;

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS current_stage INTEGER;

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'info',
  title          TEXT NOT NULL,
  body           TEXT,
  link           TEXT,
  application_id UUID,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Job vacancies posted by sahibkarlar / investors
CREATE TABLE IF NOT EXISTS vacancies (
  id              UUID PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT,
  district        TEXT,
  district_name   TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  positions       INTEGER NOT NULL DEFAULT 1,
  salary_min      NUMERIC,
  salary_max      NUMERIC,
  currency        TEXT DEFAULT 'AZN',
  description     TEXT,
  requirements    TEXT,
  contact         TEXT,
  technologies    TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'open',
  posted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  poster_name     TEXT,
  poster_type     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Applications (müraciət) submitted by job seekers against a vacancy
CREATE TABLE IF NOT EXISTS vacancy_applications (
  id          UUID PRIMARY KEY,
  vacancy_id  UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  voen        TEXT,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_district ON vacancies(district);
CREATE INDEX IF NOT EXISTS idx_vacancies_poster ON vacancies(posted_by);
CREATE INDEX IF NOT EXISTS idx_vacancy_apps_vacancy ON vacancy_applications(vacancy_id);
-- State-owned land projects proposed for co-investment (Co-Invest model)
CREATE TABLE IF NOT EXISTS investment_projects (
  id              UUID PRIMARY KEY,
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_voen      TEXT,
  owner_name      TEXT,
  owner_type      TEXT,
  land_id         UUID REFERENCES lands(id) ON DELETE SET NULL,
  land_code       TEXT,
  district        TEXT,
  district_name   TEXT,
  purpose         TEXT,
  purpose_label   TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  total_budget    NUMERIC NOT NULL DEFAULT 0,
  self_funded     NUMERIC NOT NULL DEFAULT 0,
  required_investment NUMERIC NOT NULL DEFAULT 0,
  raised_investment   NUMERIC NOT NULL DEFAULT 0,
  equity_offered  NUMERIC,
  profit_share    NUMERIC,
  fixed_yield     NUMERIC,
  model           TEXT NOT NULL DEFAULT 'equity',
  milestones      JSONB NOT NULL DEFAULT '[]',
  timeline_months INTEGER,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Investor proposals made towards a project
CREATE TABLE IF NOT EXISTS investment_proposals (
  id              UUID PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  investor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  investor_voen   TEXT,
  investor_name   TEXT,
  amount          NUMERIC NOT NULL,
  model           TEXT NOT NULL,
  terms           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_projects_owner ON investment_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_investment_projects_status ON investment_projects(status);
CREATE INDEX IF NOT EXISTS idx_investment_proposals_project ON investment_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_investment_proposals_investor ON investment_proposals(investor_id);
-- AI & satellite indicators for co-investment projects (idempotent)
ALTER TABLE investment_projects ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE investment_projects ADD COLUMN IF NOT EXISTS ndvi_score NUMERIC DEFAULT 0.6;
ALTER TABLE investment_projects ADD COLUMN IF NOT EXISTS ndvi_health TEXT DEFAULT 'Orta';

CREATE INDEX IF NOT EXISTS idx_lands_district ON lands(district);
CREATE INDEX IF NOT EXISTS idx_lands_purpose ON lands(purpose);
CREATE INDEX IF NOT EXISTS idx_lands_status ON lands(status);
CREATE INDEX IF NOT EXISTS idx_apps_voen ON applications(voen);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_competition ON applications(competition_id);

  -- Relief/terrain of land (idempotent)
ALTER TABLE lands ADD COLUMN IF NOT EXISTS relief TEXT DEFAULT 'Düzənlik';
-- Owner private note (idempotent)
ALTER TABLE investment_projects ADD COLUMN IF NOT EXISTS owner_note TEXT;
-- Relief marker for state-owned land projects
ALTER TABLE investment_projects ADD COLUMN IF NOT EXISTS relief TEXT;
-- Land area (hectares) for state-proposed plots
ALTER TABLE investment_projects ADD COLUMN IF NOT EXISTS area_ha NUMERIC;
