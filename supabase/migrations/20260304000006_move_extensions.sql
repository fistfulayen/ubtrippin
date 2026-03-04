-- PRD-033 P4: Move extensions out of public schema.

ALTER EXTENSION citext SET SCHEMA extensions;
ALTER EXTENSION cube SET SCHEMA extensions;
ALTER EXTENSION earthdistance SET SCHEMA extensions;
