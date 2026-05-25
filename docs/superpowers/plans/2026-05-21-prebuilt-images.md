# Prebuilt Container Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish full Java/C++/Python ACCoder app and runner images from GitHub Actions and give Docker-only users a pull-first startup path.

**Architecture:** Keep the existing full-language `Dockerfile.app` and `Dockerfile` split. A GitHub Actions matrix builds both Dockerfiles for GHCR as multi-platform images, while a prebuilt Compose file pulls the app image and the docs explain when to use the app image versus the runner image.

**Tech Stack:** GitHub Actions, GitHub Container Registry, Docker Buildx, Docker Compose, Node test suite.

---

### Task 1: Lock In The Published Image Contract

**Files:**
- Modify: `tests/docker-deployment.test.js`

- [x] **Step 1: Write the failing deployment tests**

```js
test("repository publishes prebuilt app and runner images through GitHub Actions", () => {
  const workflow = fs.readFileSync(".github/workflows/publish-images.yml", "utf8");

  assert.match(workflow, /ghcr\.io/);
  assert.match(workflow, /Dockerfile\.app/);
  assert.match(workflow, /dockerfile:\s*Dockerfile\b/);
  assert.match(workflow, /linux\/amd64,linux\/arm64/);
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/docker-deployment.test.js`

Expected: FAIL because the publish workflow and prebuilt Compose file do not exist yet.

### Task 2: Add The Prebuilt Publish Path

**Files:**
- Create: `.github/workflows/publish-images.yml`
- Create: `docker-compose.prebuilt.yml`

- [x] **Step 1: Add the GHCR workflow**

Use a two-entry matrix:

```yaml
matrix:
  include:
    - name: app
      dockerfile: Dockerfile.app
    - name: runner
      dockerfile: Dockerfile
```

The workflow logs in to `ghcr.io` with `secrets.GITHUB_TOKEN`, publishes `linux/amd64` and `linux/arm64`, and emits branch/tag/SHA tags plus `latest` for version tags.

- [x] **Step 2: Add the prebuilt Compose entrypoint**

```yaml
services:
  accoder:
    image: ghcr.io/pygmalion03/accoder-app:latest
    ports:
      - "43117:43117"
    volumes:
      - ./data/memory:/app/data/memory
```

- [x] **Step 3: Run the focused deployment test**

Run: `node --test tests/docker-deployment.test.js`

Expected: PASS.

### Task 3: Document The Two Image Paths

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment.md`

- [x] **Step 1: Explain app versus runner**

Document that the app image runs the whole ACCoder Web service with all three language toolchains, while the runner image is for a locally started ACCoder server that executes submissions through Docker.

- [x] **Step 2: Document pull-first commands**

Add:

```bash
docker compose -f docker-compose.prebuilt.yml up -d
```

and the runner override:

```powershell
$env:ACCODER_DOCKER_IMAGE="ghcr.io/pygmalion03/accoder-runner:latest"
```

- [x] **Step 3: Run the full verification**

Run: `npm test`

Expected: PASS with all tests green.
