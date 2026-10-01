# Database Migration Strategy

In production, you can no longer click around the Supabase UI to add columns or delete tables. Doing so risks dropping live user data or breaking the API unexpectedly.

We use **Versioned Migrations**.

## Golden Rules
1. **Never edit a migration that has already been pushed to production.** 
   If you made a mistake in `20261001_create_scans.sql`, you do *not* edit it. You create a *new* migration `20261005_fix_scans.sql` that applies the fix.
2. **Always test locally first.**
3. **Operations must be non-destructive where possible.** Instead of `DROP COLUMN`, consider `ALTER COLUMN` or creating a new column and migrating data first.

## The Workflow

### 1. Local Development
When you need to change the schema locally:
```bash
# Generate a new blank migration file
supabase migration new add_user_preferences
```

Write your SQL in the generated file:
```sql
-- Up migration
ALTER TABLE scans ADD COLUMN is_favorite BOOLEAN DEFAULT false;
```

Apply it to your local database:
```bash
supabase db set up
```

### 2. Pushing to Production
Once development is done and tested, push the exact sequence of SQL files to production safely:
```bash
# Verify the production DB matches your migration history
supabase db push
```

Supabase will read the `supabase_migrations.schema_migrations` table on the production server, notice that `20261001_create_scans` is already there, but `add_user_preferences` is missing, and will execute *only* the new file.
