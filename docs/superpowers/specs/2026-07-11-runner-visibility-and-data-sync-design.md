# Runner Visibility and Docker Data Sync

## Goal

Make the Web app and extension always name all three execution environments while only allowing modes that the connected backend can actually execute. Make Docker app reuse the same local data directory as a host-started ACMCoder from the same checkout.

## Runner Model

The user-facing modes are:

- `local`: the host machine toolchain.
- `builtin`: the toolchain installed inside Docker app.
- `docker`: the separate Docker runner container.

The server API continues to accept only `local` and `docker`. Both `local` and `builtin` map to the API's `local` runner because each runs inside the process that serves the current page. In host deployment, `local` and `docker` may be enabled while `builtin` is disabled. In Docker app deployment, `builtin` is enabled while `local` and `docker` are disabled.

The selector always contains all three labels. Unavailable modes remain visible but disabled, and saved selections that are unavailable are moved to the backend's recommended available mode.

## Data Sync

Both Compose files bind `./data` to `/app/data`. Therefore a Docker app started from a checkout reads and writes the same memory, plan, progress, settings, and recommendation catalog as a host service started from that checkout.

Docker images still contain a build-time snapshot of the source. Source changes require `docker compose up --build -d`; normal restarts use `docker compose up -d`.

Personal runtime data is not copied between the development worktree and the submission repository, and API keys are not committed.

## Verification

- Web and extension markup contain all three runner options.
- UI runner values map to the existing API runner contract.
- Host deployment enables host/Docker choices and Docker app enables only built-in execution.
- Both Compose files mount the complete data directory.
- Existing runner, Docker, extension, and full repository tests pass.
