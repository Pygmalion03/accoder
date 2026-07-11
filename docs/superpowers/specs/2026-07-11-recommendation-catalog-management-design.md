# Recommendation Catalog Management Design

## Goal

Ship ACMCoder with a useful Chinese recommendation catalog and let users manage that catalog with the same selection, select-all, export, and batch-delete interaction used by the personal library. Recommendation metadata and personal practice pages remain separate stores.

## Default and Runtime Data

The repository includes `data/recommendation/default-catalog.json` with 30 curated interview problems. Titles and tags are Chinese; slugs and LeetCode URLs remain canonical. The source is labeled `内置高频题库`, without claiming a live CodeTop ranking.

`data/recommendation/catalog.json` remains ignored runtime data. When it does not exist, the server reads the bundled default catalog. Importing or deleting entries writes a runtime catalog, so user changes survive restarts without modifying the bundled source file. Import keeps the current replacement behavior.

The catalog stores only recommendation metadata. A problem statement is fetched and saved to personal practice memory only when the user adds or opens that recommendation for practice.

## Catalog Management

The catalog view provides Import, Export, Select Problems, Select All, and Delete Selected controls.

- Export uses selected entries when a selection exists, otherwise all entries.
- Select All is visible only in selection mode and toggles between selecting and clearing every current catalog entry.
- Delete Selected asks for confirmation, removes entries from the runtime catalog, and persists the result.
- Leaving selection mode clears the current selection.
- Empty catalogs disable export and retain the existing empty-state message.

The server exposes a downloadable export in the existing import-compatible format and a batch-delete endpoint accepting LeetCode slugs.

## Language Consistency

The bundled catalog uses Chinese titles and Chinese topic tags. The target-tag input example is also changed to Chinese so planner preferences match catalog tags. Existing local demo data is replaced with the same 30-entry Chinese catalog after deployment.

## Verification

Tests cover default fallback loading, export filtering, persistent deletion, API behavior, UI controls, selection mode, select-all wiring, and Chinese default data. The complete suite must pass in both the development worktree and final submission repository.

