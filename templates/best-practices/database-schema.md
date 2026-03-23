# Best Practices — Database Schema Design

## Naming
- snake_case for all identifiers: `user_id`, `created_at`
- Plural table names: `users`, `orders`, `order_items`
- Foreign keys: `{referenced_table_singular}_id` (e.g., `user_id`)

## Data Integrity
- Every table has a primary key (prefer UUID over auto-increment for distributed systems)
- Foreign keys with ON DELETE CASCADE or RESTRICT — never leave orphans
- NOT NULL by default — nullable only when business logic requires it
- Add CHECK constraints for enums and ranges

## Indexing
- Index every foreign key column
- Index columns used in WHERE, ORDER BY, and JOIN
- Composite indexes: most selective column first
- Monitor slow queries — add indexes based on real usage, not speculation

## Migrations
- One migration per logical change — never batch unrelated changes
- Every migration must be reversible (UP + DOWN)
- Test migrations against production-size data before deploying
- Never modify released migrations — create new ones

## Anti-Patterns
- ✘ Never store comma-separated values — use junction tables
- ✘ Never use `SELECT *` in application code
- ✘ Never store passwords in plain text — use bcrypt/argon2
- ✘ Never use reserved words as column names
