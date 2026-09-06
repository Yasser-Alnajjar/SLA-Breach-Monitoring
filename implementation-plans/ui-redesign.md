## UI/UX Redesign Task

Redesign the entire application UI with a **modern, premium, distinctive visual system**.

### Core Stack

Use:

- **Tailwind CSS** for all styling
- **shadcn/ui** for UI primitives and components
- **Lucide React** for icons
- **Framer Motion / Motion** for animations where appropriate
- TypeScript
- Keep the existing application architecture, business logic, API integrations, routing, and functionality intact unless a UI change strictly requires otherwise.

Do **not** introduce another UI component library.

---

## Design Direction

Do NOT create a generic SaaS dashboard.

The design should feel like a **high-end 2026 product** with a strong visual identity.

Create a **new, uncommon theme** that is not the typical:

- Blue SaaS
- Purple SaaS
- Indigo SaaS
- Generic black/white dashboard
- Default ShadCN theme
- Linear clone
- Vercel clone

Use a distinctive visual language with:

- Deep, sophisticated base colors
- One unusual but controlled accent color
- Subtle gradients
- Layered surfaces
- Soft borders
- High-quality shadows
- Strong typography hierarchy
- Generous spacing
- Carefully designed empty states
- Subtle background textures/noise where appropriate
- Modern cards and panels
- Refined hover/focus states

The result should look **intentional and branded**, not like unmodified ShadCN components.

### Suggested visual direction

Explore a theme around:

**Obsidian + Electric Lime + Warm Sand**

Use dark charcoal/obsidian surfaces as the foundation, with a restrained electric-lime accent and warm neutral highlights.

Do not overuse the accent color.

The interface should remain professional and suitable for a production application.

---

## Design Principles

### 1. Visual hierarchy

Every page should have an obvious hierarchy:

1. Page context
2. Primary action
3. Important information
4. Secondary information
5. Supporting metadata

Avoid making every element visually equal.

### 2. Density

Use a balanced information density.

Avoid:

- Huge empty spaces
- Excessively compressed dashboards
- Too many cards
- Excessive rounded containers

Use spacing intentionally.

### 3. Surfaces

Create a clear surface hierarchy:

- App background
- Primary surface
- Elevated surface
- Interactive surface
- Modal/popover surface

Use subtle borders and shadows instead of heavy visual separation.

### 4. Typography

Create a strong type scale.

Use typography to communicate hierarchy instead of relying on colors.

Headings should feel confident and editorial.

Labels and metadata should be compact and understated.

---

# Components

Rework the existing UI components using shadcn/ui where appropriate.

Use components such as:

- Button
- Badge
- Card
- Dialog
- Sheet
- Dropdown Menu
- Command
- Tooltip
- Tabs
- Select
- Popover
- Calendar
- Table
- Input
- Textarea
- Skeleton
- Toast / Sonner
- Breadcrumb
- Navigation Menu

But **customize their appearance heavily** so they belong to the application's design system.

Do not simply install ShadCN and leave the default styles untouched.

---

# Navigation

Redesign the navigation system.

It should feel lightweight and modern.

Use:

- Clear active states
- Subtle motion
- Iconography
- Context-aware navigation
- Tooltips where useful
- Responsive mobile navigation

Avoid oversized traditional sidebars.

If a sidebar exists, consider a compact/dynamic version with elegant active indicators.

---

# Dashboard

Redesign dashboards around **information hierarchy**, not a grid of identical cards.

Use:

- KPI sections
- Activity streams
- Data visualization
- Status indicators
- Progress indicators
- Trend information
- Contextual actions
- Smart empty states

Important information should visually stand out.

Avoid the common:

`Card + Icon + Number + Label`

pattern being repeated 10 times.

---

# Tables

Make tables feel like part of the product rather than raw database output.

Implement:

- Clear column hierarchy
- Sticky headers when useful
- Row hover states
- Compact metadata
- Status badges
- Context menus
- Selection states
- Loading skeletons
- Empty states
- Responsive behavior

Use shadcn/ui table primitives.

---

# Forms

Forms should feel clean and focused.

Use:

- Proper field hierarchy
- Helpful descriptions
- Inline validation
- Clear error states
- Loading states
- Disabled states
- Success feedback

Avoid unnecessary card nesting.

---

# Animations

Use animations throughout the application, but keep them **subtle and purposeful**.

Use Motion/Framer Motion for:

### Page transitions

Small opacity + translate transitions.

### Component entrance

Use staggered animations for:

- Dashboard sections
- Lists
- Cards
- Navigation items

### Interaction

Add micro-interactions for:

- Buttons
- Cards
- Tabs
- Dropdowns
- Dialogs
- Navigation
- Status changes

### Data updates

Animate meaningful state changes instead of abruptly replacing content.

### Hover

Use subtle:

- Transform
- Shadow
- Border
- Opacity
- Background

transitions.

Avoid excessive bouncing, scaling, spinning, or flashy effects.

Animations should generally be:

- 150–300ms for micro interactions
- 300–500ms for larger transitions

Respect:

`prefers-reduced-motion`.

---

# Loading States

Do not use generic spinners everywhere.

Prefer:

- Skeletons
- Content placeholders
- Progressive loading
- Shimmer effects where appropriate

Loading states should preserve the final layout to prevent layout shift.

---

# Empty States

Every important empty state should be intentionally designed.

Include:

- Relevant icon/illustration
- Short explanation
- Primary action
- Optional secondary action

Do not use:

"No data found."

as the entire empty state.

---

# Responsive Design

The redesign must be fully responsive.

Support:

- Desktop
- Laptop
- Tablet
- Mobile

Do not simply shrink the desktop layout.

On mobile, rethink:

- Navigation
- Tables
- Filters
- Forms
- Dialogs
- Action menus
- Dashboard grids

Use mobile-specific interaction patterns where appropriate.

---

# Dark / Light Mode

If the application already supports themes, redesign both modes.

The visual identity must remain consistent between them.

Dark mode should NOT simply be:

`background: #000`

Use layered dark surfaces with subtle tonal differences.

---

# Accessibility

Maintain production-level accessibility.

Ensure:

- Keyboard navigation
- Focus states
- Proper semantic HTML
- ARIA where required
- Sufficient contrast
- Reduced motion support
- Screen-reader-friendly labels

Do not sacrifice accessibility for visual effects.

---

# Implementation Rules

Before changing code:

1. Inspect the existing application structure.
2. Identify the major pages and reusable components.
3. Identify duplicated UI patterns.
4. Identify the existing design tokens.
5. Identify existing Tailwind/ShadCN configuration.
6. Identify components that should become reusable primitives.

Then implement the redesign systematically.

Create or improve a centralized design system using:

- CSS variables
- Tailwind theme tokens
- Typography tokens
- Spacing tokens
- Radius tokens
- Shadows
- Animation utilities
- Color tokens

Avoid hardcoding random colors throughout components.

---

# Important

Do NOT rewrite business logic.

Do NOT change API contracts.

Do NOT remove existing functionality.

Do NOT replace working data-fetching logic simply because the UI is being redesigned.

Focus the work on:

**UX + visual design + component architecture + responsive behavior + animations.**

---

# Quality Bar

Before finishing, review every redesigned page and ask:

- Does this look like a premium product?
- Does it have a recognizable visual identity?
- Does it look different from a default ShadCN application?
- Is the hierarchy immediately obvious?
- Are interactions polished?
- Are animations purposeful?
- Does mobile feel intentionally designed?
- Are loading and empty states polished?
- Are components reusable?
- Are colors and spacing consistent?

If any page still looks like a default SaaS dashboard, redesign it again.

The final result should feel like a **cohesive product**, not a collection of independently styled pages.