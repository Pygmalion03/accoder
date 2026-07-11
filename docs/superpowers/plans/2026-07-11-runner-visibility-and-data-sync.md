# Runner Visibility and Docker Data Sync Implementation Plan

**Goal:** Show all three execution environments with honest availability and keep Docker app data synchronized with its checkout.

### Task 1: Runner Mapping Tests

- [x] Add failing unit tests for UI-to-API runner mapping and deployment-specific recommendations.
- [x] Add failing Web and extension source-contract tests requiring `local`, `builtin`, and `docker` options.
- [x] Run focused tests and confirm they fail for the missing built-in option and mapping helpers.

### Task 2: Runner UI Implementation

- [x] Add all three options to the Web and extension selectors.
- [x] Map `builtin` to the API `local` runner.
- [x] Disable unavailable modes without hiding their labels.
- [x] Run focused Web and extension tests.

### Task 3: Docker Data Synchronization

- [x] Change both Compose files from `./data/memory` to `./data` bind mounts.
- [x] Update deployment documentation and Docker tests.
- [x] Run Docker-focused tests.

### Task 4: Submission and Verification

- [x] Run the complete test suite in the development worktree.
- [x] Synchronize only reviewed source, tests, Compose, and documentation into the submission repository.
- [x] Run the complete test suite in the submission repository.
- [x] Confirm the existing host service still reports host mode and serves the latest Web code.
