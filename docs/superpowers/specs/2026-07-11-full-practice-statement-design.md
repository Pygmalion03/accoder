# Full Practice Statement Design

## Goal

The browser side panel remains a compact coding surface, while every recommendation opened in the full Practice view displays the complete LeetCode statement instead of recommendation metadata or placeholder text.

## Data Flow

When a daily-plan item is added to practice or reopened, the server resolves its statement before opening the Practice view:

1. Look for a complete page with the same LeetCode slug in local memory.
2. If no complete page exists, request the question from the LeetCode China GraphQL endpoint.
3. Convert the returned HTML statement to plain text, preserve translated title, difficulty, tags, and the first sample, then save it to local memory.
4. Reload the local problem list and open `memory:<slug>` in the full Practice view.

Old metadata-only records are not considered complete cache entries. Reopening one triggers the same resolution flow and replaces the visible latest record with a complete statement.

## Failure Handling

If neither local memory nor LeetCode can provide a statement, the add/open request fails with a Chinese error message. The server does not append another placeholder record and does not mark the item as successfully added. The existing "打开原题" link remains available in the daily plan.

## Scope

- Add a focused server module for LeetCode question retrieval and HTML-to-text normalization.
- Resolve and cache statements in the daily-plan action endpoint.
- Make the existing "打开练习" action pass through statement resolution so old placeholder records repair themselves.
- Keep extension side-panel rendering and recommendation logic unchanged.
- Cover remote retrieval, local-cache reuse, stale-placeholder repair, and failure behavior with automated tests.

