-- Force PostgREST to reload its schema cache after policy changes
NOTIFY pgrst, 'reload schema';
