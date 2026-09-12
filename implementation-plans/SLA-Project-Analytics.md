Implement a **Project Analytics** section on the SLA Project page.

### Goal

Add a small, focused analytics dashboard that gives users an immediate view of SLA health and where breaches are happening.

Do **not** turn the page into a generic BI dashboard. Keep it operational, clean, and consistent with the existing product UI.

### Charts to add

Add exactly these 3 analytics views:

#### 1. SLA Compliance

Show the overall distribution of cases:

- Met SLA
- At Risk
- Breached

Use the most appropriate existing chart component/library already used in the project. A donut/pie chart is preferred if it fits the current design.

Display the total case count and percentages clearly.

#### 2. SLA Breaches Over Time

Add a line chart showing the number of SLA breaches over time.

Requirements:

- Use the actual project/case data.
- Respect the currently selected project.
- Group breaches by day.
- Do not hardcode or mock data.
- Use the existing project date/time conventions.
- If the project has no breach data, show a proper empty state instead of an empty/broken chart.

If the project already has date-range/filter controls, integrate with them rather than introducing a second independent filtering system.

#### 3. Breaches by Stage

Add a bar chart showing where SLA breaches are occurring.

Use the existing domain stages, for example:

- Support
- Engineering
- Waiting Customer
- Other stages already supported by the domain

Do not invent new stages.

Sort the bars by breach count descending.

### Data / backend

Before implementing UI, inspect the existing domain model, Prisma schema, server actions, repositories, and existing project/case queries.

Reuse existing data-fetching patterns wherever possible.

Do not introduce React Query or another client-side data-fetching layer.

Prefer server-side aggregation/querying rather than downloading every case to the browser and calculating analytics client-side.

Create dedicated server-side queries/actions only if the existing queries cannot provide the required aggregates.

The analytics must be scoped to the current project.

Do not change existing SLA calculation/correlation behavior.

Do not modify webhook processing, normalization, SLA evaluation, or case-linking logic unless absolutely required to expose existing data.

### UI placement

Add the analytics section to the existing Project page without disrupting the current case workflow.

Recommended structure:

1. Existing project header / summary
2. Existing KPI cards
3. **SLA Analytics**
   - SLA Compliance
   - Breaches Over Time
   - Breaches by Stage
4. Existing cases/content

Keep the charts visually subordinate to the primary project information.

Use the existing:

- shadcn/ui components
- Tailwind conventions
- typography
- spacing
- cards
- dark/light theme
- icons
- responsive breakpoints

Do not introduce a new visual language.

### Responsive behavior

Desktop:

- Compliance + Breaches by Stage can sit side-by-side.
- Breaches Over Time can use the full available width.

Mobile:

- Stack all charts vertically.
- Charts must remain readable without horizontal scrolling.

### Loading / empty / error states

Every chart needs:

- loading state
- empty state
- error state

Do not render broken chart containers when there is no data.

For empty analytics, use the existing EmptyState pattern/component if one already exists.

### Important implementation constraints

- No mock data.
- No hardcoded metrics.
- No duplicated SLA business logic.
- Reuse existing domain types.
- Reuse existing server-side data access patterns.
- Keep the implementation reasonably modular.
- Do not perform a large unrelated refactor.
- Do not rename existing components/files unless necessary.
- Preserve all existing Project page behavior.

### Performance

Avoid fetching the entire case dataset just to render charts.

Prefer aggregated queries such as:

- SLA status counts
- breach counts grouped by date
- breach counts grouped by stage

If multiple independent analytics queries are required, execute them in parallel on the server where appropriate.

Avoid N+1 queries.

### Validation

After implementation:

1. Run TypeScript/typecheck.
2. Run lint.
3. Run the relevant tests.
4. Verify the Project page with:
   - normal data
   - no cases
   - no breaches
   - multiple stages
   - large case counts
   - light mode
   - dark mode
   - mobile layout

### Final output

When finished, report:

- files changed
- data/query changes
- UI changes
- tests/typecheck/lint results
- any assumptions or limitations

Do not stop at the UI mockup. Implement the complete feature end-to-end using the existing project architecture.