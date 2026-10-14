# <Screen Name> — Repository Inspection

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Small-slice manifest | `docs/frontend/screens/<screen-id>/small-slice-manifest.json` |
| Repository root | `<repository-root>` |
| Application package | `<application-package>` |
| Status | `draft` |
| Last updated | `<YYYY-MM-DD>` |

---

## 1. Purpose

This document records the actual repository architecture before representative-slice implementation.

It prevents:

- silent package-manager changes;
- parallel routing;
- duplicate component systems;
- alternate styling systems;
- unapproved dependency installation;
- temporary application packages;
- incorrect test commands;
- assumptions based only on the default stack.
- global overrides created because selector ownership was not traced.

## Styling authority

| Field | Evidence |
|---|---|
| Primary styling mechanism | `<Tailwind, CSS Modules, CSS-in-JS, legacy global CSS, or other approved mechanism>` |
| Configuration/import authority | `<paths>` |
| Token/theme authority | `<paths>` |
| Canonical component sources | `<paths>` |
| Global stylesheets and allowed roles | `<paths and roles>` |
| Existing class ownership sampled | `<usage -> definition -> owner evidence>` |
| Parallel or conflicting styling paths | `<none or findings>` |
| Styling-authority contract | `docs/frontend/styling-authority.json` |

---

## 2. Environment

| Field | Value |
|---|---|
| Operating system | `<Linux distribution and version>` |
| Shell | `<Shell and version>` |
| Node.js | `<Version>` |
| Corepack | `<Version or unavailable>` |
| Git root | `<Path>` |
| Current branch | `<Branch>` |
| Working tree state | `<Clean or summary of existing changes>` |

Suggested inspection commands:

```bash
set -euo pipefail

printf 'Working directory: %s\n' "$(pwd)"
uname -a
node --version
npm --version 2>/dev/null || true
corepack --version 2>/dev/null || true
git rev-parse --show-toplevel
git branch --show-current
git status --short
```

Do not modify or clean existing user changes during inspection.

---

## 3. Repository structure

| Concern | Finding | Evidence |
|---|---|---|
| Single package or monorepo | `<Finding>` | `<Path or file>` |
| Workspace system | `<Finding>` | `<Path or file>` |
| Frontend application package | `<Finding>` | `<Path>` |
| Additional applications | `<Finding>` | `<Paths>` |
| Shared packages | `<Finding>` | `<Paths>` |
| Documentation location | `<Finding>` | `<Path>` |

Suggested commands:

```bash
find . \
  -maxdepth 3 \
  -type f \
  \( \
    -name package.json \
    -o -name pnpm-workspace.yaml \
    -o -name turbo.json \
    -o -name nx.json \
    -o -name lerna.json \
  \) \
  -print
```

Avoid recursive output of dependency or build directories.

Example exclusion:

```bash
find . \
  \( \
    -path './node_modules' \
    -o -path './.git' \
    -o -path './dist' \
    -o -path './build' \
  \) \
  -prune \
  -o \
  -maxdepth 4 \
  -type f \
  -name package.json \
  -print
```

---

## 4. Package-manager authority

| Signal | Value |
|---|---|
| `packageManager` field | `<Value or absent>` |
| `package-lock.json` | `<Path or absent>` |
| `npm-shrinkwrap.json` | `<Path or absent>` |
| `pnpm-lock.yaml` | `<Path or absent>` |
| `yarn.lock` | `<Path or absent>` |
| `bun.lock` or `bun.lockb` | `<Path or absent>` |
| CI package-manager command | `<Command>` |
| Documentation command | `<Command>` |
| Authoritative decision | `<npm, pnpm, yarn, bun, other>` |
| Authority rationale | `<Rationale>` |

Suggested command:

```bash
find . \
  \( \
    -path './node_modules' \
    -o -path './.git' \
  \) \
  -prune \
  -o \
  -type f \
  \( \
    -name package-lock.json \
    -o -name npm-shrinkwrap.json \
    -o -name pnpm-lock.yaml \
    -o -name yarn.lock \
    -o -name bun.lock \
    -o -name bun.lockb \
  \) \
  -print
```

Stop when package-manager signals conflict and repository authority cannot be established.

---

## 5. Package scripts

| Command purpose | Script | Package | Verified |
|---|---|---|---|
| Install | `<Command>` | `<Package>` | `<Yes or No>` |
| Development | `<Command>` | `<Package>` | `<Yes or No>` |
| Build | `<Command>` | `<Package>` | `<Yes or No>` |
| Typecheck | `<Command>` | `<Package>` | `<Yes or No>` |
| Lint | `<Command>` | `<Package>` | `<Yes or No>` |
| Unit tests | `<Command>` | `<Package>` | `<Yes or No>` |
| Storybook | `<Command or unavailable>` | `<Package>` | `<Yes or No>` |
| Browser tests | `<Command or unavailable>` | `<Package>` | `<Yes or No>` |

Portable script inspection:

```bash
node --input-type=module <<'NODE'
import fs from "node:fs";

const file = process.argv[1] ?? "package.json";
const value = JSON.parse(fs.readFileSync(file, "utf8"));

console.log(JSON.stringify({
  name: value.name ?? null,
  packageManager: value.packageManager ?? null,
  scripts: value.scripts ?? {}
}, null, 2));
NODE
```

When inspecting another package:

```bash
node --input-type=module - \
  "apps/web/package.json" <<'NODE'
import fs from "node:fs";

const file = process.argv[2];
const value = JSON.parse(fs.readFileSync(file, "utf8"));

console.log(JSON.stringify({
  name: value.name ?? null,
  packageManager: value.packageManager ?? null,
  scripts: value.scripts ?? {}
}, null, 2));
NODE
```

---

## 6. Framework and build

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| React version | `<Finding>` | `<Package>` | `<Decision>` |
| TypeScript version | `<Finding>` | `<Package>` | `<Decision>` |
| Build system | `<Vite, Next.js, other>` | `<File>` | `<Decision>` |
| Module format | `<ESM, CJS, mixed>` | `<File>` | `<Decision>` |
| Import aliases | `<Finding>` | `<File>` | `<Decision>` |
| Environment variables | `<Finding>` | `<Files>` | `<Decision>` |
| Code splitting | `<Finding>` | `<Files>` | `<Decision>` |

Do not introduce Vite when an existing viable application uses another approved system.

---

## 7. Routing

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| Router | `<Finding>` | `<Package or path>` | `<Decision>` |
| Route definition | `<Finding>` | `<Path>` | `<Decision>` |
| Route loaders | `<Finding>` | `<Path>` | `<Decision>` |
| Error boundaries | `<Finding>` | `<Path>` | `<Decision>` |
| Authentication guard | `<Finding>` | `<Path>` | `<Decision>` |
| Permission guard | `<Finding>` | `<Path>` | `<Decision>` |
| Target route ownership | `<Finding>` | `<Path>` | `<Decision>` |

The representative slice must use the real route boundary.

---

## 8. Styling and design tokens

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| Styling system | `<Tailwind, CSS Modules, other>` | `<Files>` | `<Decision>` |
| Tailwind version | `<Finding>` | `<Package>` | `<Decision>` |
| Token source | `<Finding>` | `<Path>` | `<Decision>` |
| Theme handling | `<Finding>` | `<Path>` | `<Decision>` |
| Typography | `<Finding>` | `<Path>` | `<Decision>` |
| Global styles | `<Finding>` | `<Path>` | `<Decision>` |
| Raw-value policy | `<Finding>` | `<Evidence>` | `<Decision>` |

Do not create a parallel token system inside the feature.

---

## 9. Component architecture

| Layer | Existing path | Naming convention | Slice decision |
|---|---|---|---|
| Primitives | `<Path>` | `<Convention>` | `<Reuse decision>` |
| Shared composites | `<Path>` | `<Convention>` | `<Reuse decision>` |
| Feature components | `<Path>` | `<Convention>` | `<Decision>` |
| Screen components | `<Path>` | `<Convention>` | `<Decision>` |
| Story files | `<Path>` | `<Convention>` | `<Decision>` |
| Test files | `<Path>` | `<Convention>` | `<Decision>` |

Record equivalent existing responsibilities before creating a new component.

---

## 10. Data and server state

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| Query library | `<Finding>` | `<Package or path>` | `<Decision>` |
| Query-client setup | `<Finding>` | `<Path>` | `<Decision>` |
| Query-key ownership | `<Finding>` | `<Path>` | `<Decision>` |
| Transport client | `<Finding>` | `<Path>` | `<Decision>` |
| Runtime validation | `<Finding>` | `<Path>` | `<Decision>` |
| DTO types | `<Finding>` | `<Path>` | `<Decision>` |
| Mappers | `<Finding>` | `<Path>` | `<Decision>` |
| Frontend models | `<Finding>` | `<Path>` | `<Decision>` |
| Error normalization | `<Finding>` | `<Path>` | `<Decision>` |

Do not parse transport responses directly inside the screen component.

---

## 11. Forms and mutations

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| Form library | `<Finding>` | `<Package>` | `<Decision>` |
| Schema validation | `<Finding>` | `<Package or path>` | `<Decision>` |
| Form-component setup | `<Finding>` | `<Path>` | `<Decision>` |
| Mutation ownership | `<Finding>` | `<Path>` | `<Decision>` |
| Error mapping | `<Finding>` | `<Path>` | `<Decision>` |
| Invalidation | `<Finding>` | `<Path>` | `<Decision>` |
| Unsaved-change handling | `<Finding>` | `<Path>` | `<Decision>` |

Use `not applicable` only when the slice genuinely contains no form or mutation behavior.

---

## 12. Authentication and authorization

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| Authentication provider | `<Finding>` | `<Path>` | `<Decision>` |
| Session source | `<Finding>` | `<Path>` | `<Decision>` |
| Permission source | `<Finding>` | `<Path>` | `<Decision>` |
| Tenant or scope source | `<Finding>` | `<Path>` | `<Decision>` |
| Route protection | `<Finding>` | `<Path>` | `<Decision>` |
| Action protection | `<Finding>` | `<Path>` | `<Decision>` |

Frontend permission treatment remains descriptive.

Backend authorization remains authoritative.

---

## 13. Testing and evidence tooling

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| Unit-test runner | `<Finding>` | `<Package or config>` | `<Decision>` |
| Component testing | `<Finding>` | `<Package or config>` | `<Decision>` |
| Storybook | `<Finding>` | `<Config>` | `<Decision>` |
| Browser tests | `<Finding>` | `<Config>` | `<Decision>` |
| Accessibility tooling | `<Finding>` | `<Config>` | `<Decision>` |
| Screenshot tooling | `<Finding>` | `<Config>` | `<Decision>` |
| Visual regression | `<Finding>` | `<Config>` | `<Decision>` |

Do not claim unavailable tools exist.

Record missing tooling as:

- blocker;
- approved manual evidence;
- or explicit setup work.

---

## 14. CI and repository gates

| Concern | Finding | Evidence | Slice decision |
|---|---|---|---|
| CI provider | `<Finding>` | `<Path>` | `<Decision>` |
| Build command | `<Finding>` | `<Path>` | `<Decision>` |
| Typecheck gate | `<Finding>` | `<Path>` | `<Decision>` |
| Lint gate | `<Finding>` | `<Path>` | `<Decision>` |
| Test gate | `<Finding>` | `<Path>` | `<Decision>` |
| Browser gate | `<Finding>` | `<Path>` | `<Decision>` |
| Artifact retention | `<Finding>` | `<Path>` | `<Decision>` |

The slice does not modify CI unless CI integration is explicitly in scope.

---

## 15. Existing changes

Record existing repository changes before implementation.

```bash
git status --short
```

| Path | Existing status | Related to slice | Handling |
|---|---|---|---|
| `<Path>` | `<Modified, untracked, deleted>` | `<Yes or No>` | `<Preserve, inspect, coordinate>` |

Do not overwrite unrelated user work.

---

## 16. Migration assessment

| Migration area | Required | Approved | Reason |
|---|---|---|---|
| Package manager | `<Yes or No>` | `<Yes or No>` | `<Reason>` |
| Router | `<Yes or No>` | `<Yes or No>` | `<Reason>` |
| Styling | `<Yes or No>` | `<Yes or No>` | `<Reason>` |
| Components | `<Yes or No>` | `<Yes or No>` | `<Reason>` |
| Query layer | `<Yes or No>` | `<Yes or No>` | `<Reason>` |
| Form layer | `<Yes or No>` | `<Yes or No>` | `<Reason>` |
| Testing | `<Yes or No>` | `<Yes or No>` | `<Reason>` |

Any required but unapproved migration blocks the slice.

---

## 17. Repository-inspection decision

### Authoritative package manager

`<Decision>`

### Authoritative application package

`<Decision>`

### Existing architecture to preserve

- `<Architecture decision>`

### Existing components to reuse

- `<Component>`

### Existing commands to use

- `<Command>`

### Required setup work

- `<Setup item or none>`

### Blocking conflicts

- `<Conflict or none>`

### Inspection status

`<blocked, ready, approved>`

Implementation may proceed only when status is `approved`.
