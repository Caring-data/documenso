-- Development Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

\echo 'Starting database initialization...'

-- Create additional databases if needed
-- CREATE DATABASE caring_data_residents_test;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create development user with limited privileges (if needed)
-- CREATE USER dev_user WITH PASSWORD 'dev_password';
-- GRANT CONNECT ON DATABASE caring_data_residents_dev TO dev_user;

-- Set timezone to UTC
SET timezone = 'UTC';

-- Create database-level configuration
ALTER DATABASE caring_data_residents_dev SET timezone TO 'UTC';
ALTER DATABASE caring_data_residents_dev SET log_statement TO 'all';

\echo 'Database initialization completed!'