import { useState, useEffect } from 'react';
import { WEDDING, GUESTS, TABLES, HARDCODED_CONSTRAINTS, CONFLICTS, RATIONALE } from './data';
import './App.css';

const guest = (id) => GUESTS.find(g => g.id === id);

// ─── Structured rules ─────────────────────────────────────────────────────────
// MVP: constraints bind to guests by NAME (resolved to guest IDs), not by
// attribute. The rule row below each added constraint shows the planner exactly
// what the system will execute.
const RULE_LABELS = {
  KEEP_APART:    { label: '✕ Keep apart',    cls: 'rule-apart' },
  SEAT_TOGETHER: { label: '⊕ Seat together', cls: 'rule-together' },
  ZONE_AVOID:    { label: '↗ Keep away',     cls: 'rule-zone' },
  ZONE_PREFER:   { label: '◎ Place near',    cls: 'rule-zone' },
  CUSTOM:        { label: '✎ Custom rule',   cls: 'rule-custom' },
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

function RuleRow({ rule }) {
  const meta = RULE_LABELS[rule.type] || RULE_LABELS.CUSTOM;
  return (
    <div className="rule-row">
      <span className={`rule-badge ${meta.cls}`}>{meta.label}</span>
      {rule.guests.length > 0 ? (
        rule.guests.map(id => (
          <span key={id} className="rule-guest">
            <span className="rule-guest-av">{guest(id)?.name[0]}</span>
            {guest(id)?.name.split(' ').slice(0, 2).join(' ')}
          </span>
        ))
      ) : (
        <span className="rule-nomatch">⚠ No guests matched by name — name specific guests so the rule can be applied</span>
      )}
      {rule.zone && <span className="rule-zone-tag">{rule.zone}</span>}
    </div>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────
const FLOW = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'generating', label: 'Generating' },
  { key: 'canvas', label: 'Review & Edit' },
  { key: 'approved', label: 'Approved' },
];

function TopNav({ screen, onNavigate }) {
  const active = FLOW.findIndex(s => s.key === screen);

  return (
    <nav className="topnav">
      <div className="topnav-brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">WedSeat</span>
      </div>
      <div className="topnav-steps">
        {FLOW.map((s, i) => {
          // Generating is a transient state — not a place you navigate to.
          const clickable = s.key !== 'generating';
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
      <div className="topnav-wedding">
        <div className="wedding-name">{WEDDING.name}</div>
        <div className="wedding-date">{WEDDING.date}</div>
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
          <h1 className="dash-title">{WEDDING.name}</h1>
          <p className="dash-sub">{WEDDING.venue} &nbsp;·&nbsp; {WEDDING.date}</p>
        </div>
        <button className="btn-primary btn-lg" onClick={onStart}>✦&nbsp; Arrange Seating with AI</button>
      </div>

      <div className="stats-row">
        {[
          { label: 'Guests confirmed', value: '24', sub: '6 pending' },
          { label: 'Tables set up', value: '6', sub: '8 seats avg' },
          { label: 'Seating status', value: 'Unassigned', sub: 'Action needed', alert: true },
          { label: 'Days to wedding', value: '94', sub: WEDDING.date },
        ].map(s => (
          <div key={s.label} className={`stat-card${s.alert ? ' stat-alert' : ''}`}>
            <div className="stat-val">{s.value}</div>
            <div className="stat-lbl">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-panels">
        <div className="panel">
          <div className="panel-hd"><h3>Guest List</h3><span className="badge">{GUESTS.length}</span></div>
          <div className="list-scroll">
            {GUESTS.slice(0, 10).map(g => (
              <div key={g.id} className="list-row">
                <div className="avatar">{g.name[0]}</div>
                <div className="list-info">
                  <div className="list-name">{g.name}</div>
                  <div className="list-sub">{g.relation}</div>
                </div>
                <span className={`pill pill-${g.meal.toLowerCase().replace(/\s/g,'')}`}>{g.meal}</span>
              </div>
            ))}
            <div className="list-more">+{GUESTS.length - 10} more guests</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd"><h3>Tables</h3><span className="badge">{TABLES.length}</span></div>
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

        <div className="panel panel-action">
          <div className="action-icon">✦</div>
          <h3>How AI seating works</h3>
          <ol className="how-list">
            <li>Add the couple's constraints — relationships, conflicts, preferences.</li>
            <li>AI drafts a chart from your guest list and flags conflicts.</li>
            <li>You edit on the canvas, then approve before anything is shared.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Constraint Capture ───────────────────────────────────────────────────────
function ConstraintCapture({ onGenerate, onBack }) {
  const [added, setAdded] = useState([]);
  const [custom, setCustom] = useState('');
  const [customList, setCustomList] = useState([]);

  const toggle = (id) => setAdded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const addCustom = () => {
    const text = custom.trim();
    if (!text) return;
    const rule = { type: 'CUSTOM', guests: matchGuestsByName(text) };
    setCustomList(prev => [...prev, { id: `custom-${Date.now()}`, text, rule }]);
    setCustom('');
  };
  const removeCustom = (id) => setCustomList(prev => prev.filter(c => c.id !== id));
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
              {g.mobility && <span className="tag tag-mob" title="Accessibility need (from RSVP)">♿</span>}
              <span className={`pill pill-${g.meal.toLowerCase().replace(/\s/g,'')}`}>{g.meal}</span>
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
          <div className="suggestions-label">Custom constraint</div>
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
            <div className="suggestions-label">Added ({totalCount}) — each resolves to a rule the system can execute</div>
            {HARDCODED_CONSTRAINTS.filter(c => added.includes(c.id)).map(c => (
              <div key={c.id} className="added-item">
                <div className="added-main">
                  <span>{c.icon} {c.text}</span>
                  <RuleRow rule={c.rule} />
                </div>
                <button className="remove-btn" onClick={() => toggle(c.id)}>×</button>
              </div>
            ))}
            {customList.map(c => (
              <div key={c.id} className="added-item">
                <div className="added-main">
                  <span>✎ {c.text}</span>
                  <RuleRow rule={c.rule} />
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
          <button className="btn-primary btn-lg" onClick={() => onGenerate(added)}>✦&nbsp; Generate Seating Draft</button>
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
          return (
            <div key={id} className={`seat${flagged ? ' seat-flagged' : ''}`}
              draggable onDragStart={() => onDragStart(id, table.id)}>
              <div className="seat-av">{g.name[0]}</div>
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
            <p className="sub-text">Drag guests between tables to resolve conflicts. Approve when ready.</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn-outline" onClick={onBack}>← Back</button>
            <button className="btn-outline">↺ Regenerate</button>
            <button className="btn-primary" onClick={onApprove}>✓ Approve & Share →</button>
          </div>
        </div>

        <div className="tables-grid">
          {TABLES.map(t => (
            <TableCard
              key={t.id}
              table={t}
              guestIds={assignment[t.id] || []}
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
                        <span className={`rule-badge ${meta.cls}`}>{meta.label}</span>
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
        <h2>Seating Chart Approved</h2>
        <p className="sub-text">Finalised and ready to share with the couple or send to the venue.</p>
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
      <TopNav screen={screen} onNavigate={go} />
      <main className="app-main">
        {screen === 'dashboard'   && <Dashboard onStart={() => go('constraints')} />}
        {screen === 'constraints' && <ConstraintCapture onGenerate={() => go('generating')} onBack={() => go('dashboard')} />}
        {screen === 'generating'  && <Generating onDone={() => go('canvas')} />}
        {screen === 'canvas'      && <SeatingCanvas onApprove={() => go('approved')} onBack={() => go('constraints')} />}
        {screen === 'approved'    && <Approved onBack={() => go('canvas')} />}
      </main>
    </div>
  );
}
