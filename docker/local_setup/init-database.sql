-- Init idempotent for child project: create role with CREATEDB and the database if they don't exist

-- 1) Create or update role with CREATEDB
DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cd_documenso_user') THEN
    CREATE ROLE cd_documenso_user WITH LOGIN PASSWORD 'cd_documenso_password' CREATEDB;
  ELSE
    -- ensure that the password and the CREATEDB permission are present
    ALTER ROLE cd_documenso_user WITH PASSWORD 'cd_documenso_password';
    ALTER ROLE cd_documenso_user WITH CREATEDB;
  END IF;
END
$$;

-- 2) Create the database if it doesn't exist and assign owner
DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cd_documenso') THEN
    EXECUTE format('CREATE DATABASE %I OWNER %I', 'cd_documenso', 'cd_documenso_user');
  END IF;
END
$$;

-- 3) Connect to the recently created database and apply extensions/privileges/config
\connect cd_documenso

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4) Grant privileges over future schemas/objects (the database is already owned by the user)
GRANT ALL PRIVILEGES ON DATABASE cd_documenso TO cd_documenso_user;

-- DB level configurations
ALTER DATABASE cd_documenso SET timezone TO 'UTC';
ALTER DATABASE cd_documenso SET log_statement TO 'all';
