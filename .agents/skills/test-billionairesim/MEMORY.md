# Test-BillionaireSim Memory

Accumulated learnings from browser testing sessions. Read every session before testing.

## Browser JS Context Limitations

- **Dynamic imports fail**: `await import('/src/lib/...')` throws `TypeError: Failed to fetch dynamically imported module`. Only use `window.__gameStore` and `window.__npcStore`.
- **Bare `await` fails**: `javascript_tool` doesn't support top-level await. Wrap in `(async () => { ... })()`.
- **No save service access**: Can't import `saveService` to test save/load programmatically. Verify persistence by checking data fields exist on serialized objects (e.g., `ownership.brothelReputation` persists because it's part of `workVenues` in `assembleGameState`).

## Click Targeting

- **Dev toolbar buttons**: Both `find` ref-based clicks and coordinate clicks are unreliable. Use **programmatic clicks** instead: `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Advance Week')).click()`.
- **Advance Week**: The main UI "Advance Week →" button works via programmatic `.click()`. Wait **8 seconds** between clicks (tick processing can be slow with institution + brothel systems).
- **Hotspot buttons**: Programmatic `.click()` is more reliable than ref-based or coordinate clicks for SceneView hotspot buttons.

## Data Location Gotchas

- **Shift reports are top-level**: `gs.shiftReports` (a `Record<ShiftReportId, ShiftReport>`), NOT on `venue.ownership.shiftReports`.
- **Brothel data field**: `report.brothelData`, NOT `report.brothelShiftData`.
- **Reputation on ownership**: `venue.ownership.brothelReputation` — has `categoryScores`, `overallQuality`, `lifetimeCustomersServed`.
- **Regular customers on ownership**: `venue.ownership.regularCustomers` (array), NOT `regularCustomerPool`.
- **Staff assignments on ownership**: `venue.ownership.staffAssignments` (array with `npcId`, `dayShift`, `nightShift`, `wagePerShift`), NOT `employeeIds`.

## Quickstart Behavior

- `?quickstart` creates a game with ~$480M, auto-acquires a seeded brothel with 4 staff (2 entertainers night shift, 1 hostess night, 1 security night).
- Day shift reports show $0 revenue — expected since all staff are on night shifts.
- Seed workers get `corruption: 35` (`SEED_BROTHEL_WORKER_CORRUPTION`) enabling them to serve companionship/nurturing/manual customers immediately.

## Known Patterns

- **Overall quality drops fast with understaffing**: 2 revenue workers serving 25 customers → ~25% serve rate → quality tanks to 0-1 within a few weeks. This is correct behavior, not a bug.
- **Regulars appear after ~1 week**: Regular customer pool populates after a few shifts. Check `ownership.regularCustomers.length`.
- **Signatures require affinity >= 80**: Won't appear in short test runs (3 weeks). Need extended runs or manual affinity boosting.
- **Incidents are probabilistic**: May not appear in short runs. Not a bug if 0 incidents after 3 weeks.

## Institution Data Location

- **Institution object**: `gs.institution` (top-level on gameStore state)
- **Player role**: `gs.institution.playerRole` — has `roles[]`, `enrolledCourseIds[]`, `clubId`, `academicRecord`, `hydratedClassmates`, `lastAttendedBlock`, `scoutedCompetitionWeek`, `rallyUsedForCompetition`
- **Corruption**: `gs.institution.corruption` (number, not on Empire)
- **Competition history**: `gs.institution.competitionHistory[]`, `competitionWins`, `competitionLosses`
- **Clubs**: `gs.institution.clubs[]` — each has `memberGhostIds[]`, `memberNpcIds[]`
- **PTA**: `gs.institution.pta` — has `active`, `members[]`, `activePolicies[]`, `pendingProposals[]`, `nextMeetingWeek`, `emergencyMeetingPending`
- **PTA members**: `gs.institution.pta.members[i]` — has `id`, `name`, `disposition`, `loyalty`, `corruptionLevel`, `isChair`
- **Corruption cooldowns**: `gs.institution.corruptionCooldowns` — `Record<string, number>` (actionId → week used)

## Institution UI Navigation

- **Entry**: Phone > School app (bottom-right of phone grid)
- **Role tabs**: Student / Owner / Principal (if player has multiple roles)
- **Attend flow**: My Courses table > Attend button > 4 inline choice buttons (Study Hard / Relax / Socialize / Daydream)
- **Socialize flow**: After choosing Socialize > purple picker > "Meet someone new" or "Talk to [name]"
- **Corruption flow**: Owner/Principal tab > scroll to CORRUPTION section > catalog-driven tiers (Low/Medium/High/Extreme) with per-action buttons
- **PTA flow**: Owner/Principal tab > scroll to PTA COUNCIL section > Activate PTA (first time) > member roster with Persuade/Bribe/Threaten buttons > Propose Policy picker > meeting resolves every 4 weeks
- **Policy save guard**: "Policies already changed this week" appears on second save attempt in same week

## Quickstart Institution Seed

- Quickstart seeds the **institution pool** from scenario JSON via `createInstitutionPool()`, then **auto-inflates** the first city institution via `inflateInstitution()`
- Quickstart picks scenarios alphabetically — cultivation-fantasy loads first (5 institutions, 1 per city → 0 natural rivals). Modern-2026 has 3 in NYC (would give 2 rivals).
- After inflation: player gets 3 roles (student/owner/principal), 7 courses, 2 clubs (Chess Club, Basketball Team), 2 enrolled courses, 2 pending homework, 1 seeded competition record, 2 facilities
- **Institution pool data**: `gs.institutionPool` — array of `InstitutionDef` objects. Remaining pool entries (from other cities) persist and tick weekly if no active institution.
- **Rival data**: `gs.institution.rivals` — array of `RivalInstitution`. Each has `name`, `subtype`, `reputation`, `quality`, `corruption`, `attitude`, `vassalStatus`, `leader: { name, gender, npcId? }`, `recentEvent`
- **Rivalry tracker**: `gs.institution.rivalryTracker` — `Record<string, { wins, losses, streak }>` keyed by rival name
- Player starts on Sunday (day 1), time 7:00AM
- **Player starts inside institution dwelling** — `setPlayerLocation(loc.id, cityId)` + `setPlayerCurrentRoom(dwelling.entryRoomId)` places player in School Grounds room
- **DwellingLayout lookup**: Dwellings keyed by `locationId` in `gs.dwellings`. The field on the dwelling is `ownerInstitutionId` (not `institutionId`). Find institution dwelling via `gs.dwellings[gs.institution.locationId]`.
- **Facility completion timing**: `buildWeek: 1, buildDuration: 4` → completes when `currentWeek - buildWeek >= buildDuration` → at week 5's tick (advances to week 6). Library is pre-completed; Gymnasium completes at week 6.

## Institution Room Navigation

- **Dwelling hotspots replace location hotspots**: `SceneView.tsx` uses `customHotspots ?? location.hotspots` — when `customHotspots` are provided (from `generateInstitutionRoomHotspots`), location hotspots are hidden
- **Leave behavior in dwelling**: Leave hotspot clears `playerCurrentRoomId` but keeps player at the location (doesn't switch to map view). Only non-dwelling leave switches to map.
- **Hotspot position constraint**: Hotspots at `y >= 85` get obscured by the description overlay at bottom of SceneView. Use `y: 70` maximum for bottom-positioned hotspots.

## Session Log

### 2026-03-12: Institution Rooms & Modular Courses Testing
- **8 tests executed, 8 passed, 3 P0 found & fixed**
- P0-1: SceneView.tsx `leave` action had special-case routing that bypassed `handleHotspotClick` — fixed by routing all clicks through `onHotspotClick`
- P0-2: LocationViewport leave handler always switched to map view, even when exiting dwelling rooms — fixed to clear room only when `isAtDwelling`
- P0-3: Leave hotspot at `y:90` obscured by description overlay div — fixed to `y:70` in both `institutionRoomService.ts` and `institutionInitService.ts`
- Room rendering, navigation, ghost population, ghost hydration, institution modal, facility completion (gym at week 6) all verified
- Save/load compatibility confirmed: `assembleGameState`, `loadGame`, `resetGame` all handle institution + dwellings

### 2026-03-12: Institution PTA & Corruption Phase 3 Testing
- **12 tests executed, 11 passed, 1 P0 found & fixed**
- P0: `ptaActivatePTA` was sync and didn't generate members — fixed to async with `initializePTACouncil()` call
- PTA activation, member roster, influence actions (persuade/bribe/threaten), policy proposals all verified
- Catalog corruption: tier-gated actions, course picker, cooldown tracking, amount sliders all working
- PTA meeting resolution after 4 weeks: policy passes, nextMeetingWeek advances, pendingProposals cleared
- Loyalty drift verified: -1/week toward 50 (Douglas Rodriguez 88.5→83.5 over 5 weeks)
- Policy IDs in JSON mods use underscore format (e.g., `punish_detention`, `dress_no_uniform`), not hyphenated

### 2026-03-16: City Treasury & Taxation Testing
- **8 tests executed, 8 passed, 1 P0 found & fixed**
- P0: `isQuarterlyTaxWeek(currentWeek.weekNumber)` used the pre-advance week number — tick runs at week 12 but tax day is week 13. Fixed to use `currentWeek.weekNumber + 1` (same pattern as `tickAllLegislation(nextWeek)`)
- Tax state data: `gs.empire.taxState` — has `quarterlyRevenueAccumulator`, `taxDebt`, `lastQuarterlyBill`, `totalTaxesPaid`, `totalTaxesEvaded`
- City treasury data: `gs.cityStats[cityId].treasury` — has `balance`, `health` (0-100), `healthTrend`, `quarterlyGrantsIssued`
- Institution treasury: `gs.institution.financials.treasury` (balance), `weeklyGrantIncome`
- Tax bill feed item: renders in GameFeed when `isQuarterlyTaxWeek(weekNumber) && lastQuarterlyBill > 0`. Uses `formatDollars()` for display. Pay/Ignore buttons call `payTaxBill()`/`ignoreTaxBill()`
- Calendar tax events: amber-highlighted "Tax" on weeks 13/26/39/52. No dollar amount shown. Renders via `CalendarEventCategory = 'tax'`
- Cultivation-fantasy scenario has year 4782, city "Celestial Capital" — city size derived as "large" ($400K starting treasury)
- Grant tiers respond to treasury health: health 48→austerity ($500/wk) after treasury declines from operating costs exceeding income
- Debt compounding verified: $10,216 → $10,471 after one quarter (2.5% rate)

### 2026-03-16: Rival Institutions Testing
- **9 tests executed, 9 passed, 0 P0 bugs**
- Pool seeding from scenario JSON: 5 defs created, 1 inflated, 4 remaining in pool
- Rival drift: reputation, quality, corruption all drift per tick; events rotate from pool
- Rival section UI: compact rows with Rep/Cor/Attitude/W:L stats, vassal badge (green), recent events
- GameFeed: rival events display with crossed-swords icon and tooltip
- Competition tracker: W/L records per rival, displayed in UI
- City stats: rivals contribute to vice/economy baselines
- Vassal badge: green "vassal" text appears next to vassalized rival name
- Pool selection UI: "Choose an institution to enroll in:" with cards showing stats/flavor/leader + Enroll button
- Full enrollment flow: Enroll → inflateInstitution → player gets student role → sibling becomes rival
- P1 (not a code bug): Quickstart picks cultivation-fantasy (alphabetical), which has only 1 institution per city → 0 natural rivals. Worked around by injecting rivals via JS.

### 2026-03-11: Institution Phase 2 Testing
- **24 tests executed, 24 passed, 0 bugs found**
- All 3 role views verified (Student, Owner, Principal)
- Student: GPA, attend+choices, socialize+hydrate, homework, club join, competition rally/scout
- Owner: P&L, policies, staff, facility grid, rivals, corruption (inflate/embezzle/leak)
- Principal: overview, policy sliders+save+double-save guard, all courses table
- Quickstart seed data worked perfectly — all sections had meaningful data to test

### 2026-03-13: Secret Sets Testing
- **5 tests executed, 5 passed, 2 P0s found & fixed in prior session**
- P0-1 (fixed before this session): `requiresMission` checked `completedEntries.includes(entry.index)` instead of `completedEntries.length > 0` — entry 1 could never satisfy mission prereq
- P0-2 (fixed before this session): `loadAllSecretSetMods()` never called at runtime — weekly tick always skipped secret set evaluation
- Quickstart seed: peer NPC gets `hired_killer` set with `activeIndex: -1`
- Weekly tick evaluation: `activeIndex` advances -1 → 0 at week 6 (5 weeks known ≥ 4 threshold)
- Mission spawning: "Surveil the Meetings" spawned for entry 0 with correct `setId`/`entryIndex`
- **Dev toolbar "Advance Week" (ref_713) didn't work** — it's the small toolbar button. The main UI button (ref_717, "Advance Week →" at bottom right) is the one that triggers `performWeeklyTick()`
- Secret set data locations: `npc.trueSelf.secretSets[]` (array of `SecretSetInstance`), each has `definitionId`, `activeIndex`, `secrets[]`, `spawnedMissionIds`, `completedMissionEntries`
- Secret set missions: `gs.missions.availableMissions.filter(m => m.secretSetContext)` — context has `setId`, `entryIndex`, `npcId`

### 2026-03-02: Customer Depth Testing
- **P0 found & fixed**: `workVenueInitService.ts` missing `SEED_BROTHEL_WORKER_CORRUPTION` — seed workers had corruption 0, all customers unmatched. Fixed by adding conditional corruption application matching `commercialLotService.ts` pattern.
- **All Customer Depth features verified**: reputation scores, category breakdown, regular customers, shift report UI, venue management reputation panel.
- **5/7 tests passed**, 2 N/A (incidents/signatures need longer runs).
