# OMA-File-Designer

## Local development

The app uses a local SQLite database at `./data/oma-designer.db`. The directory and schema are created automatically on startup; no PostgreSQL server or `DATABASE_URL` is required.

Start the app with:

```powershell
$env:NODE_ENV="development"
npm.cmd run dev
```

Set `SQLITE_DATABASE_PATH` to use a different database location.
