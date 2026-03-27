# Phase 2: React App Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 2-React App Shell
**Areas discussed:** Component structure, Split-pane behavior, Settings panel design

---

## Component Structure

### Layout Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Header + Tab Bar + Content Area (Recommended) | Fixed header with app title/theme toggle, tab bar below, content area fills remaining space | ✓ |
| Sidebar navigation + Content | Vertical sidebar with tab icons, content area on right | |
| You decide | Claude picks based on existing design | |

**User's choice:** Header + Tab Bar + Content Area, with settings and debug button moved to top bar, consistent progress bar near top, and common layout for generate/revise buttons at the top.

### Panel Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Shared split-pane, tab switches left panel content | One split-pane layout, left panel shows Create or Edit form | ✓ |
| Separate layouts per tab | Each tab has its own layout | |
| You decide | | |

**User's choice:** Shared split-pane, tab switches left panel content

### Library Drawer

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-out drawer (current behavior) | Opens as sliding panel from side, toggle in header | ✓ |
| Dedicated tab | Library becomes its own tab | |
| You decide | | |

**User's choice:** Slide-out drawer (current behavior)

---

## Split-Pane Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| react-resizable-panels (Recommended) | Lightweight (~3KB), well-maintained, VS Code web uses it | ✓ |
| allotment | Similar to VS Code split panes, larger bundle | |
| Custom implementation | Hand-roll with CSS/mouse events | |
| You decide | | |

**User's choice:** react-resizable-panels

---

## Settings Panel Design

### Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/overlay (Recommended) | Opens as modal, keeps it out of tab flow | ✓ |
| Keep as a tab | Settings remains a tab alongside Create/Edit | |
| Slide-out panel | Slides in from the right like a drawer | |

**User's choice:** Modal/overlay

### Save Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save on change (current) | Each field saves immediately when changed | |
| Explicit save button | User clicks Save to apply, Cancel discards | ✓ |
| You decide | | |

**User's choice:** Explicit save button

---

## Gray Areas Not Discussed

- **CSS migration approach** — user did not select (Claude's discretion)

## Claude's Discretion

- CSS migration strategy (global → incremental extraction to CSS Modules)
- Component file naming and directory structure
- Progress bar implementation
- Keyboard navigation
- Split-pane collapse behavior

## Deferred Ideas

None
