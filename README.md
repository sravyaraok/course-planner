# Course Planner

A static, client-side college course planner / viewer. Plan courses semester-by-semester,
bucket them into areas of study (major, minors, liberal studies…), and see live credit totals
and pre-/co-requisite warnings. No server: it runs entirely in the browser and can be hosted on
GitHub Pages.

Use the course planner with some courses for Cornell University CS & ECE Majors included [https://sravyaraok.github.io/course-planner/dist/](https://sravyaraok.github.io/course-planner/dist/)

## Features

- **Grid view**: Pre-College/AP credits plus one column per semester, with one row per area of study.
  - Each semester header shows its credit total, and each area row shows its total. Both update live.
  - A cell can hold any number of courses.
  - A course can count toward several areas, but it is **displayed once**, in the row of its *primary* area (the first area in its `areas` list). Its other areas appear as coloured tags on the course. Row totals include every course that counts toward the area. A `*` marks totals that include courses displayed in another row.
  - Click an area name (◯) to **highlight** every course that counts toward it, including courses shown in other rows. All other courses are dimmed. Selecting another area replaces the previous highlight; courses shared with the new area remain highlighted. Click again, use ✕, or press Esc to clear.
- **Drag & drop**: move courses between cells, or drag a course from the course list onto the grid.
  - Dropping on a different row makes that area the course's primary area. If the course didn't already count toward that area, the new area replaces the one it was dragged from.
  - In the course dialog, **Shown in row** also sets the primary area.
- **Requisite checks**: courses with unmet requirements are highlighted, with details in the tooltip.
  - Pre-requisites must be met in a prior semester.
  - Co-requisites must be met in a prior semester or the same semester.
  - Pre-College credits are treated as already satisfied.
- **Configuration**: start semester and year, number of years, Fall/Spring always shown, optional Winter and Summer, and areas of study (add, rename, reorder, delete).
- **Create, edit, and delete**: universities, courses in a university roster, course plans, and plan entries (semester plus areas).
- **Persistence**: data is saved to `localStorage`. **Import / Export** JSON for a plan, a university roster (with courses), or the whole workspace. **Reset** reloads the sample data.

## Project layout

```
build.js                     # merges src/ + data/ into dist/
data/
  courses.json               # shared course catalog (Course objects)
  universities.json          # University rosters (reference courses by ID)
  plans/*.json               # sample CoursePlans (loaded on first run)
src/
  index.html                 # page shell; component templates are injected at build time
  app.js                     # bootstraps components
  core/                      # utils, event bus, validation, state store
  styles/base.css
  components/<name>/<name>.{html,js,css}
    app-header, plan-settings, plan-grid, course-catalog,
    course-editor, plan-course-dialog, university-manager
.github/workflows/deploy.yml # builds and deploys dist/ to GitHub Pages
```

Each component is a class registered on `window.Components['<name>']`. The build mounts it into the matching `<div data-component="<name>">`. Its `.html` file contains a `<template id="tpl-<name>">`.

## Build & run

Requires Node 18+. There are no npm dependencies.

```bash
npm run build     # -> dist/index.html, dist/app.js, dist/app.css, dist/data/
npm run watch     # rebuild on changes to src/ or data/
npm run serve     # serve dist/ on http://localhost:8080 (python3)
```

`dist/index.html` also works straight from the file system, because the sample data is inlined into `app.js`.

## Tests

Run `npm test` to build and run the browser regression test. It uses `playwright-core`
and a locally installed Google Chrome. The test checks switching between areas,
shared courses, clearing the selection, unique course display, and unchanged credit totals.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (default branch `main`).
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/`.

## Data formats

**Course** (in `data/courses.json`):

```json
{ "id": "CS 3110", "name": "Data Structures & Functional Programming", "description": "…",
  "prerequisites": [["CS 2110"], ["CS 2800"]],
  "corequisites": [],
  "credits": 4 }
```

`prerequisites` and `corequisites` are lists of sets. The student needs at least one course from **each** set. For example, `[["CS 1110","CS 1112"],["MATH 1910"]]` means (CS 1110 or CS 1112) and MATH 1910. In the course editor, write one set per line with alternatives separated by commas.

**University roster**:

```json
{ "universityId": "sample-u", "universityName": "Sample University", "courses": ["CS 1110", "CS 2110"] }
```

The university export also includes a `courseCatalog` array with the full course objects, so the file is self-contained.

**Course plan**:

```json
{ "planId": "plan-cs-major", "planName": "CS Major", "universityId": "sample-u",
  "startSemester": "Fall 2026", "years": 4, "showWinter": false, "showSummer": false,
  "areasOfStudy": ["Math", "CS Major", "Liberal Studies"],
  "courseList": [
    { "courseId": "MATH 1910", "semester": "PRE", "areas": ["Math"] },
    { "courseId": "CS 2110", "semester": "Fall 2026", "areas": ["CS Major"] }
  ] }
```

Semesters are `"<Term> <Year>"`, where Term is `Fall`, `Winter`, `Spring`, or `Summer`. Use `"PRE"` for pre-college or AP credit.

**Workspace export**: `{ "courses": [...], "universities": [...], "plans": [...] }`.

Import accepts any of these formats and merges the data by ID.

Course IDs are shared across universities, so editing a course updates it for every university that lists it in its roster.
