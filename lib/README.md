# Library Directory

Shared utilities, helpers, and business logic.

## Structure

- `/api` - API client functions and external service integrations
  - VinAudit API client
  - Auto.dev API client
  - CarsXE API client
  - Stripe client

- `/db` - Database utilities and Supabase clients
  - Supabase client configurations
  - Database query helpers

- `/validations` - Zod validation schemas
  - User input validation
  - API request/response validation

- `/utils` - General utility functions
  - Date formatting
  - Currency formatting
  - File handling

## Guidelines

- Keep functions pure when possible
- Export types alongside functions
- Write unit tests for all utilities
- Document complex logic with JSDoc comments
