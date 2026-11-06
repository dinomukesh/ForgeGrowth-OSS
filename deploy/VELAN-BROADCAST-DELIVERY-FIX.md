# Broadcast delivery fix — 2026-11-06

Confirmed from stored Meta webhook payloads: both earlier messages received 130429 after API acceptance. Only two outgoing messages were recorded in that minute. Meta reported CONNECTED, GREEN and STANDARD throughput during diagnosis. The cause of Meta's unusually low-volume throttling remains unproven; slower sending cannot guarantee delivery. Official Meta documentation URLs returned HTTP 429 during research.

## Changes

- Redis server time and atomic reservations enforce at least 1000 ms between broadcast request starts per account, across concurrent workers. BROADCAST_GAP_MS may increase this interval; minimum is 1000 ms.
- 130429 API errors set a 60-second account cooldown; waiting jobs are delayed without consuming retry attempts.
- Future template broadcast jobs retain a Redis delivery context for 24 hours. Explicit 130429 failed receipts can schedule at most three delivery retries after 60, 120 and 300 seconds. Existing historical failed messages have no context and are not replayed. Other delivery error codes are not automatically retried by this mechanism.
- Deterministic retry job IDs deduplicate callbacks; immediately before sending, the original message must still be failed with 130429. Already delivered/read or replaced message IDs are skipped. Receipt bookkeeping errors do not cause an accepted API request to be resent. Retry notifications appear in the stored failure explanation.
- BROADCAST_DELIVERY_RETRIES=false stops new delivery retry scheduling and skips these retry jobs at execution.
- Webhook receipts reconcile chat and broadcast logs. Positive delivered/read receipts outrank failures; older sent/failed events cannot regress delivered/read. Structured latest receipt details are retained in existing raw_payload. Account-only error callbacks appear as errors in the existing webhook audit.
- Campaign detail derives its status from actual recipient results, matching the list.

No database migration. No test/customer messages sent. Two stale broadcast logs were backed up privately and corrected from their matching failed chat records. Live campaign list/detail now report FAILED, total 2, failed 2, sent/delivered/read 0.

## Validation

31 tests passed, including real isolated PostgreSQL receipt reconciliation, duplicated/out-of-order receipts, real isolated Redis concurrent spacing, bounded retries, deterministic retry IDs, non-retryable errors, and existing webhook payload parsing. Targeted ESLint passed. The retry-notification change subsequently passed its targeted unit test. Production environment confirms BROADCAST_GAP_MS=1000 and BROADCAST_DELIVERY_RETRIES=true. Actual external delivery at the new pace remains untested: a user-triggered test broadcast is needed to confirm Meta accepts it.

## Deployment and rollback

Backend image: forgegrowth-velan-backend:broadcast-delivery-20261106, based on template-import-20261106 (retains earlier fixes). Frontend unchanged.

Private backup: /home/dino/broadcast-logs-before-delivery-fix.json. Previous compose: /home/dino/forgegrowth/compose.proxy.before-broadcast-delivery-20261106.yml. Previous images retained.

To roll back, first stop the backend, remove ONLY the new delayed/waiting delivery retry jobs, then restore the prior compose. This prevents the old worker from executing retries without the new status guard. Use deploy/rollback-broadcast-delivery.sh on the server. Ordinary user-originated queue jobs are preserved. Corrected delivery logs stay corrected; reverting the app does not justify changing known failures back to sent.

No automatic retry can bypass Meta's restrictions. If a single later test still gets 130429 after a quiet period, inspect traffic from any other integration using the number and escalate with message IDs/timestamps to Meta.
