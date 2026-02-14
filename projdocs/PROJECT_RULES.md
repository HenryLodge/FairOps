# Project Rules for AI Coding Agents

> These rules apply to every file you create, edit, or refactor. Follow them without exception. They exist because LLMs consistently make the same categories of mistakes — these rules prevent them.

---

## 1. Before You Write Any Code

### Understand First, Build Second
- Read ALL provided context files (PRD, architecture docs, existing code) before generating anything
- If a task is ambiguous, ask for clarification rather than making assumptions
- State your plan in 2-3 sentences before writing code. What are you building? What files will you touch? What's the expected outcome?

### Check What Already Exists
- Before creating a new file, check if a similar file already exists. Do not create duplicates.
- Before writing a utility function, check `/lib`, `/utils`, or `/helpers` for existing implementations
- Before installing a package, check `package.json` — it may already be installed
- Before creating a component, check the components directory tree for something reusable

---

## 2. File Organization

### One Responsibility Per File
- Each file does ONE thing. A file should not contain a database helper, a React component, and a utility function.
- If a file exceeds 300 lines, it almost certainly needs to be split
- API routes contain route handlers only — business logic goes in `/lib` or `/services`
- Components render UI — data fetching logic goes in hooks or parent components

### Naming Conventions
- **Components:** PascalCase → `VendorCard.jsx`, `PaymentModal.jsx`
- **Hooks:** camelCase with `use` prefix → `useAuth.js`, `useFetchEvents.js`
- **Utilities/libs:** camelCase → `formatCurrency.js`, `supabase.js`
- **API routes:** lowercase, kebab-case for multi-word directories → `route.js` inside `/api/events/[id]/`
- **Constants:** UPPER_SNAKE_CASE → `export const MAX_RETRIES = 3`
- **CSS/style files:** match their component name → `VendorCard.module.css`
- Filenames must describe their content. Never name a file `utils.js`, `helpers.js`, `stuff.js`, or `index.js` (unless it's a barrel export)

### Directory Structure Principles
- Group by feature, not by type. Put `VendorCard.jsx`, `useVendors.js`, and `vendorApi.js` near each other — not in separate `/components`, `/hooks`, `/api` trees
- Shared/reusable code lives in `/lib` (utilities, clients, configs) or `/components/ui` (generic UI primitives)
- Feature-specific code lives in feature directories
- Keep nesting to a maximum of 4 levels deep. If you're at `/app/dashboard/events/[id]/vendors/[vendorId]/payments/route.js`, you've gone too far.

---

## 3. Code Quality Rules

### Never Hardcode
- No magic numbers. Extract to named constants: `const LAMPORTS_PER_SOL = 1_000_000_000`
- No hardcoded URLs, keys, IDs, or secrets anywhere in code. Use environment variables.
- No hardcoded strings that appear more than once. Extract to constants or config objects.
- Color values, API endpoints, role names, status values — all should be constants defined in one place

### Error Handling Is Not Optional
- Every `fetch()` call must handle non-200 responses. Check `res.ok` or `res.status`.
- Every `async/await` must be in a try/catch OR have a `.catch()` handler
- Every database query must handle the error return: `const { data, error } = ...`
- Never silently swallow errors with empty catch blocks: `catch (e) {}` is FORBIDDEN
- User-facing errors should be clear and actionable: "Failed to load vendors. Click retry." not "Something went wrong."
- Log errors to console with enough context to debug: `console.error('Failed to approve vendor:', vendorId, error)`

### Null/Undefined Safety
- Always provide default values: `const vendors = data?.vendors || []`
- Check for null/undefined before accessing nested properties: `user?.profile?.name`
- Array methods on potentially-null arrays: `(items || []).map(...)` or `items?.map(...) ?? []`
- Never assume an API response has the shape you expect — validate or default

### No Dead Code
- Do not leave commented-out code blocks. If code is removed, it's removed.
- Do not create functions that are never called
- Do not import modules that are never used
- Do not create variables that are never read
- If you replace an implementation, delete the old one entirely

---

## 4. Function & Component Design

### Keep Functions Small and Focused
- A function should do one thing. If you're naming it `fetchDataAndTransformAndSave`, it needs to be three functions.
- Maximum 40 lines per function as a guideline. If longer, extract helpers.
- If a function takes more than 3 parameters, use an options object: `createEvent({ name, date, location })` not `createEvent(name, date, location, attendance, width, height)`

### Component Rules
- Components accept props, render UI, and handle user interactions. They should NOT contain business logic, data transformation, or direct API calls (use hooks for that).
- Every component that loads data asynchronously must handle three states: **loading**, **error**, and **success/data**
- Extract repeated UI patterns into shared components immediately. If you copy-paste a card layout more than once, make it a component.
- Props should have sensible defaults. A component should render something reasonable even if optional props are missing.
- Avoid prop drilling beyond 2 levels. If a deeply nested child needs data from a grandparent, use context or restructure.

### Hook Rules
- Custom hooks start with `use` — always
- A hook should encapsulate one concern: `useFetchVendors`, `useWalletConnection`, `useFormValidation`
- Hooks return consistent shapes: `{ data, error, loading, refetch }` for data hooks
- Never call hooks conditionally — this violates React's rules and creates subtle bugs

---

## 5. API & Data Patterns

### API Routes
- Every route must validate its inputs before processing. Check that required fields exist.
- Every route must verify authentication before doing anything else
- Return consistent response shapes:
  - Success: `{ data: ... }` or the resource directly
  - Error: `{ error: "Human-readable message" }` with appropriate HTTP status code
- Use correct HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)
- One endpoint per file. Do not put unrelated routes in the same file.

### Data Transformation
- Transform data in ONE place, not scattered across components. If the API returns `created_at` and you need a formatted date, create a utility function and call it consistently.
- Keep database column names as-is when passing through the API. Do not rename `booth_name` to `boothName` in the API response — it creates a translation layer that causes bugs.
- When the frontend needs a computed value (like total revenue), compute it server-side in the API response rather than making the frontend calculate it from raw data.

### State Management
- Start with local state (`useState`). Only lift state up when two sibling components need the same data.
- Do not introduce a state management library (Redux, Zustand, Jotai) unless the project explicitly requires it. For most hackathon/MVP projects, React context + local state is sufficient.
- Never store derived state. If `totalRevenue` can be computed from `vendors`, compute it — don't store it separately and risk it getting out of sync.

---

## 6. Security Rules

### Secrets
- API keys, database passwords, service role keys → environment variables ONLY
- NEVER log secrets to console, even in development
- NEVER commit `.env` files to git. The `.gitignore` must include `.env*`
- If a framework has a convention for public vs private env vars (like `NEXT_PUBLIC_` in Next.js), follow it strictly. A secret with a public prefix is exposed to every user.

### Authentication
- Verify auth on EVERY API route, even ones that seem harmless
- Never trust client-side role checks as security. They're for UI only. The real authorization happens server-side.
- Tokens belong in the `Authorization` header, not in URL query parameters, not in cookies you set manually, not in localStorage (unless the auth library specifically uses it)

### User Input
- Never trust user input. Validate type, length, and format on the server.
- Never interpolate user input into SQL queries (use parameterized queries or an ORM/client that handles this)
- Never render raw user input as HTML (XSS risk). Use the framework's built-in escaping.

---

## 7. Dependency Management

### Adding Packages
- Before installing a new package, ask: can this be done in <20 lines of code without a library? If yes, write it yourself.
- Check that the package is actively maintained (last publish <6 months ago, >1000 weekly downloads)
- Prefer well-known packages over obscure ones. If choosing between a 50-star and a 50,000-star package that do the same thing, pick the popular one.
- NEVER install multiple packages that do the same thing (e.g., both `axios` and `node-fetch`, or both `dayjs` and `moment`)

### Version Pinning
- Use the versions specified in the project docs. Do not upgrade major versions without explicit instruction.
- If a package has a known breaking change in a newer version, pin to the stable version.

---

## 8. Git & Change Management

### Commit Scope
- Each logical change is one commit. "Add vendor approval API + component" is one commit. "Fix everything" is not.
- Never mix refactoring with feature work in the same change. Refactor first, then build the feature.
- If you need to change a shared utility while building a feature, make that change first and verify nothing breaks before continuing.

### What Not to Commit
- `node_modules/` — always in `.gitignore`
- `.env` / `.env.local` — always in `.gitignore`
- Build artifacts (`dist/`, `.next/`, `build/`) — always in `.gitignore`
- OS files (`.DS_Store`, `Thumbs.db`) — always in `.gitignore`
- Lock files (`package-lock.json` or `yarn.lock`) — DO commit these, they ensure reproducible installs

---

## 9. Performance & Efficiency

### Don't Over-Engineer
- Build the simplest thing that works. No premature abstractions, no "just in case" flexibility.
- No class hierarchies. No factory patterns. No dependency injection containers. Unless the problem genuinely requires it (it almost never does for a web app).
- If you're writing a generic wrapper around something that's only used once, just use the thing directly.
- YAGNI (You Aren't Gonna Need It). If a feature isn't in the requirements, don't build infrastructure for it.

### Network Efficiency
- Prefer one API call that returns all needed data over multiple calls that each return a piece. Combine related data in a single endpoint.
- Never fetch data you don't display. If the component only shows vendor names and statuses, don't fetch full vendor objects with descriptions and payment history.
- Add loading states that appear immediately so users know something is happening, especially for operations that take >1 second.

### Rendering Efficiency
- Don't re-render components unnecessarily. If a parent re-renders, children with unchanged props shouldn't re-render. Use `React.memo` only when you've confirmed a specific performance problem — don't wrap everything preemptively.
- Lists need `key` props. Keys must be unique, stable IDs — never array indices (unless the list never reorders).
- Move expensive computations into `useMemo` only when they're actually slow. Profile first, optimize second.

---

## 10. Output Quality Checklist

Before considering any task complete, verify:

- [ ] Code runs without errors or warnings in the console
- [ ] All files are in the correct directories per the project structure
- [ ] No hardcoded values that should be constants or env vars
- [ ] Every async operation has error handling
- [ ] Every component has loading and error states
- [ ] No duplicate files, functions, or components
- [ ] No unused imports, variables, or functions
- [ ] No commented-out code blocks
- [ ] Consistent naming conventions throughout
- [ ] API routes validate inputs and check authentication
- [ ] Secrets are in environment variables, not in code

---

## 11. Communication Rules

### When You're Unsure
- Say so. "I'm not sure if this should be a separate component or part of the dashboard — here's my reasoning" is 10x better than silently making the wrong choice.
- If a task requires information you don't have (API keys, design specs, business rules), ask for it rather than inventing it.
- If you spot a conflict between project docs (PRD says one thing, architecture doc says another), flag it.

### When You Make Changes
- Explain what you changed and why in 1-2 sentences
- If you changed a shared file (lib utility, component used in multiple places), list what else might be affected
- If you couldn't complete something, explain what's left and what's blocking it

### When Things Break
- Provide the full error message, not a summary
- Identify the file and line number where the error originates
- Suggest a fix, don't just report the problem
- If a fix might have side effects, mention them
