# Phase 4: Export, Library + Full Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29

---

## Area: Library Drawer

**Q: How is content organized inside the library drawer?**
- Options: Tabs (Cards/Prompts), Single unified list, Two separate sections
- Selected: *User clarified* — "I think we had previously decided not to save prompt templates. I think we only need to save cards."
- **Decision:** Cards-only library. Prompt template UI not implemented.

**Q: How should cards be listed in the drawer?**
- Options: Simple list (name + date), List with quality score, Search + list
- Selected: "Search + list, include tags in search and show several tags that fit in the box. Include quality score if we've recorded one."
- **Decision:** Search input filters by name and tags. Each row shows name, date, visible tags, quality score if present.

**Q: When you click a saved card in the drawer, what should happen?**
- Options: Load immediately, Preview first then load, Load + ask about current work
- Selected: "Load + ask about current work"
- **Decision:** If unsaved changes exist, prompt "Discard current character?" before loading.

**Q: What card history/diff actions are available?**
- Options: History button per card (show commit list), Inline diff only, History in separate panel
- Selected: "History button per card — show commit list (Recommended)"
- **Decision:** History button per row → modal with commit list → select two commits → field-by-field diff.

---

## Area: Export Flow

**Q: Where do the Save / Download buttons live?**
- Options: ActionBar, CharacterEditor top bar, Both (split)
- Selected: "ActionBar — alongside Generate/Evaluate (Recommended)"
- **Decision:** Save, Download JSON, Download PNG all in ActionBar.

**Q: Is saving to library and downloading separate actions?**
- Options: Separate (independent), Save always downloads too, Save then prompt to download
- Selected: "Separate: Save and Download are independent (Recommended)"
- **Decision:** Three independent buttons. No forced coupling.

---

## Area: Image Generation

**Q: Where does the generated avatar image appear?**
- Options: Top of CharacterEditor, Left panel, Floating modal
- Selected: "Right of CharacterEditor" (user noted they want an RPG character sheet layout)
- User provided mockup showing: portrait top-right, compact fields + buttons top-left, large fields full-width below.

**Q: How is the image placeholder shown and generation triggered?**
- Options: Empty frame with button inside, No placeholder until character exists, Custom prompt input + button
- Selected: "Placeholder image, with file upload / (re)generate buttons to the left where the ??? was on my layout image."
- **Decision:** Upload + Generate buttons in left column (compact fields area). Portrait placeholder always visible in top-right.

**Q: Which fields in the compact top-left section?**
- Options: Name/Tags/Creator Notes, Name/Tags/Creator Notes/System Prompt, Name only
- Selected: "Name, Tags, Creator Notes (Recommended)"
- **Decision:** Header-area fields: Name, Tags, Creator Notes. All other fields full-width below.

---

## Area: Lorebook Editor

**Q: Where does the lorebook editor live in the layout?**
- Options: Collapsible section below fields, Separate tab in right panel, Dedicated drawer/modal
- Selected: "Separate tab in the right panel"
- **Decision:** Lorebook tab in right panel, only active when a character exists.

**Q: How are lorebook entries displayed and edited?**
- Options: Expandable rows inline, Flat list always expanded, Edit in modal
- Selected: "Expandable rows — click to expand inline (Recommended)"
- **Decision:** Collapsed list → click to expand → in-place edit.

**Q: How is lorebook auto-generation triggered?**
- Options: Single button replaces all, Single button appends, Both buttons
- Selected: "Single button replaces all 'unlocked' entries."
- **Decision:** Generate replaces unlocked entries. Per-entry lock buttons, same pattern as character fields.

**Q: Where does the Generate Lorebook button live?**
- Options: Inside Lorebook tab at top, ActionBar, Inside Lorebook tab at bottom
- Selected: "Inside the Lorebook tab, at the top (Recommended)"

**Q: What per-entry fields does a lorebook entry have?**
- Options: Keys + Content + enabled toggle, Keys + Content only, Keys + Content + Comment + Priority
- Selected: "Keys + Content + Comment + Priority"
- **Decision:** Full SillyTavern spec: Keys, Content, Comment, Priority, enabled toggle, lock button.
