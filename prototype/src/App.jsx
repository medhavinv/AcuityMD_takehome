import { useState, useEffect, useRef, useMemo } from 'react';
import { WEDDING, GUESTS, TABLES, HARDCODED_CONSTRAINTS } from './data';
import './App.css';

const guest = (id) => GUESTS.find(g => g.id === id);

// Fixed-position tooltip — immune to overflow:hidden on any ancestor container.
function Tooltip({ text, children }) {
  const [rect, setRect] = useState(null);
  const ref = useRef();
  return (
    <span
      ref={ref}
      className="tt-wrap"
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {rect && (
        <div
          className="tt-bubble"
          style={{ left: rect.left + rect.width / 2, top: rect.top - 8 }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

// ─── Structured rules ─────────────────────────────────────────────────────────
// MVP: constraints bind to guests by NAME (resolved to guest IDs), not by
// attribute. The rule row below each added constraint shows the planner exactly
// what the system will execute.
const RULE_LABELS = {
  KEEP_APART:    { label: '✕ Keep apart',    cls: 'rule-apart',    tip: 'These guests will not be placed at the same table.' },
  SEAT_TOGETHER: { label: '⊕ Seat together', cls: 'rule-together', tip: 'These guests will be placed at the same table.' },
  ZONE_AVOID:    { label: '↗ Keep away',     cls: 'rule-zone',     tip: 'These guests will be kept away from the specified zone (speakers, bar, or service).' },
  CUSTOM:        { label: '✎ Custom rule',   cls: 'rule-custom',   tip: 'Rule parsed from your note. Matched guests shown — edit the text if anyone is missing.' },
  ERROR:         { label: '⚠ Unknown',       cls: 'rule-error',    tip: 'Could not parse a rule. Select a rule type and add the guests it applies to.' },
};

// Parse typed text into guest references.
// - confident: a token uniquely identifies one guest
// - ambiguous: a token matches multiple guests — surfaced for the planner to
//   confirm rather than silently guessing (e.g. "Patel" → Jake or Nina Patel).
const NAME_STOPWORDS = new Set([
  'uncle','aunt','the','and','near','away','from','keep','seat','together',
  'apart','with','they','only','know','each','other','table','tables','bar',
  'speakers','service','dont','don','not','next','side','far','too','who',
]);

const parseGuestNames = (text) => {
  const tokens = [...new Set(
    text.toLowerCase().split(/[^a-z']+/).filter(t => t.length > 2 && !NAME_STOPWORDS.has(t))
  )];
  const confident = new Set();
  const rawAmbiguous = [];
  for (const tok of tokens) {
    const candidates = GUESTS
      .filter(g => g.name.toLowerCase().split(/\s+/).includes(tok))
      .map(g => g.id);
    if (candidates.length === 1) confident.add(candidates[0]);
    else if (candidates.length > 1) rawAmbiguous.push({ token: tok, candidates });
  }
  // Drop candidates already pinned by a confident token
  // (e.g. "Jake Patel": Jake → confident, so Patel's group collapses to Jake).
  const ambiguous = rawAmbiguous
    .map(g => ({ token: g.token, candidates: g.candidates.filter(id => !confident.has(id)) }))
    .filter(g => g.candidates.length > 1);
  return { confident: [...confident], ambiguous };
};

// Read-only rule row — used in canvas sidebar recap
function RuleRow({ rule }) {
  const meta = RULE_LABELS[rule.type] || RULE_LABELS.CUSTOM;
  return (
    <div className="rule-row">
      <Tooltip text={meta.tip}>
        <span className={`rule-badge ${meta.cls}`}>{meta.label}</span>
      </Tooltip>
      {rule.guests.length > 0 ? (
        rule.guests.map(id => (
          <span key={id} className="rule-guest">
            <span className="rule-guest-av">{guest(id)?.name[0]}</span>
            {guest(id)?.name.split(' ').slice(0, 2).join(' ')}
          </span>
        ))
      ) : (
        <span className="rule-nomatch">⚠ No guests matched</span>
      )}
      {rule.zone && <span className="rule-zone-tag">{rule.zone}</span>}
    </div>
  );
}

// Editable rule row — used in constraints "Added" list.
// The planner can change rule type, remove guests, and add guests.
// This is the human-in-the-loop step: confirm/correct what the AI parsed.
function EditableRuleRow({ rule, onChange }) {
  const [localRule, setLocalRule] = useState(rule);
  const ambiguous = localRule.ambiguous || [];

  const update = (updated) => { setLocalRule(updated); onChange(updated); };
  const removeGuest = (id) => update({ ...localRule, guests: localRule.guests.filter(g => g !== id) });
  const addGuest = (e) => {
    const id = parseInt(e.target.value);
    if (!id || localRule.guests.includes(id)) return;
    update({ ...localRule, guests: [...localRule.guests, id] });
    e.target.value = '';
  };
  const setType = (e) => {
    const type = e.target.value;
    // Keep-away rules need a zone; default one in when switching to ZONE_AVOID,
    // and drop any dangling zone when switching to a relationship rule.
    const zone = type === 'ZONE_AVOID'
      ? (AVOID_ZONES.includes(localRule.zone) ? localRule.zone : AVOID_ZONES[0])
      : undefined;
    update({ ...localRule, type, zone });
  };
  // Planner picks which guest a token referred to → pin it, clear the group.
  const resolveAmbiguous = (token, id) => update({
    ...localRule,
    guests: localRule.guests.includes(id) ? localRule.guests : [...localRule.guests, id],
    ambiguous: ambiguous.filter(g => g.token !== token),
  });
  const dismissAmbiguous = (token) => update({
    ...localRule, ambiguous: ambiguous.filter(g => g.token !== token),
  });

  const meta = RULE_LABELS[localRule.type] || RULE_LABELS.ERROR;
  const isError = localRule.type === 'ERROR';
  const unaddedGuests = GUESTS.filter(g => !localRule.guests.includes(g.id));

  return (
    <div className="rule-row editable-rule-row">
      <Tooltip text={isError ? RULE_LABELS.ERROR.tip : meta.tip}>
        <select
          className={`rule-badge rule-badge-select ${isError ? 'rule-error' : meta.cls}`}
          value={isError ? '' : localRule.type}
          onChange={e => e.target.value && setType(e)}
        >
          <option value="" disabled>{isError ? '⚠ Select rule type…' : ''}</option>
          {Object.entries(RULE_LABELS).filter(([k]) => k !== 'CUSTOM' && k !== 'ERROR').map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </Tooltip>

      {localRule.type === 'ZONE_AVOID' && (
        <select
          className="rule-zone-tag rule-zone-select"
          value={localRule.zone || AVOID_ZONES[0]}
          onChange={e => update({ ...localRule, zone: e.target.value })}
          title="Which zone to keep these guests away from"
        >
          {AVOID_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      )}

      {localRule.guests.length > 0 ? (
        localRule.guests.map(id => (
          <span key={id} className="rule-guest rule-guest-editable">
            <span className="rule-guest-av">{guest(id)?.name[0]}</span>
            {guest(id)?.name.split(' ').slice(0, 2).join(' ')}
            <button className="rule-guest-remove" onClick={() => removeGuest(id)} title="Remove">×</button>
          </span>
        ))
      ) : (
        <span className="rule-nomatch">⚠ No guests — add one below</span>
      )}

      {unaddedGuests.length > 0 && (
        <select className="rule-add-guest" defaultValue="" onChange={addGuest}>
          <option value="" disabled>＋ guest</option>
          {unaddedGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}

      {ambiguous.map(grp => (
        <div key={grp.token} className="ambiguous-block">
          <span className="ambiguous-label">
            ⚠ “{grp.token}” matches {grp.candidates.length} guests — which did you mean?
          </span>
          <div className="ambiguous-options">
            {grp.candidates.map(id => (
              <button key={id} className="ambiguous-pick" onClick={() => resolveAmbiguous(grp.token, id)}>
                <span className="rule-guest-av">{guest(id)?.name[0]}</span>
                {guest(id)?.name}
              </button>
            ))}
            <button className="ambiguous-dismiss" onClick={() => dismissAmbiguous(grp.token)}>Neither / dismiss</button>
          </div>
        </div>
      ))}

      {isError && (
        <div className="rule-error-prompt">
          {localRule.guests.length === 0
            ? 'Select a rule type and add at least one guest to apply this constraint.'
            : 'Guests matched — select a rule type above to complete this constraint.'}
        </div>
      )}
    </div>
  );
}

// ─── Product Sidebar ──────────────────────────────────────────────────────────
// The product has three existing features (Guest List, Seating Charts, To-Do).
// This prototype adds a new feature — Seating Arrangement — that pulls data from
// the Guest List and Seating Charts tabs. The existing tabs aren't mocked here.
function ProductSidebar({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const existing = [
    { key: 'guests',  label: 'Guest List',    icon: '👥', sub: `${GUESTS.length} guests`,        source: true  },
    { key: 'charts',  label: 'Seating Charts', icon: '▦',  sub: `${TABLES.length} tables`,        source: true  },
    { key: 'todo',    label: 'To-Do Tracker',  icon: '✓',  sub: '12 open',                        source: false },
  ];
  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!collapsed && (
          <span className="brand-wrap">
            <span className="brand-mark">◆</span>
            <span className="brand-name">EverAfterPlan</span>
          </span>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && <div className="sidebar-section-label">Planning</div>}
      <nav className="sidebar-nav">
        {existing.map(f => (
          <div
            key={f.key}
            className="side-item side-disabled"
            title={collapsed ? f.label : (f.source ? 'Existing feature — feeds data into Seating Arrangement' : 'Existing feature — outside this prototype')}
          >
            <span className="side-icon">{f.icon}</span>
            {!collapsed && (
              <>
                <div className="side-text">
                  <span className="side-label">{f.label}</span>
                  <span className="side-sub">{f.sub}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </nav>

      {!collapsed && <div className="sidebar-section-label" style={{marginTop:18}}>New</div>}
      <nav className="sidebar-nav">
        <button className="side-item side-active" onClick={() => onNavigate('dashboard')} title={collapsed ? 'Seating Arrangement' : ''}>
          <span className="side-icon">◆</span>
          {!collapsed && (
            <>
              <div className="side-text">
                <span className="side-label">Seating Arrangement</span>
                <span className="side-sub">AI-assisted</span>
              </div>
              <span className="side-new">AI</span>
            </>
          )}
        </button>
      </nav>

      {!collapsed && (
        <div className="sidebar-foot">
          <div className="sf-label">Active wedding</div>
          <div className="sf-name">{WEDDING.name}</div>
          <div className="sf-date">{WEDDING.venue} · {WEDDING.date}</div>
        </div>
      )}
    </aside>
  );
}

// ─── Workflow Stepper ─────────────────────────────────────────────────────────
// The seating workflow begins when the planner clicks "Auto-Arrange" on the
// overview. The stepper lives inside the workflow (not the global header) and
// tracks the three working steps. `generating` is a transient loader between
// Constraints and Review, so it reads as the Review step in progress.
const WORKFLOW = [
  { key: 'constraints', label: 'Constraints',   desc: 'Define the rules' },
  { key: 'canvas',      label: 'Review & Edit',  desc: 'Adjust the draft' },
  { key: 'approved',    label: 'Publish',        desc: 'Save to seating chart' },
];
const WORKFLOW_SCREENS = ['constraints', 'generating', 'canvas', 'approved'];

function WorkflowStepper({ screen, onNavigate }) {
  // Map the transient generating screen onto the Review step.
  const activeKey = screen === 'generating' ? 'canvas' : screen;
  const active = WORKFLOW.findIndex(s => s.key === activeKey);

  return (
    <div className="wf-stepper">
      <div className="wf-eyebrow">
        <button className="wf-exit" onClick={() => onNavigate('dashboard')}>‹ Overview</button>
        <span className="wf-eyebrow-label">✦ Seating workflow</span>
        <span className="wf-progress">Step {active + 1} of {WORKFLOW.length}</span>
      </div>
      <div className="wf-steps">
        {WORKFLOW.map((s, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'future';
          // Future steps aren't navigable — you reach Review by generating a
          // draft and Publish via the explicit Publish button, so the workflow
          // can't be skipped past the human-in-the-loop review.
          const navigable = state !== 'future';
          return (
            <div key={s.key} className="wf-step-wrap">
              <button
                className={`wf-step wf-${state}`}
                onClick={navigable ? () => onNavigate(s.key) : undefined}
                disabled={!navigable}
                title={navigable ? '' : 'Complete the previous step first'}
              >
                <span className="wf-step-num">{i < active ? '✓' : i + 1}</span>
                <span className="wf-step-body">
                  <span className="wf-step-label">{s.label}</span>
                  <span className="wf-step-desc">{s.desc}</span>
                </span>
              </button>
              {i < WORKFLOW.length - 1 && <span className={`wf-connector${i < active ? ' wf-connector-done' : ''}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ onStart }) {
  return (
    <div className="screen">
      <div className="dash-hero">
        <div>
          <h1 className="dash-title">Seating Arrangement</h1>
          <p className="dash-sub">{WEDDING.name} &nbsp;·&nbsp; {WEDDING.venue} &nbsp;·&nbsp; {WEDDING.date}</p>
        </div>
        <span className="dash-status-chip">⚠ Seating unassigned</span>
      </div>

      <div className="how-strip">
        <span className="how-strip-title">✦ How AI seating works</span>
        <div className="how-strip-steps">
          <span className="how-strip-step"><b>1</b> Add the couple's constraints</span>
          <span className="how-arrow">→</span>
          <span className="how-strip-step"><b>2</b> AI drafts a chart & flags conflicts</span>
          <span className="how-arrow">→</span>
          <span className="how-strip-step"><b>3</b> You review, edit & publish the chart</span>
        </div>
      </div>

      <div className="dash-panels two">
        <div className="panel">
          <div className="panel-hd">
            <div className="panel-hd-titled"><h3>Guests</h3><span className="panel-src">via Guest List</span></div>
            <div className="panel-meta"><span className="badge">{GUESTS.filter(g=>g.rsvp==='confirmed').length} confirmed</span><span className="badge-muted">{GUESTS.filter(g=>g.rsvp==='pending').length} pending</span></div>
          </div>
          <div className="list-scroll">
            {GUESTS.slice(0, 10).map(g => (
              <div key={g.id} className="list-row">
                <div className="avatar">{g.name[0]}</div>
                <div className="list-info">
                  <div className="list-name">{g.name}</div>
                  <div className="list-sub">{g.relation}</div>
                </div>
                {g.rsvp === 'pending' && <span className="pill pill-pending">Pending</span>}
                <span className={`pill pill-${g.meal.toLowerCase().replace(/\s/g,'')}`}>{g.meal}</span>
              </div>
            ))}
            <div className="list-more">+{GUESTS.length - 10} more guests</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd">
            <div className="panel-hd-titled"><h3>Tables</h3><span className="panel-src">via Seating Charts</span></div>
            <div className="panel-meta"><span className="badge">{TABLES.length} tables</span></div>
          </div>
          <div className="list-scroll">
            {TABLES.map(t => (
              <div key={t.id} className="list-row">
                <div className="table-hex">⬡</div>
                <div className="list-info">
                  <div className="list-name">{t.name}</div>
                  <div className="list-sub">{t.capacity} seats</div>
                </div>
                <div style={{display:'flex',gap:4}}>
                  {t.nearBar && <span className="tag tag-bar">Bar</span>}
                  {t.nearSpeakers && <span className="tag tag-spk">Spkrs</span>}
                  {t.nearService && <span className="tag tag-svc">Svc</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-bottom-bar">
        <div className="dash-bottom-hint">Ready to generate a seating chart from the above data?</div>
        <button className="btn-primary btn-lg btn-full" onClick={onStart}>Auto-Arrange Seating →</button>
      </div>
    </div>
  );
}

// ─── Constraint Capture ───────────────────────────────────────────────────────
function ConstraintCapture({ added, setAdded, editedRules, setEditedRules, customList, setCustomList, onGenerate, onBack }) {
  const [custom, setCustom] = useState('');

  const toggle = (id) => setAdded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const getRule = (c) => editedRules[c.id] || c.rule;
  const addCustom = () => {
    const text = custom.trim();
    if (!text) return;
    // Always add — start in ERROR state so the planner must pick a rule type.
    // Confident name matches are pre-filled; ambiguous ones are surfaced for
    // the planner to confirm rather than silently guessing.
    const { confident, ambiguous } = parseGuestNames(text);
    const rule = { type: 'ERROR', guests: confident, ambiguous };
    setCustomList(prev => [...prev, { id: `custom-${Date.now()}`, text, rule }]);
    setCustom('');
  };
  const removeCustom = (id) => setCustomList(prev => prev.filter(c => c.id !== id));
  const updateCustomRule = (id, rule) => setCustomList(prev => prev.map(c => c.id === id ? { ...c, rule } : c));
  const totalCount = added.length + customList.length;

  // The exact rules carried into the draft: applied suggestions (with any edits)
  // plus custom rules. Every applied rule must be valid to proceed (see below),
  // so no silent dropping is needed here.
  const buildAppliedRules = () => [
    ...HARDCODED_CONSTRAINTS
      .filter(c => added.includes(c.id))
      .map(c => ({ id: c.id, ...getRule(c) })),
    ...customList
      .map(c => ({ id: c.id, type: c.rule.type, guests: c.rule.guests, zone: c.rule.zone })),
  ];

  // A rule is incomplete if it has no rule type, binds to no guests, or still
  // has an unconfirmed ambiguous name — the same states the rows flag with ⚠.
  const ruleIsValid = (rule) =>
    rule.type !== 'ERROR' &&
    rule.guests.length > 0 &&
    (rule.ambiguous || []).length === 0 &&
    (rule.type !== 'ZONE_AVOID' || !!rule.zone);
  const invalidCount = [
    ...HARDCODED_CONSTRAINTS.filter(c => added.includes(c.id)).map(getRule),
    ...customList.map(c => c.rule),
  ].filter(r => !ruleIsValid(r)).length;

  return (
    <div className="screen">
      <div className="two-col">
      {/* Left: guest list */}
      <div className="col-left">
        <div className="panel-hd" style={{marginBottom:12}}><h3>Guest List</h3><span className="badge">{GUESTS.length}</span></div>
        <div className="list-scroll list-scroll-tall">
          {GUESTS.map(g => (
            <div key={g.id} className="list-row">
              <div className="avatar sm">{g.name[0]}</div>
              <div className="list-info">
                <div className="list-name">{g.name}</div>
                <div className="list-sub">{g.relation}</div>
              </div>
              {g.mobility && <span className="tag tag-mob" title="Accessibility need">♿</span>}
              <span className={`pill ${g.rsvp === 'pending' ? 'pill-pending' : 'pill-confirmed'}`}>
                {g.rsvp === 'pending' ? 'Pending' : 'Confirmed'}
              </span>
            </div>
          ))}
        </div>
        <div className="metadata-note">
          Meal & accessibility come from RSVP data. Relationships are captured as constraints →
        </div>
      </div>

      {/* Right: constraint input */}
      <div className="col-right">
        <div className="constraints-hd">
          <div>
            <h2>Add Constraints</h2>
            <p className="sub-text">Click to add, or type your own. Each constraint resolves to a rule bound to specific guests by name.</p>
          </div>
          <button className="btn-outline" onClick={onBack}>← Back</button>
        </div>

        <div className="suggestions-block">
          <div className="suggestions-label">Suggested — click to add</div>
          {HARDCODED_CONSTRAINTS.map(c => (
            <button key={c.id} className={`chip${added.includes(c.id) ? ' chip-on' : ''}`} onClick={() => toggle(c.id)}>
              <span className="chip-icon">{c.icon}</span>
              <span className="chip-text">{c.text}</span>
              <span className="chip-toggle">{added.includes(c.id) ? '✓' : '+'}</span>
            </button>
          ))}
        </div>

        <div className="custom-block">
          <div className="suggestions-label">
            <span className="ai-spark">✦</span> Custom constraint
            <Tooltip text="Supported rules: Keep apart (two guests, different tables) · Seat together (group, same table) · Keep away (guests away from speakers, bar, or service). Guest names are matched to your list.">
              <span className="info-icon-sm">ℹ</span>
            </Tooltip>
            <span className="ai-label">AI parses guest names</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <textarea
              className="constraint-input"
              placeholder="e.g. Seat Grace and Henry together — they only know each other"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              rows={3}
            />
            <button className="btn-outline" disabled={!custom.trim()} onClick={addCustom}>Add</button>
          </div>
          <div className="custom-hint">Names are matched to your guest list. Shared surnames (e.g. “Patel”) will ask you to confirm who you meant.</div>
        </div>

        {totalCount > 0 && (
          <div className="added-block">
            <div className="suggestions-label">
              Added ({totalCount})
              <span className="edit-hint"> — edit rule type or guests before generating</span>
            </div>
            {HARDCODED_CONSTRAINTS.filter(c => added.includes(c.id)).map(c => (
              <div key={c.id} className="added-item">
                <div className="added-main">
                  <span className="added-text">{c.icon} {c.text}</span>
                  <EditableRuleRow
                    rule={getRule(c)}
                    onChange={(updated) => setEditedRules(prev => ({ ...prev, [c.id]: updated }))}
                  />
                </div>
                <button className="remove-btn" onClick={() => toggle(c.id)}>×</button>
              </div>
            ))}
            {customList.map(c => {
              const hasAmbiguous = (c.rule.ambiguous || []).length > 0;
              const cls = c.rule.type === 'ERROR' ? ' added-item-error' : hasAmbiguous ? ' added-item-warn' : '';
              return (
              <div key={c.id} className={`added-item${cls}`}>
                <div className="added-main">
                  <span className="added-text">✎ {c.text}</span>
                  <EditableRuleRow
                    rule={c.rule}
                    onChange={(updated) => updateCustomRule(c.id, updated)}
                  />
                </div>
                <button className="remove-btn" onClick={() => removeCustom(c.id)}>×</button>
              </div>
              );
            })}
          </div>
        )}

      </div>
      </div>

      <div className="dash-bottom-bar">
        <div className={`info-note${invalidCount > 0 ? ' info-note-warn' : ''}`}>
          <span className="info-icon">{invalidCount > 0 ? '⚠' : 'ℹ'}</span>
          {invalidCount > 0
            ? `${invalidCount} constraint${invalidCount > 1 ? 's need' : ' needs'} attention — pick a rule type, add a guest, or confirm an ambiguous name before generating.`
            : 'Your guest list, RSVPs, table capacities, and constraints are used to generate the draft. You review and approve before anything is shared.'}
        </div>
        <button
          className="btn-primary btn-lg btn-full"
          disabled={invalidCount > 0}
          title={invalidCount > 0 ? 'Resolve the flagged constraints to continue' : undefined}
          onClick={() => onGenerate(buildAppliedRules())}
        >Generate Seating Draft →</button>
      </div>
    </div>
  );
}

// ─── Generating ───────────────────────────────────────────────────────────────
function Generating({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Reading guest list & RSVPs…',
    'Parsing constraints…',
    'Running seating optimisation…',
    'Flagging conflicts…',
    'Draft ready ✓',
  ];
  useEffect(() => {
    if (step < steps.length - 1) {
      const t = setTimeout(() => setStep(s => s + 1), 650);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [step, onDone]);

  return (
    <div className="screen center-screen">
      <div className="gen-card">
        <div className="spinner" />
        <h2>Generating seating draft…</h2>
        <p className="sub-text">Using your constraints and guest data</p>
        <div className="gen-steps">
          {steps.map((s, i) => (
            <div key={s} className={`gen-step ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}`}>
              <span className="gen-dot">{i < step ? '✓' : i === step ? '◉' : '○'}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ table, guestIds, conflicts, onDragStart, onDrop }) {
  const hasConflict = conflicts.some(c => c.table === table.id);
  return (
    <div
      className={`table-card${hasConflict ? ' conflict-table' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={() => onDrop(table.id)}
    >
      <div className="tc-header">
        <div>
          <div className="tc-name">{table.name}</div>
          <div className="tc-cap">{guestIds.length}/{table.capacity} seats</div>
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          {table.nearBar && <span className="tag tag-bar">Bar</span>}
          {table.nearSpeakers && <span className="tag tag-spk">Spkrs</span>}
          {table.nearService && <span className="tag tag-svc">Svc</span>}
          {hasConflict && <span className="conflict-badge">⚠</span>}
        </div>
      </div>
      <div className="tc-seats">
        {guestIds.map(id => {
          const g = guest(id);
          if (!g) return null;
          const flagged = conflicts.some(c => c.guests.includes(id));
          const pending = g.rsvp === 'pending';
          return (
            <div key={id} className={`seat${flagged ? ' seat-flagged' : ''}${pending ? ' seat-pending' : ''}`}
              draggable onDragStart={() => onDragStart(id, table.id)}
              title={pending ? `${g.name} — RSVP pending` : g.name}>
              <div className="seat-av">{g.name[0]}{pending && <span className="pending-dot">·</span>}</div>
              <div className="seat-nm">{g.name.split(' ')[0]}</div>
              <div className={`seat-meal pill-${g.meal.toLowerCase().replace(/\s/g,'')}`} />
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, table.capacity - guestIds.length) }).map((_, i) => (
          <div key={`e${i}`} className="seat seat-empty">
            <div className="seat-av empty" />
            <div className="seat-nm muted">—</div>
          </div>
        ))}
      </div>
      {hasConflict && (
        <div className="tc-conflicts">
          {conflicts.filter(c => c.table === table.id).map(c => (
            <div key={c.id} className={`tc-conflict-line sev-${c.severity}`}>⚠ {c.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Conflict evaluation ──────────────────────────────────────────────────────
// Conflicts are derived live from the rules the planner actually applied and the
// current seating — not a fixed list. No rules (or a clean layout) means no
// conflicts, and dragging a guest to a valid table clears the flag on its own.
//
// MVP capability, honestly scoped:
//   • KEEP_APART / SEAT_TOGETHER  → same-table relationships (hard, enforced)
//   • ZONE_AVOID                  → keep guests out of a zone (hard, enforced)
// Positive "place near" preferences are intentionally out of scope — placement
// is only enforced as avoidance. Zones map to table attributes we actually model.
const ZONE_MAP = {
  'away from bar':      { attr: 'nearBar',      want: false },
  'away from speakers': { attr: 'nearSpeakers', want: false },
  'away from service':  { attr: 'nearService',  want: false },
};
const zoneSpec = (zone) => ZONE_MAP[(zone || '').trim().toLowerCase()];
// Supported avoidance zones, surfaced as options when editing a keep-away rule.
const AVOID_ZONES = ['Away from speakers', 'Away from bar', 'Away from service'];

const firstName = (id) => guest(id)?.name.split(' ')[0] || `#${id}`;
const nameList = (ids) => {
  const names = ids.map(firstName);
  return names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

function detectConflicts(rules, assignment, tables) {
  const tableOf = {};
  for (const [tid, ids] of Object.entries(assignment)) {
    for (const id of ids) tableOf[id] = Number(tid);
  }
  const tableById = Object.fromEntries(tables.map(t => [t.id, t]));
  const out = [];

  const flagZone = (rule, ids) => {
    const spec = zoneSpec(rule.zone);
    if (!spec) return;
    const bad = ids.filter(id => Boolean(tableById[tableOf[id]]?.[spec.attr]) !== spec.want);
    if (bad.length === 0) return;
    out.push({
      id: `${rule.id}-zone`,
      severity: 'medium',
      message: `${nameList(bad)} ${bad.length > 1 ? 'are' : 'is'} at ${tableById[tableOf[bad[0]]].name} — conflicts with “${rule.zone}”.`,
      guests: bad,
      table: tableOf[bad[0]],
    });
  };

  for (const rule of rules) {
    const seated = rule.guests.filter(id => tableOf[id] != null);
    if (seated.length === 0) continue;

    if (rule.type === 'KEEP_APART') {
      const byTable = {};
      seated.forEach(id => (byTable[tableOf[id]] ||= []).push(id));
      for (const [tid, ids] of Object.entries(byTable)) {
        if (ids.length > 1) {
          out.push({
            id: `${rule.id}-${tid}`,
            severity: 'high',
            message: `${nameList(ids)} are seated together at ${tableById[tid].name} — violates a keep-apart rule.`,
            guests: ids,
            table: Number(tid),
          });
        }
      }
    } else if (rule.type === 'SEAT_TOGETHER') {
      const used = [...new Set(seated.map(id => tableOf[id]))];
      if (used.length > 1) {
        out.push({
          id: `${rule.id}-split`,
          severity: 'medium',
          message: `${nameList(seated)} should sit together but are split across ${used.length} tables.`,
          guests: seated,
          table: tableOf[seated[0]],
        });
      }
    } else if (rule.type === 'ZONE_AVOID') {
      flagZone(rule, seated);
    }
  }
  return out;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function SeatingCanvas({ appliedRules, onApprove, onBack }) {
  const [assignment, setAssignment] = useState({
    1: [1, 3, 4, 5, 6, 7],
    2: [8, 23, 24, 22, 21],
    3: [2, 10, 15, 17, 9],
    4: [11, 12, 13, 14],
    5: [16],
    6: [18, 19, 20],
  });
  const conflicts = useMemo(
    () => detectConflicts(appliedRules, assignment, TABLES),
    [appliedRules, assignment],
  );
  const [dragging, setDragging] = useState(null);
  const [includePending, setIncludePending] = useState(true);

  const isPending = (id) => GUESTS.find(g => g.id === id)?.rsvp === 'pending';
  const pendingCount = Object.values(assignment).flat().filter(isPending).length;

  const handleDragStart = (guestId, fromTable) => setDragging({ guestId, fromTable });
  const handleDrop = (toTable) => {
    if (!dragging || dragging.fromTable === toTable) { setDragging(null); return; }
    const { guestId, fromTable } = dragging;
    setAssignment(prev => ({
      ...prev,
      [fromTable]: prev[fromTable].filter(id => id !== guestId),
      [toTable]: [...(prev[toTable] || []), guestId],
    }));
    // Conflicts re-derive from the new assignment automatically.
    setDragging(null);
  };

  const active = conflicts;

  return (
    <div className="screen canvas-screen">
      <div className="canvas-main">
        <div className="canvas-hd">
          <div>
            <h2>Seating Draft</h2>
            <p className="sub-text">Drag guests between tables to resolve conflicts. Publish when ready.</p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label className="pending-toggle" title="Pending guests hold provisional seats — constraints still apply. Uncheck to view confirmed-only layout.">
              <input type="checkbox" checked={includePending} onChange={e => setIncludePending(e.target.checked)} />
              Show pending guests
            </label>
            <button className="btn-outline" onClick={onBack}>← Back</button>            <button className="btn-primary" onClick={() => {
              const seated = Object.values(assignment).flat().length;
              const open = active.length;
              onApprove({ guestsSeated: seated, openConflicts: open });
            }}>✦ Publish to Seating Chart →</button>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="pending-banner">
            ⏳ <strong>{pendingCount} pending guests</strong> hold provisional seats — constraints still apply. Finalise the layout after RSVPs close.
          </div>
        )}

        <div className="canvas-legend">
          <span className="legend-label">Legend</span>
          <span className="legend-group">
            <span className="legend-group-label">Meal</span>
            <span className="legend-item"><span className="seat-meal pill-standard" /> Standard</span>
            <span className="legend-item"><span className="seat-meal pill-vegetarian" /> Vegetarian</span>
          </span>
          <span className="legend-sep" />
          <span className="legend-group">
            <span className="legend-group-label">Seat</span>
            <span className="legend-item"><span className="legend-swatch legend-pending" /> Pending RSVP</span>
            <span className="legend-item"><span className="legend-swatch legend-flagged" /> In conflict</span>
          </span>
        </div>

        <div className="tables-grid">
          {TABLES.map(t => (
            <TableCard
              key={t.id}
              table={t}
              guestIds={(assignment[t.id] || []).filter(id => includePending || !isPending(id))}
              conflicts={active}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      <div className="canvas-sidebar">
        <div className="sidebar-hd">
          Conflicts{active.length > 0 && <span className="badge-red">{active.length}</span>}
        </div>

        <div className="sidebar-body">
          <>
            {active.length === 0 && (
                <div className="empty-state">
                  <div className="empty-check">✓</div>
                  <p>No unresolved conflicts</p>
                  <p className="sub-text">Good to approve</p>
                </div>
              )}
              {active.map(c => (
                <div key={c.id} className={`conflict-card sev-${c.severity}`}>
                  <div className="conflict-sev">{c.severity === 'high' ? '⚠ High priority' : '⚡ Medium'}</div>
                  <p className="conflict-msg">{c.message}</p>
                  <div className="conflict-guests">
                    {c.guests.map(id => <span key={id} className="guest-tag">{guest(id)?.name.split(' ')[0]}</span>)}
                  </div>
                </div>
              ))}
              <div className="sidebar-divider" />
              <div className="recap">
                <div className="recap-label">Rules applied</div>
                {appliedRules.length === 0 && (
                  <div className="recap-empty">No constraints applied — drag freely to arrange.</div>
                )}
                {appliedRules.map(r => {
                  const meta = RULE_LABELS[r.type] || RULE_LABELS.CUSTOM;
                  const icon = HARDCODED_CONSTRAINTS.find(c => c.id === r.id)?.icon || '✎';
                  return (
                    <div key={r.id} className="recap-row">
                      <span>{icon}</span>
                      <div className="recap-body">
                        <Tooltip text={meta.tip}>
                          <span className={`rule-badge ${meta.cls}`}>{meta.label}</span>
                        </Tooltip>
                        <span className="recap-text">
                          {r.guests.map(id => guest(id)?.name.split(' ')[0]).join(', ')}
                          {r.zone ? ` · ${r.zone}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
          </>
        </div>
      </div>
    </div>
  );
}

// ─── Approved ─────────────────────────────────────────────────────────────────
function Approved({ onBack, guestsSeated, openConflicts }) {
  return (
    <div className="screen center-screen">
      <div className="approved-card">
        <div className="approved-check">✓</div>
        <h2>Published to Seating Chart</h2>
        <p className="sub-text">The arrangement is now live in your Seating Charts tab. Share with the couple or export when ready.</p>
        <div className="approved-actions">
          <button className="btn-primary btn-lg">Share with Couple</button>
          <button className="btn-outline">Export PDF</button>
          <button className="btn-outline">Print Chart</button>
        </div>
        <div className="approved-stats">
          {[[String(guestsSeated),'guests seated'],[String(TABLES.length),'tables arranged'],[String(openConflicts),'conflicts open']].map(([v,l]) => (
            <div key={l} className="apstat"><strong>{v}</strong><span>{l}</span></div>
          ))}
        </div>
        <button className="link-btn" onClick={onBack}>← Back to canvas</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [publishStats, setPublishStats] = useState({ guestsSeated: 0, openConflicts: 0 });
  const [appliedRules, setAppliedRules] = useState([]);
  const [added, setAdded] = useState([]);
  const [editedRules, setEditedRules] = useState({});
  const [customList, setCustomList] = useState([]);
  const go = (s) => setScreen(s);
  return (
    <div className="app">
      <ProductSidebar onNavigate={go} />
      <div className="app-body">
        <main className="app-main">
          {WORKFLOW_SCREENS.includes(screen) && (
            <div className="workflow-bar">
              <div className="workflow-bar-inner">
                <WorkflowStepper screen={screen} onNavigate={go} />
              </div>
            </div>
          )}
          {screen === 'dashboard'   && <Dashboard onStart={() => go('constraints')} />}
          {screen === 'constraints' && <ConstraintCapture added={added} setAdded={setAdded} editedRules={editedRules} setEditedRules={setEditedRules} customList={customList} setCustomList={setCustomList} onGenerate={(rules) => { setAppliedRules(rules); go('generating'); }} onBack={() => go('dashboard')} />}
          {screen === 'generating'  && <Generating onDone={() => go('canvas')} />}
          {screen === 'canvas'      && <SeatingCanvas appliedRules={appliedRules} onApprove={(stats) => { setPublishStats(stats); go('approved'); }} onBack={() => go('constraints')} />}
          {screen === 'approved'    && <Approved onBack={() => go('canvas')} guestsSeated={publishStats.guestsSeated} openConflicts={publishStats.openConflicts} />}
        </main>
      </div>
    </div>
  );
}
