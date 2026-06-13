export const WEDDING = {
  name: "Emma & James Wedding",
  date: "September 14, 2025",
  venue: "The Grand Ballroom",
};

export const GUESTS = [
  // Couple's immediate family — all confirmed
  { id: 1,  name: "Margaret Chen",   relation: "Bride's Mother",              meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 2,  name: "David Chen",      relation: "Bride's Father (divorced)",   meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 3,  name: "Patricia Walsh",  relation: "Groom's Mother",              meal: "Vegetarian",  mobility: false, rsvp: "confirmed", table: null },
  { id: 4,  name: "Robert Walsh",    relation: "Groom's Father",              meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 5,  name: "Sophie Chen",     relation: "Bride's Sister (MOH)",        meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 6,  name: "Liam Walsh",      relation: "Groom's Brother (Best Man)",  meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },

  // Grandparents / elderly — confirmed
  { id: 7,  name: "Rose Chen",       relation: "Bride's Grandmother",         meal: "Standard",    mobility: true,  rsvp: "confirmed", table: null },
  { id: 8,  name: "Frank Walsh",     relation: "Groom's Grandfather",         meal: "Standard",    mobility: true,  rsvp: "confirmed", table: null },

  // Divorced / conflict — confirmed
  { id: 9,  name: "Uncle Rob Chen",  relation: "Bride's Uncle",               meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 10, name: "Aunt Lisa Chen",  relation: "Bride's Aunt (Rob's ex)",     meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },

  // College friends — mixed
  { id: 11, name: "Sarah Kim",       relation: "College Friend (Bride)",      meal: "Vegetarian",  mobility: false, rsvp: "confirmed", table: null },
  { id: 12, name: "Mike Torres",     relation: "College Friend (Bride)",      meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 13, name: "Jake Patel",      relation: "College Friend (Bride)",      meal: "Standard",    mobility: false, rsvp: "pending",   table: null },
  { id: 14, name: "Chloe Adams",     relation: "College Friend (Bride)",      meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },

  // Work colleagues — mixed
  { id: 15, name: "Rachel Green",    relation: "Colleague (Groom)",           meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 16, name: "Tom Baker",       relation: "Colleague (Groom)",           meal: "Vegetarian",  mobility: false, rsvp: "pending",   table: null },
  { id: 17, name: "Nina Patel",      relation: "Colleague (Groom)",           meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },

  // Kids — confirmed
  { id: 18, name: "Oliver Chen",     relation: "Bride's Nephew (age 7)",      meal: "Kids",        mobility: false, rsvp: "confirmed", table: null },
  { id: 19, name: "Lily Walsh",      relation: "Groom's Niece (age 5)",       meal: "Kids",        mobility: false, rsvp: "confirmed", table: null },
  { id: 20, name: "Noah Green",      relation: "Guest Child (age 9)",         meal: "Kids",        mobility: false, rsvp: "pending",   table: null },

  // Other guests — some pending
  { id: 21, name: "Carlos Rivera",   relation: "Childhood Friend (Groom)",    meal: "Standard",    mobility: false, rsvp: "confirmed", table: null },
  { id: 22, name: "Amanda Lee",      relation: "Childhood Friend (Groom)",    meal: "Standard",    mobility: false, rsvp: "pending",   table: null },
  { id: 23, name: "Grace Park",      relation: "Family Friend",               meal: "Standard",    mobility: false, rsvp: "pending",   table: null },
  { id: 24, name: "Henry Walsh",     relation: "Groom's Cousin",              meal: "Standard",    mobility: false, rsvp: "pending",   table: null },
];

export const TABLES = [
  { id: 1, name: "Table 1 — Sweetheart", capacity: 8, nearSpeakers: false, nearBar: false, nearService: false },
  { id: 2, name: "Table 2 — Family", capacity: 8, nearSpeakers: false, nearBar: false, nearService: false },
  { id: 3, name: "Table 3 — Family", capacity: 8, nearSpeakers: true, nearBar: false, nearService: false },
  { id: 4, name: "Table 4 — Friends", capacity: 8, nearSpeakers: false, nearBar: true, nearService: false },
  { id: 5, name: "Table 5 — Colleagues", capacity: 8, nearSpeakers: false, nearBar: false, nearService: true },
  { id: 6, name: "Table 6 — Kids", capacity: 6, nearSpeakers: false, nearBar: false, nearService: true },
];

// Each constraint resolves to a structured rule bound to specific guest IDs.
// MVP scoping: rules bind to guests BY NAME (guest IDs), not by attribute/quality.
// Meal + mobility come free from existing RSVP data; true attribute tagging is Phase 2.
export const HARDCODED_CONSTRAINTS = [
  {
    id: "c1",
    text: "Divorced parents apart — bride's parents (Margaret & David Chen) must not be seated at the same table",
    category: "relationship",
    icon: "⚠️",
    rule: { type: "KEEP_APART", guests: [1, 2] },
  },
  {
    id: "c2",
    text: "Don't seat Uncle Rob next to Aunt Lisa — they separated badly, keep them at least 2 tables apart",
    category: "conflict",
    icon: "🚫",
    rule: { type: "KEEP_APART", guests: [9, 10] },
  },
  {
    id: "c3",
    text: "College friends near the bar — Sarah, Mike, Jake, and Chloe should be at Table 4",
    category: "preference",
    icon: "🍸",
    rule: { type: "SEAT_TOGETHER", guests: [11, 12, 13, 14], zone: "Near bar" },
  },
  {
    id: "c4",
    text: "Elderly guests away from speakers — Rose and Frank are hard of hearing, seat at Table 2",
    category: "accessibility",
    icon: "♿",
    rule: { type: "ZONE_AVOID", guests: [7, 8], zone: "Away from speakers" },
  },
  {
    id: "c5",
    text: "Seat Patricia, Sarah & Tom near service — they have vegetarian meals and need easy staff access",
    category: "meal",
    icon: "🥗",
    rule: { type: "ZONE_PREFER", guests: [3, 11, 16], zone: "Near service" },
  },
  {
    id: "c6",
    text: "Kids table together — Oliver, Lily, and Noah at Table 6, away from the bar",
    category: "preference",
    icon: "🧒",
    rule: { type: "SEAT_TOGETHER", guests: [18, 19, 20], zone: "Away from bar" },
  },
];

// The AI-generated seating assignment
export const GENERATED_SEATING = {
  1: [1, 3, 4, 5, 6, 7],         // Sweetheart: Bride's Mom, Groom's parents, Siblings, Grandma
  2: [8, 23, 24, 22, 21, 16],    // Family: Groom's Grandpa, family friends, colleagues
  3: [2, 10, 15, 17, 9, 13],     // Family (near speakers — conflict flagged for 7,8): Bride's Dad, Aunt Lisa, colleagues, Uncle Rob (CONFLICT)
  4: [11, 12, 14, 20, 19, 18],   // Friends (near bar): college friends + kids (conflict for kids near bar)
  5: [16, 15, 17, 22, 23, 24],   // Colleagues (near service): Tom, Rachel, Nina
  6: [18, 19, 20, 13, 14, 21],   // Kids
};

// Corrected seating after resolving conflicts
export const RESOLVED_SEATING = {
  1: [1, 3, 4, 5, 6, 23],
  2: [7, 8, 22, 21, 24, 23],
  3: [2, 15, 17, 10, 22, 24],
  4: [11, 12, 13, 14, 21, 9],
  5: [16, 15, 17, 10, 23, 24],
  6: [18, 19, 20, 21, 22, 9],
};

export const CONFLICTS = [
  {
    id: "cf1",
    severity: "high",
    message: "Uncle Rob (Table 3) is adjacent to Aunt Lisa (Table 3) — same table, violates constraint",
    guests: [9, 10],
    table: 3,
  },
  {
    id: "cf2",
    severity: "medium",
    message: "Kids (Oliver, Lily, Noah) placed at Table 4 near the bar — conflicts with accessibility preference",
    guests: [18, 19, 20],
    table: 4,
  },
];

export const RATIONALE = [
  { table: 1, note: "Immediate family anchors the sweetheart table — both mothers kept on same side." },
  { table: 2, note: "Elderly guests Rose and Frank placed farthest from speakers per accessibility constraint." },
  { table: 3, note: "Bride's father seated separately from mother. ⚠️ Uncle Rob conflict unresolved — needs your input." },
  { table: 4, note: "College friends near bar as requested. ⚠️ Kids inadvertently placed here — move to Table 6 recommended." },
  { table: 5, note: "Colleagues near service station; vegetarian guests (Tom, Patricia) have easy staff access." },
  { table: 6, note: "Kids table away from speakers and bar — awaiting kids to be moved from Table 4." },
];
