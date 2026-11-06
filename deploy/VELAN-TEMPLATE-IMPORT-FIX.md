# Meta template import fix and rollback — 2026-11-06

Refresh All previously issued UPDATE only, so templates created directly in Meta never appeared locally. Sync now fetches components and all pagination pages, imports missing account/name/language combinations, and refreshes existing metadata while preserving locally saved content. It maps body, header, footer, samples, buttons and carousel cards into the existing template representation. Missing/unsupported required content fails the account transaction instead of leaving a partial import.

An account-scoped PostgreSQL advisory transaction lock serializes concurrent refreshes. No schema migration is required. The API returns imported/updated counts and account failures; the UI displays these results.

Tests: component mapping, paginated fetch, isolated PostgreSQL concurrent/repeated sync, separate account identity, local-content preservation and rollback on import failure. Targeted backend/frontend lint and production build passed. Live refresh imported four approved templates; repeat refresh imported zero, updated four, with no errors. The templates list returned four and body/language/Meta ID/button-count comparisons matched Meta. No customer messages or Meta template submissions were sent.

## Deployment

Backend image: forgegrowth-velan-backend:template-import-20261106
Web image: forgegrowth-velan-web:template-import-20261106
The backend image builds on visibility-20261105, retaining the previous assignment/follow-up fixes. Both images are pinned in the installation compose.proxy.yml.

## Rollback

Before deployment, the full local message_templates table was exported to a private server file, /home/dino/templates-before-import-20261106.json (zero existing records). Previous images were retained and compose.proxy.yml was copied to compose.proxy.before-template-import-20261106.yml. The deployment script automatically restores these previous application images if its verification fails.

Manual application rollback on the server:

```sh
cd /home/dino/forgegrowth
cp -p compose.proxy.before-template-import-20261106.yml compose.proxy.yml
docker compose up -d --no-deps --pull never backend web
```

This restores the previously working visibility-20261105 images and preserves all leads, flows, messages and existing fixes. It does not delete imported templates. A failed account import rolls back its database transaction automatically. If imported data itself later needs removal, compare against the private snapshot and remove only confirmed new, unused rows in a transaction after checking broadcast/flow references; do not truncate the table or restore the whole CRM database. Nothing in the import modifies templates at Meta.

For future upstream updates, merge the custom branch, rerun tests, rebuild and update the image pins.
