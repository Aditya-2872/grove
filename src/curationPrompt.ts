// ---------------------------------------------------------------------------
// The curation prompt — shared by every real provider, so Gemini and Claude
// can't drift apart (they had two independent prompts; only one ever got fixed).
//
// The job here is a SELECTION decision, and the old prompt got it wrong in a
// way worth remembering: it asked for "4 to 6 widgets" above a menu of seven
// shapes. That's a coverage quota. When only two widgets genuinely fit a goal
// the model has to pad to reach four — and padding is goal-independent BY
// CONSTRUCTION, because nothing in the goal is driving it. Measured result:
// 6/6 test goals produced a checklist, 6/6 produced a sticky note, every set
// 5-6 widgets. Every tab looked the same with the metric label swapped.
//
// Two rules learned the hard way:
//  - The count must be evidence, not a quota.
//  - Field ORDER is load-bearing. JSON decodes autoregressively, so a field
//    only constrains what comes after it.
// ---------------------------------------------------------------------------

// Written from what each VIEW actually RENDERS (WidgetViews.tsx), not from what
// the type is nominally called. The old counter example shipped "unit":"days" —
// CounterView renders no unit at all, so the prompt was soliciting a field that
// provably cannot appear on screen.
export const WIDGET_SHAPES =
  `Each widget is ONE of these JSON shapes:\n` +
  `{"type":"metric","title":"…","value":0,"unit":"chapters","target":14}   // a number climbing to a real finish line: draws a fill ring and "value / target unit"\n` +
  `{"type":"metric","title":"…","value":0,"unit":"words","target":500,"period":"day"}  // period "day"|"week"|"month": the value STARTS OVER each period\n` +
  `{"type":"metric","title":"…","value":0,"unit":"bpm"}                     // target OMITTED — a level you watch with no finish line: draws a big number and a trend line\n` +
  `{"type":"checklist","title":"…","items":["Real name 1","Real name 2"]}   // items MUST be real, specific names — never "Item 1"\n` +
  `{"type":"habit","title":"…"}                                             // a daily check-in chain: current and longest streak, plus a 14-day dot trail\n` +
  `{"type":"timer","title":"…","durationSeconds":1500}                      // a countdown that chimes at zero\n` +
  `{"type":"bmi","title":"BMI","heightCm":170,"weightKg":70}                // a static height/weight readout — no history, no logging\n` +
  `{"type":"counter","title":"…","value":0}                                 // a bare tally, +1/-1 only. Its unit and target are NOT rendered — do not send them\n` +
  `{"type":"progress","title":"…","value":0}                                // a 0-100 slider dragged by hand: it stores a guess, not a measurement\n` +
  `{"type":"sticky_note","title":"…","content":"…"}                         // only if it carries real content (a quote, a tip)`;

// A decision procedure, not a menu. The second half is the part that actually
// moves the answer: these are mechanical facts about our own renderers, and each
// one RULES OUT a type.
const SHAPE_TABLE =
  `Choose each widget by the SHAPE of the thing tracked, never by the topic:\n` +
  `- ACCUMULATES toward a real finish line (21.1 km, 80000 words, 5000 dollars) -> metric WITH target\n` +
  `- A LEVEL you watch, with no finish line (resting heart rate, minutes to fall asleep) -> metric with NO target\n` +
  `- Must happen EVERY day, and a miss is a real setback -> habit\n` +
  `- A finite, ordered set of ONE-TIME things you can NAME -> checklist\n` +
  `- A session the person sits through and wants a chime at the end of -> timer\n` +
  `- Body weight or composition IS the goal -> bmi (at most one, and only then)\n` +
  `- A small unitless tally, tapped once per event, under ~20 -> counter (rare)\n` +
  `- Nothing above fits: no unit AND no nameable steps -> progress (rare)\n\n` +
  `Facts about these widgets. They decide the choice — do not argue with them:\n` +
  `- A checklist NEVER resets. "Workouts this week" is a wall of dead ticks by week two. Anything recurring -> habit or metric, never a checklist.\n` +
  `- Once a habit's streak is going, it asks to be checked in on any day it is missed. So never put a habit on something with legitimate off days: running has rest days, a no-spend streak breaks on a real grocery run.\n` +
  `- A counter shows NEITHER its unit NOR its target, and steps only by 1. A streak is NEVER a counter (that is a habit). Anything with a unit is a metric.\n` +
  `- A checklist already draws its own "3/5 done" bar. A progress widget beside one shows the same thing twice.\n` +
  `- A metric's target sets its +/- step size AND its ring percentage, so the target must be the REAL finish line: 21.1 not 20, 103 not 100.\n` +
  `- A metric WITHOUT "period" never starts over. So anything whose title says "today", "this week" or "this month" MUST carry the matching period, or it reads 500/500 forever from day two and tells the user the day is already done. "Total words" and "Saved" take no period — they accumulate. Ask: would this number be a fresh 0 tomorrow morning?`;

const RULES =
  `Rules:\n` +
  `- Pick a widget ONLY if this goal actually contains that thing. Nothing genuinely daily -> emit NO habit. No milestones you can name -> emit NO checklist. Omitting is correct and expected.\n` +
  `- The count is EVIDENCE, not a quota: 2 to 6, whatever the goal actually contains. Never pad to fill the canvas.\n` +
  `- But one widget is not restraint — it is stopping too early, and NEVER return fewer than two. Before you stop, look for EACH of these, and keep the ones this goal really has: the number that DEFINES it; a SECOND number telling a different story (what you spend, not just what you save; how fast you fall asleep, not just hours); the behaviour that MOVES it week to week; a one-time list whose steps you can actually NAME. Most goals have two or three of these. "Save 5000 for a bike" is not just "amount saved" — it is also what you spend each month. If you found only one, you have missed the behaviour that moves it.\n` +
  `- A checklist needs REAL, NAMEABLE, ONE-TIME steps you know from this specific goal. If you cannot name them, there is NO checklist — never invent a generic "Setup", "Prep" or "Milestones" list to fill the space. That is padding wearing a disguise.\n` +
  `- THE TEST every widget must pass: if this number never moved for a month, would they notice they were off track? If not, leave it out.\n` +
  `- Every widget must answer a DIFFERENT question. "Words today" and "Total manuscript" are two questions; "Weekly distance" and "Runs this week" are one question asked twice — keep one.\n` +
  `- Use your REAL knowledge: a specific book -> its ACTUAL chapter names; training -> real exercise names; an exam -> its real modules and real counts. NEVER generic placeholders ("Topic 1", "First step", "Beginning / Middle / End", "Get started").\n` +
  `- If you do not know the real names a list needs, DROP that widget rather than pad it with vague items. And a confidently wrong number is worse than no number: if you are not sure of the real finish line, OMIT target instead of inventing one.\n` +
  `- Do NOT emit one of each type. metric + checklist + habit + progress + note for every goal is THE failure mode: it means you filled in a form instead of reading the goal.\n` +
  `- At most one sticky_note, and usually zero.`;

// Two examples, never one: a single example becomes the new template, which is
// the exact failure being fixed. Prose only, no copyable JSON, and both goals
// are deliberately off-axis so they're unlikely to be typed verbatim.
const COUNT_CONTRAST =
  `The right answer looks different every time. Two examples of the METHOD (never copy these widgets):\n` +
  `- "quit vaping" -> 3 widgets: a habit (vape-free today), a metric with NO target (cravings — a level that should fall, there is no finish line), a checklist (the trigger plan, written once before it is needed). No timer: there is no session to sit through. No progress bar: nothing honest to drag.\n` +
  `- "get my private pilot licence" -> 5 widgets: a metric to 40 hrs, a metric to 10 solo hrs, a checklist of required flights, a separate checklist of written-test topics, a ground-school timer. No habit: you cannot fly daily — weather and instructor availability decide.\n` +
  `Different goals -> different COUNTS and different TYPE MIXES. That is the whole point.`;

/** Everything except how to return it — each provider appends its own tail. */
export const curationBody = (goal: string) =>
  `A person just wrote this goal:\n"${goal}"\n\n` +
  `Choose the tracking widgets for it. This is a SELECTION decision, not a form to fill in: ` +
  `three widgets that fit THIS goal beat six that would fit any goal.\n\n` +
  SHAPE_TABLE +
  `\n\n` +
  WIDGET_SHAPES +
  `\n\n` +
  RULES +
  `\n\n` +
  COUNT_CONTRAST;

/** The scratchpad fields, in the only order that does anything. "analysis" and
 *  "skipped" must be emitted BEFORE the widgets: placed after, they'd be
 *  post-hoc rationalization and would constrain nothing. "domain" moved LAST for
 *  the same reason — leading with it made the model select widgets for a
 *  stereotype, and that enum is the same 7-name list that drives the keyword
 *  templates in generateWorkspace.ts. App only uses domain for suggestedTypes()
 *  in the add menu, so a label at the end is sufficient. */
export const ANALYSIS_DESC =
  "40 words max: what is this goal MADE OF? Name the real numbers and finish lines you actually know, and anything that genuinely must happen every single day.";
export const SKIPPED_DESC =
  "name the widgets a lazy generic tracker would bolt onto ANY goal, and say why they do NOT belong to THIS one. Be specific.";
