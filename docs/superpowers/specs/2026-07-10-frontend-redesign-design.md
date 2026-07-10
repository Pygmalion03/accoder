# ACMCoder Frontend Redesign Design

Date: 2026-07-10
Status: visual direction approved, pending written-spec review

## Context and Attribution

ACMCoder is a local-first LeetCode ACM practice runner. Before this redesign, the repository already provides the local problem library, code editor and syntax highlighting, local and Docker runner modes, custom stdin and expected output, execution results, import/export, progress tracking, and optional OpenAI-compatible assistance.

The current `codex/daily-planner` branch additionally provides the recommendation catalog, user planner profile, deterministic candidate ranking, AI daily-plan generation with fallback, daily-plan APIs, and the first functional daily-plan web panel. Those capabilities are the project extension completed before this visual redesign.

This redesign changes information architecture, presentation, and interaction flow. It does not claim the runner, editor, or problem-library behavior as new work. The repository still has no authoritative upstream baseline from which exact original-author ownership can be reconstructed, so this document distinguishes only:

- capability already present before this redesign;
- daily-planner capability added on the current branch;
- UI and interaction changes introduced by this redesign.

## Problem

The current web page exposes all major functions in one vertically stacked screen. The daily plan sits above the existing runner, the problem library remains permanently expanded, and runner controls, problem content, code, custom tests, results, and model assistance compete for the same viewport.

The result is functionally complete but visually flat and operationally expensive:

- the AI daily planner does not feel like the product entry point;
- selecting a daily problem does not create a focused practice session;
- the editor is pushed below settings and description content;
- original runner features and new recommendation features are not clearly grouped;
- the page does not communicate which actions are primary, contextual, or system-level.

## Goals

- Make `Today` the default product view and the daily plan the first actionable content.
- Preserve all current APIs, runner behavior, local persistence, and daily-planner behavior.
- Separate navigation and controls from content through a restrained material layer.
- Keep the editor and terminal on opaque, high-contrast surfaces.
- Make the transition from recommendation to coding feel like one practice session.
- Clearly group AI planner features, existing coding features, and system settings.
- Support desktop, compact desktop/tablet, and mobile without overlapping controls or text.
- Keep the frontend local-first, dependency-light, and usable without external assets.

## Non-Goals

- Do not add live CodeTop scraping or imply that live synchronization exists.
- Do not add mistake classification, AI post-practice review, social features, accounts, or cloud sync.
- Do not replace the current editor implementation or runner architecture.
- Do not add a frontend framework or build pipeline.
- Do not redesign server APIs unless a narrow UI integration fix is necessary.
- Do not apply glass effects to the editor, terminal, problem text, or repeated plan rows.

## Chosen Direction

The approved direction is **Liquid Glass shell plus Solid IDE**.

It combines:

- the light command bar and daily-session strip from the first coding concept;
- the opaque dark editor and bottom console from the second coding concept;
- an expanded glass navigation rail and daily-plan home screen;
- a light problem inspector beside the dark coding surface.

Glass is a functional layer, not decoration. It is limited to navigation, top commands, compact controls, and transient overlays. Content remains opaque or nearly opaque for readability.

### Visual Thesis

A calm local engineering workspace with a softly translucent navigation shell, precise green actions, one coral progress accent, and a solid near-black coding core.

### Content Plan

1. Navigation identifies the product areas and environment state.
2. Today shows the generated plan, progress, and generation settings.
3. Practice turns a selected recommendation into a focused coding session.
4. Library and catalog expose user-owned and external problems separately.
5. Settings contains model and local-data controls.

### Interaction Thesis

- The active view and active problem transition with a short opacity and translate change; no full-page flourish.
- The navigation item, session step, and run state use shared-layout-like highlight movement.
- Drawers and result panels open with restrained height/opacity transitions and respect reduced-motion settings.

## Visual System

### Core Tokens

- page backing: `#cbd9d4`
- glass surface: `rgba(245, 249, 247, 0.68)`
- solid content surface: `#f8faf9`
- primary ink: `#17231f`
- muted ink: `#68756f`
- primary action: `#176b54`
- progress accent: `#ef7657`
- warning: `#ad5b23`
- destructive: `#a63f55`
- editor: `#0d1113`
- terminal: `#0b0e10`
- editor divider: `#252c2f`

The palette must not become a single green theme. Green is reserved for primary action and success; coral identifies the current session step; amber and red remain semantic.

### Material Rules

- Use `backdrop-filter` only on navigation, the top command bar, compact controls, and overlays.
- Provide an opaque fallback through `@supports not (backdrop-filter: blur(1px))`.
- Keep repeated problem rows unframed and separated by dividers on the glass home view.
- Keep cards limited to genuine overlays, dialogs, and mobile repeated items where containment is necessary.
- Use one-pixel borders, subtle inner highlights, and low-elevation shadows.
- Do not add gradients, decorative orbs, bokeh, or nested cards.
- Keep corner radius at 8px or below, except circular icon buttons, avatars, and status dots.

### Typography and Icons

- Use the current system sans-serif stack for application text.
- Use the current monospace stack for code, stdin, expected output, and console output.
- Keep headings compact; this is an operational tool, not a landing page.
- Use a small local subset of Lucide icons for familiar actions and navigation.
- Store icon definitions locally so the application does not depend on a CDN or network access.
- Every icon-only control requires an accessible label and a tooltip.

## Information Architecture

The application uses five primary views in one static-page shell:

1. `today`: AI-generated daily plan and progress.
2. `practice`: selected problem, editor, tests, results, and optional model assistance.
3. `library`: the user's own problem library and batch operations.
4. `catalog`: the imported external recommendation catalog.
5. `settings`: model settings and local data actions.

The navigation groups them as follows:

### Smart Practice

- Today
- Recommendation Catalog

### Workspace

- Code Runner
- My Library

### System

- Import and Export
- Model Settings

Import/export can open a focused panel within `library` or `settings`; it does not require a separate route.

## View Design

### Application Shell and Function Bar

Desktop uses a 210px expanded navigation rail. It includes:

- ACMCoder product mark;
- grouped navigation items with icon and label;
- an `AI` badge on Today;
- current library count when available;
- Docker/local runner health at the bottom;
- local-data status without implying cloud synchronization.

The top bar contains the current date, a library-search shortcut, and a settings shortcut. Search opens My Library and reuses the existing title, slug, frontend ID, and tag filter; it does not introduce remote search. The bar stays light and compact and does not show account or cloud UI.

### Today

Today is the default first view.

The main column contains:

- a compact `Daily practice` eyebrow;
- a literal heading describing today's problem count;
- the regenerate action;
- three to five plan rows with sequence, title, short reason, difficulty, and open action.

Each plan row has two explicit paths:

- `Open original` records the existing `open` action and opens the LeetCode URL in a new tab.
- `Add and practice` records `add_to_practice`, reloads the user library, selects the saved lightweight problem page, and enters Practice.

The interface must not imply that ACMCoder has copied the full LeetCode statement. A recommendation added to the library continues to use the existing metadata-only page and source-link message.

The secondary inspector contains:

- today's completed count;
- a stable progress bar;
- daily count, difficulty pressure, and target tags;
- catalog import state;
- plan source (`ai` or `fallback`) without overstating capability.

The view does not show mistake analysis or AI review.

Today's completed count is derived from existing progress data, not planner actions. A plan item counts as complete only when its matching library problem has `progress.lastAcceptedAt` on the plan's local calendar date. Opening, adding, skipping, or marking a problem mastered does not increment this progress bar.

### Practice

Selecting an existing library problem switches to Practice. The Code Runner navigation item reopens the last selected library problem. A recommendation enters Practice only after the user chooses `Add and practice`; opening the original LeetCode page remains a separate action.

The light command bar contains:

- breadcrumb and problem title;
- LeetCode source link;
- language selector;
- local/Docker runner selector;
- run action.

Below it, a light session strip shows today's problem sequence and current step. It is hidden when the user opens a problem outside today's plan.

The desktop workspace contains:

- a collapsible light problem inspector on the left;
- a dominant opaque dark editor on the right;
- a bottom utility panel under the editor.

The bottom utility panel uses tabs for:

- custom input and expected output;
- execution result and console output;
- optional model assistance.

Execution result is the default tab after a run. The editor and console must not receive glass, blur, or translucent backgrounds.

### My Library

The library view replaces the permanently expanded old sidebar list.

It contains:

- search;
- selection mode;
- batch delete;
- import and export;
- the existing problem list with accepted counts;
- an open-in-practice action.

User-owned problems remain separate from the recommendation catalog.

### Recommendation Catalog

The catalog view uses the existing catalog API and import action.

It contains:

- imported/not-imported state;
- JSON import action;
- source, rank, difficulty, tags, and LeetCode link for each catalog item;
- `Open original` for every valid catalog item.

The catalog remains read-only apart from import. `Add and practice` belongs to today's generated plan because the existing planner action endpoint requires the slug to be present in that plan. Supporting arbitrary catalog-to-library saves would be a separate behavior change and is outside this redesign.

It must not display a working live-sync action. The existing MVP sync endpoint remains an unsupported backend boundary.

### Settings

Settings contains the existing OpenAI-compatible fields:

- API key;
- base URL;
- model;
- save action.

The API key description continues to state that it is stored locally. Local data actions can be placed below model settings with clear separation.

## State and Data Flow

The frontend adds an explicit view state:

```js
state.activeView = "today" | "practice" | "library" | "catalog" | "settings";
```

Navigation changes only presentation state. It does not refetch data unnecessarily.

Key flows:

1. Load app, fetch today's plan, and render `today`.
2. Generate or regenerate a plan using the existing API, then refresh Today.
3. Open a plan item's source link, record the `open` action, and remain on Today.
4. Choose `Add and practice`, record `add_to_practice`, refresh the library, select the saved slug, and switch to `practice`.
5. Select a library item and switch to `practice` without creating a daily-plan action.
6. Run code through the unchanged runner request and reveal the result tab.
7. When a run returns AC, update the matching problem progress and recompute today's completed count from `lastAcceptedAt`.
8. Persist workspace input, code, language, runner, and selected problem through the existing cache behavior.

Existing element IDs and request functions should be preserved where practical to reduce behavioral regression. Layout classes and container structure may change substantially.

## Responsive Behavior

### Wide Desktop: 1180px and Above

- expanded 210px function bar;
- Today uses plan plus inspector columns;
- Practice uses problem inspector plus editor;
- bottom utility panel remains visible under the editor.

### Compact Desktop and Tablet: 760px to 1179px

- function bar collapses to a stable icon rail;
- labels move to tooltips;
- Today inspector moves below the plan;
- Practice problem inspector becomes a toggleable drawer;
- editor remains the primary visible surface.

### Mobile: Below 760px

- primary navigation becomes a bottom navigation bar;
- secondary destinations move into a More menu;
- Today becomes a single-column list;
- Practice uses tabs for Problem, Code, and Result;
- command controls wrap without horizontal overflow;
- no fixed-width element may force page scrolling.

## Accessibility and Resilience

- Maintain WCAG AA contrast for text and controls.
- Provide visible keyboard focus on every interactive element.
- Support `prefers-reduced-motion`.
- Support reduced-transparency environments through opaque material fallbacks.
- Preserve labels for form controls even when visually compact.
- Use `aria-current` for active navigation and session state.
- Use `aria-live` for generation, import, run, and error status updates.
- Do not rely on color alone for AC, warning, failure, or active state.

## Error and Empty States

- Empty catalog: explain that a recommendation JSON import is required and show one import action.
- Empty daily plan: show generation controls and a single generate action.
- AI failure: render the existing fallback plan and identify it as locally generated.
- Runner unavailable: preserve the existing doctor message and recommended runner behavior.
- Empty library: provide import and extension-capture orientation without marketing copy.
- Network/model failure: retain the current error text and keep local runner features usable.

## Technical Constraints

- Continue using `web/index.html`, `web/styles.css`, and `web/app.js`.
- Do not add React, Vue, a bundler, or a runtime CDN dependency.
- Keep all visual assets local.
- Preserve server static-file behavior and all existing API contracts.
- Keep Dockerfiles and runner modules unchanged unless verification proves a UI integration defect.
- Split browser code only if doing so removes clear complexity without introducing a build step.

## Testing Strategy

### Automated

- Preserve all existing web-copy and runner tests.
- Add structural tests for the five views and grouped navigation.
- Add tests for the Today-to-Practice interaction wiring.
- Add tests that the existing daily-plan, library, run, doctor, import/export, and assist request paths remain present.
- Add CSS contract tests for opaque editor/terminal surfaces, material fallback, responsive navigation, and reduced motion.

### Browser Verification

Verify with real rendered screenshots at minimum:

- 1440x900 desktop Today;
- 1440x900 desktop Practice;
- 1024x768 compact desktop/tablet;
- 390x844 mobile Today;
- 390x844 mobile Practice.

Check that:

- no controls or text overlap;
- the editor is nonblank and correctly aligned;
- the console is visible after a run;
- navigation is operable at every breakpoint;
- glass fallback remains readable when blur is unavailable;
- keyboard focus and reduced motion work as specified.

## Acceptance Criteria

- The app opens on Today rather than the old stacked runner page.
- The function bar exposes Today, Recommendation Catalog, Code Runner, My Library, and Settings.
- Today renders the existing daily plan and regeneration controls without adding review or mistake-tracking features.
- `Open original` records the plan action and opens LeetCode without pretending the full statement is local.
- `Add and practice` saves the recommendation through the existing action, then opens the focused Practice view.
- Selecting an existing library problem opens the focused Practice view directly.
- Practice uses a light command/session layer and an opaque dark editor/console.
- Existing local and Docker execution, doctor status, custom test, result, assist, import/export, and accepted-count behavior still works.
- Recommendation catalog data and user library data remain visually and behaviorally separate.
- The UI is usable without network-loaded assets and without browser support for backdrop blur.
- Automated tests pass and the five required viewport screenshots pass visual inspection.
- Docker and runner architecture remain unchanged.
