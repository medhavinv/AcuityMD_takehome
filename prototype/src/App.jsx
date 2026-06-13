import { useState, useEffect, useRef } from 'react';
import { WEDDING, GUESTS, TABLES, HARDCODED_CONSTRAINTS, CONFLICTS, RATIONALE } from './data';
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
  ZONE_AVOID:    { label: '↗ Keep away',     cls: 'rule-zone',     tip: 'These guests will be kept away from the specified zone (e.g. speakers, bar).' },
  ZONE_PREFER:   { label: '◎ Place near',    cls: 'rule-zone',     tip: 'These guests will be prioritised for placement near the specified zone (e.g. service, bar).' },
  CUSTOM:        { label: '✎ Custom rule',   cls: 'rule-custom',   tip: 'Rule parsed from your note. Matched guests shown — edit the text if anyone is missing.' },
  ERROR:         { label: '⚠ Unknown',       cls: 'rule-error',    tip: 'Could not parse a rule. Select a rule type and add the guests it applies to.' },
};

// Match typed text against guest names (word-boundary, skips honorifics).
const matchGuestsByName = (text) => {
  const skip = new Set(['uncle', 'aunt']);
  return GUESTS.filter(g =>
    g.name.split(' ').some(w =>
      w.length > 2 && !skip.has(w.toLowerCase()) && new RegExp(`\\b${w}\\b`, 'i').test(text)
    )
  ).map(g => g.id);
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

  const update = (updated) => { setLocalRule(updated); onChange(updated); };
  const removeGuest = (id) => update({ ...localRule, guests: localRule.guests.filter(g => g !== id) });
  const addGuest = (e) => {
    const id = parseInt(e.target.value);
    if (!id || localRule.guests.includes(id)) return;
    update({ ...localRule, guests: [...localRule.guests, id] });
    e.target.value = '';
  };
  const setType = (e) => update({ ...localRule, type: e.target.value });

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

      {localRule.zone && <span className="rule-zone-tag">{localRule.zone}</span>}

      {unaddedGuests.length > 0 && (
        <select className="rule-add-guest" defaultValue="" onChange={addGuest}>
          <option value="" disabled>＋ guest</option>
          {unaddedGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}

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
function ProductSidebar() {
  const existing = [
    { key: 'guests',  label: 'Guest List',    icon: '👥', sub: `${GUESTS.length} guests`,        source: true  },
    { key: 'charts',  label: 'Seating Charts', icon: '▦',  sub: `${TABLES.length} tables`,        source: true  },
    { key: 'todo',    label: 'To-Do Tracker',  icon: '✓',  sub: '12 open',                        source: false },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">WedSeat</span>
      </div>

      <div className="sidebar-section-label">Planning</div>
      <nav className="sidebar-nav">
        {existing.map(f => (
          <div
            key={f.key}
            className="side-item side-disabled"
            title={f.source ? 'Existing feature — feeds data into Seating Arrangement' : 'Existing feature — outside this prototype'}
          >
            <span className="side-icon">{f.icon}</span>
            <div className="side-text">
              <span className="side-label">{f.label}</span>
              <span className="side-sub">{f.sub}</span>
            </div>
            {f.source && <span className="side-source">source</span>}
          </div>
        ))}
      </nav>

      <div className="sidebar-section-label" style={{marginTop:18}}>New</div>
      <nav className="sidebar-nav">
        <div className="side-item side-active">
          <span className="side-icon">◆</span>
          <div className="side-text">
            <span className="side-label">Seating Arrangement</span>
            <span className="side-sub">AI-assisted</span>
          </div>
          <span className="side-new">AI</span>
        </div>
      </nav>

      <div className="sidebar-foot">
        <div className="sf-label">Active wedding</div>
        <div className="sf-name">{WEDDING.name}</div>
        <div className="sf-date">{WEDDING.venue} · {WEDDING.date}</div>
      </div>
    </aside>
  );
}

// ─── Top Bar (seating sub-flow) ───────────────────────────────────────────────
const FLOW = [
  { key: 'dashboard',   label: 'Overview' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'canvas',      label: 'Review & Edit' },
  { key: 'approved',    label: 'Published' },
];

function TopNav({ screen, onNavigate }) {
  const active = FLOW.findIndex(s => s.key === screen);

  return (
    <nav className="topnav">
      <div className="topnav-context">
        <span className="ctx-feature">Seating Arrangement</span>
        <span className="ctx-sep">/</span>
        <span className="ctx-current">{FLOW[active]?.label}</span>
      </div>
      <div className="topnav-steps">
        {FLOW.map((s, i) => {
          const clickable = true;
          return (
            <button
              key={s.key}
              className={`nav-step ${i === active ? 'active' : ''} ${i < active ? 'done' : ''} ${clickable ? 'clickable' : ''}`}
              onClick={() => clickable && onNavigate(s.key)}
              disabled={!clickable}
            >
              <span className="nav-dot">{i < active ? '✓' : i + 1}</span>
              <span className="nav-label">{s.label}</span>
              {i < FLOW.length - 1 && <span className="nav-line" />}
            </button>
          );
        })}
      </div>
    </nav>
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
          <span className="how-strip-step"><b>3</b> You edit, then approve before sharing</span>
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
            <div className="panel-meta"><span className="badge">{TABLES.length} tables</span><span className="badge-muted">8 seats avg</span></div>
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
          <div className="panel-foot">
            <button className="btn-primary btn-lg" onClick={onStart}>Auto-Arrange Seating →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Constraint Capture ───────────────────────────────────────────────────────
function ConstraintCapture({ onGenerate, onBack }) {
  const [added, setAdded] = useState([]);
  const [editedRules, setEditedRules] = useState({});  // overrides for hardcoded constraint rules
  const [custom, setCustom] = useState('');
  const [customList, setCustomList] = useState([]);

  const toggle = (id) => setAdded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const getRule = (c) => editedRules[c.id] || c.rule;
  const addCustom = () => {
    const text = custom.trim();
    if (!text) return;
    // Always add — start in ERROR state so the planner must pick a rule type.
    // Pre-fill any guests matched by name so they only need to pick the type.
    const rule = { type: 'ERROR', guests: matchGuestsByName(text) };
    setCustomList(prev => [...prev, { id: `custom-${Date.now()}`, text, rule }]);
    setCustom('');
    setCustomError('');
  };
  const removeCustom = (id) => setCustomList(prev => prev.filter(c => c.id !== id));
  const updateCustomRule = (id, rule) => setCustomList(prev => prev.map(c => c.id === id ? { ...c, rule } : c));
  const totalCount = added.length + customList.length;

  return (
    <div className="screen two-col">
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
          <div className="suggestions-label"><span className="ai-spark">✦</span> Custom constraint <span className="ai-label">AI parses guest names</span></div>
          <div style={{display:'flex',gap:8}}>
            <textarea
              className="constraint-input"
              placeholder="e.g. Keep the O'Brien family together — they flew in from Ireland..."
              value={custom}
              onChange={e => setCustom(e.target.value)}
              rows={3}
            />
            <button className="btn-outline" disabled={!custom.trim()} onClick={addCustom}>Add</button>
          </div>
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
            {customList.map(c => (
              <div key={c.id} className={`added-item${c.rule.type === 'ERROR' ? ' added-item-error' : ''}`}>
                <div className="added-main">
                  <span className="added-text">✎ {c.text}</span>
                  <EditableRuleRow
                    rule={c.rule}
                    onChange={(updated) => updateCustomRule(c.id, updated)}
                  />
                </div>
                <button className="remove-btn" onClick={() => removeCustom(c.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="generate-footer">
          <div className="info-note">
            <span className="info-icon">ℹ</span>
            AI uses your guest list, RSVPs, table capacities, and constraints. You review and approve before anything is shared.
          </div>
          <button className="btn-primary btn-lg" onClick={() => onGenerate(added)}>Generate Seating Draft →</button>
        </div>
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
    'Building rationale…',
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
  }, [step]);

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

// ─── Canvas ───────────────────────────────────────────────────────────────────
function SeatingCanvas({ onApprove, onBack }) {
  const [assignment, setAssignment] = useState({
    1: [1, 3, 4, 5, 6, 7],
    2: [8, 23, 24, 22, 21],
    3: [2, 10, 15, 17, 9, 13],
    4: [11, 12, 14, 18, 19, 20],
    5: [16],
    6: [],
  });
  const [conflicts, setConflicts] = useState(CONFLICTS);
  const [dragging, setDragging] = useState(null);
  const [tab, setTab] = useState('conflicts');
  const [dismissed, setDismissed] = useState([]);
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
    setConflicts(prev => prev.filter(c => !c.guests.includes(guestId)));
    setDragging(null);
  };

  const active = conflicts.filter(c => !dismissed.includes(c.id));
  const dismiss = (id) => setDismissed(d => [...d, id]);

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
            <button className="btn-outline" onClick={onBack}>← Back</button>
            <button className="btn-outline">↺ Regenerate</button>
            <button className="btn-primary" onClick={onApprove}>✦ Publish to Seating Chart →</button>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="pending-banner">
            ⏳ <strong>{pendingCount} pending guests</strong> hold provisional seats — constraints still apply. Finalise the layout after RSVPs close.
          </div>
        )}

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
        <div className="sidebar-tabs">
          {['conflicts', 'rationale'].map(t => (
            <button key={t} className={`stab${tab === t ? ' stab-on' : ''}`} onClick={() => setTab(t)}>
              {t === 'conflicts' ? <>Conflicts{active.length > 0 && <span className="badge-red">{active.length}</span>}</> : 'Rationale'}
            </button>
          ))}
        </div>

        <div className="sidebar-body">
          {tab === 'conflicts' && (
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
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <button className="btn-sm btn-outline">Move guests</button>
                    <button className="btn-sm btn-ghost" onClick={() => dismiss(c.id)}>Dismiss</button>
                  </div>
                </div>
              ))}
              <div className="sidebar-divider" />
              <div className="recap">
                <div className="recap-label">Rules applied</div>
                {HARDCODED_CONSTRAINTS.map(c => {
                  const meta = RULE_LABELS[c.rule.type];
                  return (
                    <div key={c.id} className="recap-row">
                      <span>{c.icon}</span>
                      <div className="recap-body">
                        <span className={`rule-badge ${meta.cls}`} data-tooltip={meta.tip}>{meta.label}</span>
                        <span className="recap-text">
                          {c.rule.guests.map(id => guest(id)?.name.split(' ')[0]).join(', ')}
                          {c.rule.zone ? ` · ${c.rule.zone}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'rationale' && RATIONALE.map(r => {
            const t = TABLES.find(t => t.id === r.table);
            return (
              <div key={r.table} className="rationale-card">
                <div className="rationale-table">{t?.name}</div>
                <p className="rationale-note">{r.note}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Approved ─────────────────────────────────────────────────────────────────
function Approved({ onBack }) {
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
          {[['24','guests seated'],['6','tables arranged'],['0','conflicts open']].map(([v,l]) => (
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
  const go = (s) => setScreen(s);
  return (
    <div className="app">
      <ProductSidebar />
      <div className="app-body">
        <TopNav screen={screen} onNavigate={go} />
        <main className="app-main">
          {screen === 'dashboard'   && <Dashboard onStart={() => go('constraints')} />}
          {screen === 'constraints' && <ConstraintCapture onGenerate={() => go('generating')} onBack={() => go('dashboard')} />}
          {screen === 'generating'  && <Generating onDone={() => go('canvas')} />}
          {screen === 'canvas'      && <SeatingCanvas onApprove={() => go('approved')} onBack={() => go('constraints')} />}
          {screen === 'approved'    && <Approved onBack={() => go('canvas')} />}
        </main>
      </div>
    </div>
  );
}
