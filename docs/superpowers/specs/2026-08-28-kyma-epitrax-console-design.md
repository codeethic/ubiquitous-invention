# EpiTrax Maintenance Console — Design

**Date:** 2026-08-28
**Status:** Approved for implementation
**Output:** `docs/kyma/index.html` — one self-contained page, published at `/kyma/`

## Purpose

Kyma Technologies grows compound-semiconductor crystals (AlN, GaN, Ga₂O₃) on a
floor of HVPE and PVD reactors. Their maintenance records live in two aging
systems, KymaNet and EpiTrax, and their users wrote three decks describing what
they want instead.

This POC is an operational-tool concept built from those decks: a working-shaped
prototype, seeded with plausible data, that shows what the proposed maintenance
and spare-parts system feels like to use. It is a concept artifact, not a
production system.

### Source material

| Deck | Contributes |
| --- | --- |
| `Maintenance-SpareParts_20260211.pptx` | The whole feature spec. 23 slides, written by the users. Screen-by-screen. |
| `Epitrax System Notes 03.04.2026.pptx` | Why the current data model hurts. Drives the event-sourced design below. |
| `Epitrax Object Notes 04.23.2026.pptx` | Wafer object model. Out of scope here; a candidate for a second POC. |

The decks are internal Kyma material and must never publish. `_config.yml`
excludes `kyma/documentation`.

## The thesis

The maintenance deck asks for three things that all fall out of one decision:

1. Health that rolls **up** — an issue on a mass-flow controller should be
   visible on the gas panel, and on the tool, and on the floor plan.
2. History that survives editing — the System Notes deck's central complaint.
3. Time travel — "turn back the date in the upper left to see what the tool
   looked like at a given point in time."

Model the system as an **append-only event log over stable synthetic IDs** and
all three are consequences rather than features. That is the argument this POC
exists to make.

## Data model

### Entities

Entities carry an opaque `id`. Names are attributes — editable, never keys.
This is the direct answer to the System Notes findings that *"most primary keys
are the names, so it limits editing capabilities"* and that relationship tables
keyed on `Name + ChangeDate` make editing error-prone.

| Entity | Notes |
| --- | --- |
| `tool` | GaN 09/11/12/13/16, MOCVD, K-Furnace, PVD 2/4/5 |
| `subsystem` | Belongs to a tool. Some have their own view, some do not. |
| `component` | A *slot* on a tool or subsystem — "GaN 11 O₂ MFC". Persistent. |
| `item` | A *serialized physical object* that occupies a slot. Moves between slots, storage, and repair. |
| `partNumber` | Kyma PN, with a compatibility list of components it may fill. |
| `location` | Storage bin, tool, repair vendor, on-order. |

The `component` / `item` split is the one modelling decision worth defending: the
deck repeatedly distinguishes "part/component" from "item", most explicitly in
the overview slide's hierarchy (`Part/Component … GaN 11 O2 MFC` versus
`Item … 200sccm O2 MFC Serial #: XXXXXXX`). A component is a socket; an item is
a thing with a serial number that plugs into it. Issue history attaches to both,
by different rules — see below.

### Events

Nothing is ever mutated. Every event carries `id`, `at`, `by`, `targetId`, and a
payload.

```
issue.opened     issue.commented   issue.closed
wo.opened        wo.commented      wo.closed
item.installed   item.removed      item.shipped     item.received
state.changed    comment.added
```

`by` is populated on every event, answering the deck's note that *"created by
and date [are] missing in several areas."*

### Derived views

Every screen is a pure function of the log:

- `stateAt(events, date)` — entity state as of a timestamp.
- `healthOf(entityId, date)` — green / amber / red, rolled up through children.
- `logFor(entityId, range)` — the merged timeline for one entity.
- `changesBetween(entityId, from, to)` — what swapped, for the time-travel diff.

These are the tested units.

### Issue attachment rule

From the part/component slide: *"if an issue exists or a maintenance on a
part/component is conducted, and the item is installed at that component, then
that event should also be tied to that item."*

So an issue is raised against a **component**, and additionally resolves onto
whichever **item** was installed there at that moment. The item carries the event
with it when it moves. This is why the log is the source of truth: "which item
was in this slot on 12 December" is a query, not a stored field.

## Screens

Breadcrumb navigation across the top; every level is reachable from every other.

### 1. Home — maintenance reporting

Per the deck's "maintenance focused reporting home screen": spares below
threshold, PMs coming due, items out for repair. Every row drills into the spine.

### 2. Facility

The floor as a set of tool tiles, colour-coded by health. Clicking a tool opens
the tool view.

**Drawn as SVG, not the deck's floorplan image.** The POC needs tool positions,
not their building's architecture; an SVG also themes correctly on dark. This is
a deliberate divergence from the source deck.

### 3. Tool — GaN 11

Reproduces the deck's slide-18 mockup: two columns of subsystem and component
buttons flanking a render of the reactor, a "whiteboard" panel on the left, and
action buttons.

- **Left whiteboard:** build size, build #, charge code, dopant chemical and
  concentration, rod height, base pressure, source serial #, estimated Ga level,
  idle temps, open issues, latest comment.
- **Left button column:** Gas Panel, Controls, Electric, Water Manifold,
  Convectron, Baratron, Top Flange, Bottom Flange.
- **Right button column:** Precursors, Quartz, Furnace Assembly, Trap Assembly,
  Throttle Valve, Dry Pump.
- **Lower centre:** Rotation, Lift.
- **Actions:** Rebuild, Refill, Report Issue, Record Maintenance, View Log.

Buttons route to a subsystem view or straight to a component view, per the deck.
Hovering a subsystem lists the components inside it.

**Background:** the reactor CAD render lifted from the deck, embedded as a
base64 data URI. It is a 502×512 RGBA PNG with a transparent background, so it
sits on the dark theme without treatment.

### 4. Subsystem — GaN 11 Gas Panel

Reproduces slide 19. Twelve MFC lines, each showing its gas label and installed
size, grouped by the channel the gas flows in:

| Channel | Lines |
| --- | --- |
| Ga Run | HCl High, HCl Low, N₂ [Ga], H₂ |
| Outer Diluent | N₂ [OD] |
| Inner Diluent 1 | SiH₄, N₂ [ID1] |
| O₂ Run | O₂, N₂ [O₂] |
| Inner Diluent 2 | HCl ID, N₂ [ID2] |
| Dump Tube | N₂ [Dump] |

Empty panel slots render greyed rather than hidden, per the deck's note that the
panel has spare capacity. Report Issue and Record Maintenance act at the
subsystem level. The date control re-derives MFC sizes as they were.

### 5. Component — Throttle Valve, O₂ MFC

Currently-installed item with its Kyma PN and serial number, open issues and WOs
with inline close, and the full component log. Actions: Report Issue, Record
Maintenance, Replace Component. Clicking a serial number opens the item view.

### 6. Item

One serialized object across its whole life: every slot it has occupied, every
tool it has lived on, its maintenance history, shipping and repair events.

### 7. Spares

Inventory search. Filter by part number, component compatibility, location, and
stock level. Low-stock warnings. Out-for-repair tracking.

### 8. Cross-tool history

The deck's own example: *"see history for all Throttle Valves on all HVPE
tools."* Pick a component type, pick a set of tools, get a merged timeline.

## Interactions

### Report Issue

The slide-8 fork: "Would you like to open a new issue?" → Yes opens a new-issue
box, No lists open issues with comment and close on each. **Put-tool-down is not
pre-selected**, per the deck's explicit note.

### Record Maintenance

The flow the users drew most carefully, from slide 9:

1. "Record new maintenance?" → Yes gives title + description; No shows the log.
2. Saving opens a work order against the current level and closes it with the
   description as the completion comment.
3. Then: "Would you like to close any open issues?" → pick from a list → the
   issue closes with an auto-generated comment naming the WO → "close another?"
   → loop until done.

An issue may be associated with more than one WO.

### Replace Component

Dropdown of items compatible with this component, **sorted in-storage first**,
then on-another-tool, then on-order with lead time — the deck is specific about
that ordering. Prompts for where the removed item goes: storage, repair, another
tool, scrap. Removing without installing a replacement is supported.

### MFC Selector

MFCs have no compatibility list, so they get their own selection screen. Filters
combine with AND across categories and support ranges:

- **Type:** 1100, 1400, G-series, black, green
- **Calibrated gas:** N₂, Ar, NH₃, O₂, H₂, CH₄
- **Size:** sccm range

### Time travel

A date control on the tool and subsystem views. Scrubbing back re-derives the
whole view from the log: issues open at that date, items installed at that date,
MFC sizes at that date. Components changed between the selected date and today
are marked. A "changed since" strip lists the swaps.

When the date is not today, a DeLorean appears in the background — the deck asks
for this by name, and it signals "you are looking at the past" better than a
banner would.

## Seed data

Roughly 18 months of history across GaN 11, deterministic, no randomness, so the
page renders identically every load. Vocabulary follows the real tool-log
screenshot in the deck: run IDs like `AG5948`, work orders like `M00189`, growth
runs like `23-AFRL-Ga2O3`, wafers like `D5409-01`, boules like `KT0001`.

The log view matches the screenshot's four columns — StartDate, Info, Details,
Comment — with rows tinted by kind: runs plain, maintenance WOs blue, issues
purple, state changes red.

## Persistence

Seed data is a frozen fixture. Actions taken in the browser append to a
user-event log in `localStorage` under `epitrax-poc-v1`, layered over the seed at
read time. A Reset control clears it. The seed is never written to, so the
demo can always be returned to a known state.

## Colour

From the deck's own shape fills:

| State | Colour |
| --- | --- |
| Up, no issues | `#00B050` |
| Up, open issue or WO | `#FFC000` |
| Down, decommissioned, qual, or PM | `#C00000` |

Green and amber are lifted from the deck's own shape fills; red is unspecified
there, so it takes the matching PowerPoint standard red.

The deck maps four distinct states onto red — down, decommissioned, qual, and
PM. Colour alone would lose that, so a tool tile also carries its state as a
text label. The colour is the glance; the label is the answer.

Dark theme, tuned to the existing `bite7` console so the two POCs read as
siblings.

## Depth

The deck says: *"try to be as complete as possible for one tool and one
subsystem (GaN 11)."* Followed literally.

- **Deep:** GaN 11 — all subsystem buttons, the gas panel fully built, Throttle
  Valve and O₂ MFC as complete component views.
- **Shallow:** GaN 09/12/13/16, MOCVD, K-Furnace, PVD 2/4/5 appear on the
  facility view with live health and a tool log, but no schematic. This is
  labelled in the UI rather than disguised.

## Out of scope

Named here so their absence reads as a decision:

- Ordering and receiving workflow, including pre-receiving and lead times beyond
  the replacement dropdown's display
- Admin screens for editing part numbers, compatibility, locations, gas panels
- Standard-maintenance instruction sheets and data collection
- The Ga level tracker
- A PM reminder engine — home-screen PMs are seeded, not computed
- Authentication
- Everything in the Object Notes deck (wafer genealogy)

## Testing

The page is self-contained, so there is no `node:test` runner. Instead the pure
functions carry an in-page assertion harness at `?test=1`, which runs the suite
and renders pass/fail. Covered:

- `stateAt` returns the correct installed item for a date before, between, and
  after swaps
- `healthOf` rolls an issue on a component up to subsystem, tool, and facility
- `healthOf` returns to green when the last open issue closes
- Replacement candidates sort in-storage before on-tool before on-order
- MFC filters combine with AND across categories and respect size ranges
- Closing an issue through Record Maintenance links it to the WO
- An event on a component attaches to the item installed at that moment, and not
  to an item installed later

The DOM layer is not tested. It is a POC.

## Risks

- **Fidelity over invention.** The temptation is to improve on the users'
  layout. The value here is that they recognise their own drawing, so slides 18
  and 19 are reproduced rather than redesigned.
- **Seed-data plausibility.** Wrong-sounding gas names or implausible MFC sizes
  would undercut the whole thing with a domain expert. Vocabulary comes from the
  decks, not invention.
- **Page weight.** The embedded reactor render is ~110 KB, ~146 KB as base64.
  Acceptable for a single-file POC, but it is the floor on page size.
