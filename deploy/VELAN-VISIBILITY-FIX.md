# Assignment and follow-up visibility fix — 2026-11-05

Chat assignment previously updated contacts only, while Table, Board, Funnel and Home filtered lead ownership. Explicit admin assignment/clearing now updates the matching lead in the same SQL statement. Lead edits and bulk assignment also sync matching chat contacts atomically.

The follow-up list now includes personal pins plus visible open reminders, using the same visibility rule as Calendar. Entries are deduplicated by contact key. Unpinning does not dismiss a scheduled reminder; only actual pins show the unpin button. The heading describes follow-up leads rather than claiming every entry is pinned.

The Social tab is hidden when the current user lacks the Social page permission. No permissions were granted. Removed a stray rendered comma in ContactList.

Validation: targeted backend/frontend ESLint; production build; 7 existing sales frontend tests; 11 follow-up unit tests plus an isolated PostgreSQL integration test exercising actual contact-save and bulk-assignment handlers, assignment/clearing, reminders without pins, deduplication, completion and unrelated-user exclusion. Integration test is opt-in with FOLLOWUP_TEST_DATABASE=1 and POSTGRES_DB=followup_test and requires a disposable database. It recreates the coexistence schema in that test database.

Live validation: authenticated Sales-user responses for Contacts, Board, Funnel, Home, follow-up list and Calendar agree. Public HTTPS asset hash matches the built frontend. Existing inconsistent ownership was corrected through the supported bulk-assignment API after verifying the chat owner, with a private server-side backup. No customer messages were sent.

Images: forgegrowth-velan-web:visibility-20261105 and forgegrowth-velan-backend:visibility-20261105. Backend Dockerfile retains the previously deployed runtime; web Dockerfile retains the original nginx settings. The installation compose.proxy.yml pins both images with pull_policy: never.

Rollback: restore the installation's compose.proxy.before-visibility-20261105.yml and run docker compose up -d --no-deps --pull never backend web. This reverts application images, not the corrected owner record. Database schema was not changed.

Future updates: merge/rebase upstream into the custom branch, test, rebuild and update the deployment image pins. Review the backend base image when updating dependencies.
