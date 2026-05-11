"use client";
import { useState, useRef, useEffect } from "react";

// ─── GLOBAL ANIMATIONS ────────────────────────────────────────────────────────
const ANIM_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
@keyframes strikeIn {
  from { width: 0; }
  to   { width: 100%; }
}
@keyframes doneGlow {
  0%   { box-shadow: 0 0 0 0px rgba(99,102,241,0.5); }
  50%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0px rgba(99,102,241,0); }
}
@keyframes popIn {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.2); }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.task-row { animation: slideUp .2s ease both; }
.task-row:nth-child(2)  { animation-delay: .03s; }
.task-row:nth-child(3)  { animation-delay: .06s; }
.task-row:nth-child(4)  { animation-delay: .09s; }
.task-row:nth-child(5)  { animation-delay: .12s; }
.task-row:nth-child(6)  { animation-delay: .15s; }
.done-check { animation: popIn .3s cubic-bezier(.34,1.56,.64,1) both; }
.done-glow  { animation: doneGlow .6s ease-out both; }
.expand-panel { animation: slideUp .15s ease both; }
`;

function GlobalStyle() {
  return <style dangerouslySetInnerHTML={{ __html: ANIM_STYLE }} />;
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
const PX_PER_MIN = 2.8;
const TL_START   = 6 * 60;
const TL_END     = 24 * 60;

const minToPx  = m  => (m - TL_START) * PX_PER_MIN;
const pxToMin  = px => TL_START + px / PX_PER_MIN;
const snapMin  = m  => Math.round(m / 5) * 5;
const clampMin = m  => Math.max(TL_START, Math.min(TL_END - 1, m));

function fmt(m) {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60), mn = t % 60;
  const p = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
  return `${h12}:${String(mn).padStart(2, "0")} ${p}`;
}
function fmtDur(m) {
  if (!m || m <= 0) return "";
  const h = Math.floor(m / 60), min = m % 60;
  return h && min ? `${h}h ${min}m` : h ? `${h}h` : `${min}m`;
}
function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
function toHHMM(m) {
  const t = Math.max(0, Math.min(1439, Math.round(m)));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fromHHMM(s) {
  const [h, mn] = (s || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (mn || 0);
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayKey() { return dateKey(new Date()); }
function offsetDate(key, delta) {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const TASK_COLORS = [
  { id: "rose",   hex: "#f87171", light: "#fef2f2", text: "#991b1b" },
  { id: "amber",  hex: "#fbbf24", light: "#fffbeb", text: "#92400e" },
  { id: "sage",   hex: "#34d399", light: "#ecfdf5", text: "#065f46" },
  { id: "sky",    hex: "#38bdf8", light: "#f0f9ff", text: "#0c4a6e" },
  { id: "violet", hex: "#a78bfa", light: "#f5f3ff", text: "#4c1d95" },
  { id: "mint",   hex: "#2dd4bf", light: "#f0fdfa", text: "#134e4a" },
  { id: "peach",  hex: "#fb923c", light: "#fff7ed", text: "#7c2d12" },
  { id: "pink",   hex: "#f472b6", light: "#fdf2f8", text: "#831843" },
  { id: "slate",  hex: "#94a3b8", light: "#f8fafc", text: "#1e293b" },
  { id: "lime",   hex: "#a3e635", light: "#f7fee7", text: "#3a5a0a" },
];
const getColor = id => TASK_COLORS.find(c => c.id === id) || TASK_COLORS[8];

const ICONS = ["☀️","🏃","💻","🍽️","🌙","📝","🎯","💡","🔧","✍️","🧠","🎨","📌","⚡","📋","🔍","📚","📞","🏋️","🏆","🌟","☕","🎵","🚴","🧘","🛒","💊","✈️","🎮","📊","🤝","🌿","🔥","⏰","🎪","🏠"];

// ─── SEED DATA ─────────────────────────────────────────────────────────────────
let _nid = 300;
const genId = () => `t${++_nid}`;
const TODAY = todayKey();

const SEED_TASKS = {
  [TODAY]: [
    { id: "t1", name: "Morning run",   start: 7 * 60,  dur: 45,  icon: "🏃", color: "sage",   done: false, date: TODAY, subtasks: [{ text: "Warm up 5 min", done: false }, { text: "3km run", done: false }], notes: "Try the park route today" },
    { id: "t2", name: "Deep work",     start: 9 * 60,  dur: 120, icon: "💻", color: "sky",    done: false, date: TODAY, subtasks: [{ text: "Review PRs", done: false }, { text: "Write tests", done: false }, { text: "Deploy", done: false }], notes: "Focus mode: no Slack" },
    { id: "t3", name: "Lunch",         start: 12 * 60, dur: 45,  icon: "🍽️", color: "peach",  done: false, date: TODAY, subtasks: [], notes: "" },
    { id: "t4", name: "Team standup",  start: 13 * 60, dur: 30,  icon: "🤝", color: "violet", done: false, date: TODAY, subtasks: [{ text: "Share updates", done: false }], notes: "Zoom link in calendar" },
    { id: "t5", name: "Evening walk",  start: 18 * 60, dur: 40,  icon: "🌿", color: "mint",   done: false, date: TODAY, subtasks: [], notes: "" },
    { id: "t6", name: "Read",          start: 21 * 60, dur: 60,  icon: "📚", color: "amber",  done: false, date: TODAY, subtasks: [{ text: "Chapter 12", done: false }, { text: "Take notes", done: false }], notes: "Atomic Habits" },
  ],
};

const INIT_PANELS = [
  { id: "p1", label: "Quick Tasks", tasks: [
    { id: "s1", name: "Review PRs",       icon: "🔍", color: "slate",  dur: 30,  subtasks: [], notes: "" },
    { id: "s2", name: "Call mom",         icon: "📞", color: "rose",   dur: 20,  subtasks: [], notes: "" },
    { id: "s3", name: "Update portfolio", icon: "🎨", color: "violet", dur: 90,  subtasks: [], notes: "" },
  ]},
  { id: "p2", label: "This Week", tasks: [
    { id: "s4", name: "Gym session",  icon: "🏋️", color: "sage",  dur: 60, subtasks: [{ text: "Chest", done: false }], notes: "" },
    { id: "s5", name: "Weekly review",icon: "📊", color: "sky",   dur: 45, subtasks: [], notes: "" },
  ]},
  { id: "p3", label: "Backlog", tasks: [
    { id: "s6", name: "Read 20 pages", icon: "📚", color: "amber", dur: 30,  subtasks: [], notes: "" },
    { id: "s7", name: "Side project",  icon: "🔧", color: "peach", dur: 120, subtasks: [], notes: "" },
  ]},
];

// ─── MINI CALENDAR ─────────────────────────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect, tasksByDate }) {
  const base = new Date(selectedDate + "T00:00:00");
  const [vy, setVy] = useState(base.getFullYear());
  const [vm, setVm] = useState(base.getMonth());
  const todayStr = todayKey();
  const firstDow  = new Date(vy, vm, 1).getDay();
  const totalDays = new Date(vy, vm + 1, 0).getDate();
  const monthLabel = new Date(vy, vm, 1).toLocaleString("en-US", { month: "long" });
  function prev() { vm === 0 ? (setVm(11), setVy(y => y - 1)) : setVm(m => m - 1); }
  function next() { vm === 11 ? (setVm(0), setVy(y => y + 1)) : setVm(m => m + 1); }
  return (
    <div style={{ padding: "14px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", width: 220 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prev} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>‹</button>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: "0.05em" }}>{monthLabel} {vy}</div>
        <button onClick={next} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, color: "#9ca3af", fontWeight: 700, padding: "2px 0" }}>{d}</div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
          const dk = dateKey(new Date(vy, vm, d));
          const isSel = dk === selectedDate, isToday = dk === todayStr;
          const hasTasks = (tasksByDate[dk]?.length || 0) > 0;
          return (
            <button key={d} onClick={() => onSelect(dk)}
              style={{ textAlign: "center", fontSize: 10, padding: "5px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: isSel ? "#6366f1" : "transparent",
                color: isSel ? "#fff" : isToday ? "#6366f1" : "#374151",
                fontWeight: isToday || isSel ? 700 : 400, position: "relative" }}>
              {d}
              {hasTasks && !isSel && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "#6366f1" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SUBTASK ROW ───────────────────────────────────────────────────────────────
function SubtaskRow({ text, done, onToggle, onDelete, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
      <button onClick={onToggle} style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${done ? "#6366f1" : "#d1d5db"}`, background: done ? "#6366f1" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {done && <span style={{ fontSize: 8, color: "#fff", fontWeight: 800 }}>✓</span>}
      </button>
      {editing
        ? <input value={val} onChange={e => setVal(e.target.value)} onBlur={() => { onChange(val); setEditing(false); }} onKeyDown={e => { if (e.key === "Enter") { onChange(val); setEditing(false); } }} autoFocus
            style={{ flex: 1, background: "transparent", border: "none", color: "#374151", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
        : <span onClick={() => setEditing(true)} style={{ flex: 1, fontSize: 12, color: done ? "#9ca3af" : "#374151", textDecoration: done ? "line-through" : "none", cursor: "text" }}>{text || "Untitled"}</span>
      }
      <button onClick={onDelete} style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 12 }}>×</button>
    </div>
  );
}

// ─── TASK MODAL ────────────────────────────────────────────────────────────────
function TaskModal({ initial, selectedDate, onSave, onClose, onDelete }) {
  const [name,    setName]    = useState(initial?.name  || "");
  const [icon,    setIcon]    = useState(initial?.icon  || "📝");
  const [color,   setColor]   = useState(initial?.color || "slate");
  const [startS,  setStartS]  = useState(toHHMM(initial?.start ?? snapMin(nowMin() + 15)));
  const [durMode, setDurMode] = useState("duration");
  const [durH,    setDurH]    = useState(initial?.dur ? Math.floor(initial.dur / 60) : 0);
  const [durM,    setDurM]    = useState(initial?.dur ? initial.dur % 60 : 30);
  const [endS,    setEndS]    = useState(initial?.dur ? toHHMM(initial.start + initial.dur) : toHHMM(snapMin(nowMin() + 75)));
  const [taskDate,setTaskDate]= useState(initial?.date || selectedDate);
  const [subtasks,setSubtasks]= useState((initial?.subtasks || []).map((s, i) => ({ id: `sub${i}`, text: typeof s === "string" ? s : s.text, done: typeof s === "object" ? s.done : false })));
  const [notes,   setNotes]   = useState(initial?.notes || "");
  const [newSub,  setNewSub]  = useState("");
  const col = getColor(color);

  const computedDur = () => {
    if (durMode === "none") return null;
    if (durMode === "duration") { const d = durH * 60 + durM; return d > 0 ? d : null; }
    const s = fromHHMM(startS), e = fromHHMM(endS); return e > s ? e - s : null;
  };

  function handleSave() {
    if (!name.trim()) return;
    const s = clampMin(fromHHMM(startS));
    const dur = computedDur();
    onSave({ name: name.trim(), icon, color, start: s, dur, date: taskDate, subtasks: subtasks.map(s => ({ text: s.text, done: s.done })), notes });
  }

  function addSubtask() {
    if (!newSub.trim()) return;
    setSubtasks(p => [...p, { id: `sub${Date.now()}`, text: newSub.trim(), done: false }]);
    setNewSub("");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px", width: 400, fontFamily: "'DM Sans',-apple-system,sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto", color: "#111827" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: col.light, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{icon}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase" }}>{initial ? "Edit task" : "New task"}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Task name…" autoFocus
          style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#111827", fontSize: 15, fontWeight: 600, padding: "10px 13px", outline: "none", fontFamily: "inherit", marginBottom: 16 }} />
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Color</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {TASK_COLORS.map(tc => (
              <button key={tc.id} onClick={() => setColor(tc.id)}
                style={{ width: 24, height: 24, borderRadius: "50%", background: tc.hex, border: color === tc.id ? `3px solid #111` : `3px solid transparent`, cursor: "pointer", outline: "none" }} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Icon</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 80, overflowY: "auto" }}>
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                style={{ width: 32, height: 32, borderRadius: 7, border: `2px solid ${icon === ic ? "#6366f1" : "#e5e7eb"}`, background: icon === ic ? "#eef2ff" : "transparent", fontSize: 14, cursor: "pointer" }}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 7 }}>Date</div>
          <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 7 }}>Start time</div>
          <input type="time" value={startS} onChange={e => setStartS(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Duration</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["none","None"],["duration","Set duration"],["endtime","Set end time"]].map(([v, l]) => (
              <button key={v} onClick={() => setDurMode(v)}
                style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${durMode === v ? col.hex : "#e5e7eb"}`, background: durMode === v ? col.light : "transparent", color: durMode === v ? col.text : "#9ca3af", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {l}
              </button>
            ))}
          </div>
          {durMode === "duration" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <input type="number" min={0} max={23} value={durH} onChange={e => setDurH(Number(e.target.value))}
                  style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "inherit", textAlign: "center" }} />
                <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 3 }}>hours</div>
              </div>
              <div style={{ color: "#d1d5db", fontSize: 18, marginBottom: 14 }}>:</div>
              <div style={{ flex: 1 }}>
                <select value={durM} onChange={e => setDurM(Number(e.target.value))}
                  style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "inherit" }}>
                  {[0,5,10,15,20,25,30,45].map(v => <option key={v} value={v}>{String(v).padStart(2, "0")}</option>)}
                </select>
                <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 3 }}>minutes</div>
              </div>
              {(durH > 0 || durM > 0) && <div style={{ fontSize: 12, color: col.hex, fontWeight: 700 }}>{fmtDur(durH * 60 + durM)}</div>}
            </div>
          )}
          {durMode === "endtime" && (
            <>
              <input type="time" value={endS} onChange={e => setEndS(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "inherit" }} />
              {fromHHMM(endS) > fromHHMM(startS) && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>Duration: <strong style={{ color: col.hex }}>{fmtDur(fromHHMM(endS) - fromHHMM(startS))}</strong></div>
              )}
            </>
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Subtasks</div>
          {subtasks.map((sub, i) => (
            <SubtaskRow key={sub.id} text={sub.text} done={sub.done}
              onToggle={() => setSubtasks(p => p.map((s, j) => j === i ? { ...s, done: !s.done } : s))}
              onDelete={() => setSubtasks(p => p.filter((_, j) => j !== i))}
              onChange={v => setSubtasks(p => p.map((s, j) => j === i ? { ...s, text: v } : s))} />
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => e.key === "Enter" && addSubtask()}
              placeholder="Add subtask…"
              style={{ flex: 1, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, color: "#374151", fontSize: 12, padding: "7px 10px", outline: "none", fontFamily: "inherit" }} />
            <button onClick={addSubtask} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: col.hex, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+</button>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 7 }}>Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes, links…" rows={3}
            style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#374151", fontSize: 12, padding: "9px 12px", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {initial && onDelete && (
            <button onClick={onDelete} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Delete</button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #e5e7eb", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            {initial ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TASK CARD EXPANDED ────────────────────────────────────────────────────────
function TaskCardExpanded({ task, col, onToggleSubtask, onEdit }) {
  const doneSubs  = (task.subtasks || []).filter(s => s.done).length;
  const totalSubs = (task.subtasks || []).length;
  return (
    <div className="expand-panel" style={{ marginTop: 6, padding: "12px 14px", background: "#fff", border: `1.5px solid ${col.hex}55`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", position: "relative", zIndex: 25 }}>
      {totalSubs > 0 && (
        <div style={{ marginBottom: task.notes ? 10 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
            Subtasks · {doneSubs}/{totalSubs}
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalSubs ? doneSubs / totalSubs * 100 : 0}%`, background: col.hex, borderRadius: 2, transition: "width .4s" }} />
          </div>
          {(task.subtasks || []).map((sub, i) => (
            <div key={i} onClick={() => onToggleSubtask(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${sub.done ? col.hex : "#d1d5db"}`, background: sub.done ? col.hex : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sub.done && <span style={{ fontSize: 7, color: "#fff", fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: sub.done ? "#9ca3af" : "#374151", textDecoration: sub.done ? "line-through" : "none" }}>{sub.text}</span>
            </div>
          ))}
        </div>
      )}
      {task.notes && (
        <div style={{ marginTop: totalSubs > 0 ? 8 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.notes}</div>
        </div>
      )}
      <button onClick={onEdit} style={{ marginTop: 8, fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>✏️ Edit task</button>
    </div>
  );
}

// ─── SIDEBAR PANEL ITEM ────────────────────────────────────────────────────────
function SidePanelItem({ task, onDragStart }) {
  const col = getColor(task.color);
  return (
    <div
      onMouseDown={e => onDragStart(e, task, false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${col.hex}33`, background: col.light, marginBottom: 6, cursor: "grab", userSelect: "none", transition: "all .15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = col.hex + "88"; e.currentTarget.style.transform = "translateX(2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = col.hex + "33"; e.currentTarget.style.transform = "translateX(0)"; }}>
      <span style={{ fontSize: 16 }}>{task.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</div>
        <div style={{ fontSize: 10, color: col.text + "99", marginTop: 1 }}>{task.dur ? fmtDur(task.dur) : "No duration"}</div>
      </div>
      <div style={{ width: 4, height: 28, borderRadius: 2, background: col.hex, flexShrink: 0 }} />
    </div>
  );
}

// ─── ADD PANEL FORM ────────────────────────────────────────────────────────────
function AddPanelForm({ onAdd, onClose }) {
  const [name,  setName]  = useState("");
  const [icon,  setIcon]  = useState("📝");
  const [color, setColor] = useState("slate");
  const [durH,  setDurH]  = useState(0);
  const [durM,  setDurM]  = useState(30);
  const col = getColor(color);
  function handle() {
    if (!name.trim()) return;
    const dur = durH * 60 + durM;
    onAdd({ name: name.trim(), icon, color, dur: dur > 0 ? dur : null, subtasks: [], notes: "" });
  }
  return (
    <>
      <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="Task name…" autoFocus
        style={{ width: "100%", boxSizing: "border-box", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#111827", fontSize: 15, fontWeight: 600, padding: "10px 13px", outline: "none", fontFamily: "inherit", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {TASK_COLORS.map(tc => (
          <button key={tc.id} onClick={() => setColor(tc.id)} style={{ width: 22, height: 22, borderRadius: "50%", background: tc.hex, border: color === tc.id ? "3px solid #111" : "3px solid transparent", cursor: "pointer", outline: "none" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {ICONS.slice(0, 18).map(ic => (
          <button key={ic} onClick={() => setIcon(ic)}
            style={{ width: 30, height: 30, borderRadius: 7, border: `2px solid ${icon === ic ? "#6366f1" : "#e5e7eb"}`, background: icon === ic ? "#eef2ff" : "transparent", fontSize: 13, cursor: "pointer" }}>
            {ic}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="number" min={0} max={23} value={durH} onChange={e => setDurH(Number(e.target.value))}
          style={{ width: 60, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, color: "#374151", fontSize: 13, padding: "7px 10px", outline: "none", fontFamily: "inherit", textAlign: "center" }} />
        <span style={{ color: "#9ca3af" }}>h</span>
        <select value={durM} onChange={e => setDurM(Number(e.target.value))}
          style={{ width: 70, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, color: "#374151", fontSize: 13, padding: "7px 10px", outline: "none", fontFamily: "inherit" }}>
          {[0,5,10,15,20,25,30,45].map(v => <option key={v} value={v}>{String(v).padStart(2, "0")}</option>)}
        </select>
        <span style={{ color: "#9ca3af" }}>min</span>
        {(durH > 0 || durM > 0) && <span style={{ fontSize: 12, color: col.hex, fontWeight: 600 }}>{fmtDur(durH * 60 + durM)}</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid #e5e7eb", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
        <button onClick={handle} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Add</button>
      </div>
    </>
  );
}

// ─── OVERLAP HELPERS ──────────────────────────────────────────────────────────
// Returns set of task IDs that overlap with at least one other DURATION task
function computeOverlapIds(tasks) {
  const withDur = tasks.filter(t => t.dur && t.dur > 0);
  const ids = new Set();
  for (let i = 0; i < withDur.length; i++) {
    for (let j = i + 1; j < withDur.length; j++) {
      const a = withDur[i], b = withDur[j];
      const aEnd = a.start + a.dur, bEnd = b.start + b.dur;
      if (a.start < bEnd && aEnd > b.start) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

// Build gap list excluding overlapping segments so free time is accurate
function computeGaps(sorted) {
  const gaps = [];
  // Merge task spans to get true coverage
  const spans = sorted
    .filter(t => t.dur && t.dur > 0)
    .map(t => [t.start, t.start + t.dur])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of spans) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else {
      merged.push([s, e]);
    }
  }
  // Find no-dur tasks too (single points)
  const allStarts = sorted.map(t => t.start);
  // Build sorted event points
  const allSorted = [...sorted].sort((a, b) => a.start - b.start);
  for (let i = 0; i < allSorted.length - 1; i++) {
    const cur  = allSorted[i];
    const next = allSorted[i + 1];
    const curEnd = cur.start + (cur.dur || 0);
    const gapStart = curEnd;
    const gapEnd   = next.start;
    if (gapEnd - gapStart >= 40) {
      // check nothing from merged spans covers this gap
      const blocked = merged.some(([ms, me]) => ms < gapEnd && me > gapStart && ms !== cur.start);
      if (!blocked) gaps.push({ gs: gapStart, ge: gapEnd, dur: gapEnd - gapStart });
    }
  }
  return gaps;
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function FloaTasksPage() {
  const [tasksByDate, setTasksByDate]   = useState(SEED_TASKS);
  const [panels,      setPanels]        = useState(INIT_PANELS);
  const [selectedDate,setSelectedDate]  = useState(TODAY);
  const [now,         setNow]           = useState(nowMin());
  const [modal,       setModal]         = useState(null);
  const [drag,        setDrag]          = useState(null);
  const [expanded,    setExpanded]      = useState({});
  const [showCal,     setShowCal]       = useState(false);
  const [activePanelIdx, setActivePanelIdx] = useState(0);
  const [editingPanelId, setEditingPanelId] = useState(null);
  const [panelRenameVal,  setPanelRenameVal]  = useState("");

  const dragRef = useRef(null);
  const tlRef   = useRef(null);
  const calRef  = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(nowMin()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!showCal) return;
    function handler(e) { if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false); }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showCal]);

  const tasks   = tasksByDate[selectedDate] || [];
  const sorted  = [...tasks].sort((a, b) => a.start - b.start);
  const isToday = selectedDate === TODAY;
  const tlHeight= minToPx(TL_END) + 80;
  const activePanel = panels[activePanelIdx] || panels[0];

  // FIX 3: proper overlap set + proper gap computation
  const overlapIds = computeOverlapIds(tasks);
  const overlapWarnings = (() => {
    const warns = [];
    const withDur = sorted.filter(t => t.dur && t.dur > 0);
    for (let i = 0; i < withDur.length; i++) {
      for (let j = i + 1; j < withDur.length; j++) {
        const a = withDur[i], b = withDur[j];
        if (a.start < b.start + b.dur && a.start + a.dur > b.start) warns.push({ a: a.id, b: b.id });
      }
    }
    return warns;
  })();
  const gaps = computeGaps(sorted);

  function getStatus(task) {
    if (!isToday) return task.done ? "done" : "upcoming";
    if (task.done) return "done";
    const end = task.start + (task.dur || 0);
    if (now >= task.start && now <= end + 5) return "now";
    if (task.start - now > 0 && task.start - now <= 30) return "soon";
    if (task.start + (task.dur || 0) < now) return "past";
    return "upcoming";
  }
  function getProgress(task) {
    if (!isToday || !task.dur) return 0;
    if (now <= task.start) return 0;
    if (now >= task.start + task.dur) return 1;
    return (now - task.start) / task.dur;
  }

  function goToDate(delta) { setSelectedDate(d => offsetDate(d, delta)); }

  function beginDrag(e, sourceTask, fromTimeline) {
    if (modal) return;
    e.preventDefault();
    const rect   = tlRef.current?.getBoundingClientRect();
    const offMin = fromTimeline && rect ? pxToMin(e.clientY - rect.top) - sourceTask.start : 0;
    const state  = { id: sourceTask.id, fromTimeline, task: sourceTask, offsetMin: offMin, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, overTimeline: false, ghostMin: null, moved: false };
    dragRef.current = state;
    setDrag({ ...state });

    function onMove(ev) {
      const s = dragRef.current; if (!s) return;
      const dx = ev.clientX - s.startX, dy = ev.clientY - s.startY;
      if (!s.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      s.moved = true; s.x = ev.clientX; s.y = ev.clientY;
      const r = tlRef.current?.getBoundingClientRect();
      const over = !!(r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom);
      s.overTimeline = over;
      if (over) {
        const raw = snapMin(clampMin(pxToMin(ev.clientY - r.top) - (fromTimeline ? s.offsetMin : 0)));
        s.ghostMin = raw;
        if (fromTimeline) setTasksByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).map(t => t.id === s.id ? { ...t, start: raw } : t) }));
      } else { s.ghostMin = null; }
      setDrag({ ...s });
    }

    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const s = dragRef.current; dragRef.current = null; setDrag(null);
      if (!s || !s.moved) { if (fromTimeline) toggleExpanded(sourceTask.id); return; }
      const r = tlRef.current?.getBoundingClientRect();
      const over = !!(r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom);
      if (!fromTimeline) {
        if (over) {
          const m = snapMin(clampMin(pxToMin(ev.clientY - r.top)));
          setTasksByDate(prev => ({ ...prev, [selectedDate]: [...(prev[selectedDate] || []), { id: genId(), name: s.task.name, icon: s.task.icon, color: s.task.color, start: m, dur: s.task.dur || null, done: false, date: selectedDate, subtasks: s.task.subtasks || [], notes: s.task.notes || "" }] }));
          setPanels(prev => prev.map((p, i) => i === activePanelIdx ? { ...p, tasks: p.tasks.filter(t => t.id !== s.id) } : p));
        }
      } else {
        if (!over) {
          setTasksByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).filter(t => t.id !== s.id) }));
          setPanels(prev => prev.map((p, i) => {
            if (i !== activePanelIdx) return p;
            if (p.tasks.find(t => t.id === `back_${s.id}`)) return p;
            return { ...p, tasks: [...p.tasks, { id: `back_${s.id}`, name: s.task.name, icon: s.task.icon, color: s.task.color, dur: s.task.dur || null, subtasks: s.task.subtasks || [], notes: s.task.notes || "" }] };
          }));
        }
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function toggleExpanded(id) { setExpanded(p => ({ ...p, [id]: !p[id] })); }
  function openAdd(presetMin)  { setModal({ mode: "add",  presetStart: presetMin ?? snapMin(nowMin() + 15) }); }
  function openEdit(task)      { setModal({ mode: "edit", task }); }

  function handleSave(data) {
    const td = data.date || selectedDate;
    if (modal.mode === "add") {
      setTasksByDate(prev => ({ ...prev, [td]: [...(prev[td] || []), { id: genId(), ...data, done: false }] }));
    } else {
      const od = modal.task.date || selectedDate;
      if (od !== td) {
        setTasksByDate(prev => ({ ...prev, [od]: (prev[od] || []).filter(t => t.id !== modal.task.id), [td]: [...(prev[td] || []), { ...modal.task, ...data }] }));
      } else {
        setTasksByDate(prev => ({ ...prev, [td]: (prev[td] || []).map(t => t.id === modal.task.id ? { ...t, ...data } : t) }));
      }
    }
    setModal(null);
  }
  function handleDelete() {
    const d = modal.task.date || selectedDate;
    setTasksByDate(prev => ({ ...prev, [d]: (prev[d] || []).filter(t => t.id !== modal.task.id) }));
    setModal(null);
  }
  function toggleDone(id) {
    setTasksByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }
  function toggleSubtask(taskId, subIdx) {
    setTasksByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: (t.subtasks || []).map((s, i) => i === subIdx ? { ...s, done: !s.done } : s) };
    })}));
  }

  function startRenamePanel(panel) { setEditingPanelId(panel.id); setPanelRenameVal(panel.label); }
  function finishRenamePanel()     {
    if (panelRenameVal.trim()) setPanels(prev => prev.map(p => p.id === editingPanelId ? { ...p, label: panelRenameVal.trim() } : p));
    setEditingPanelId(null);
  }

  // Layout constants
  const LINE_X  = 88;   // shifted right a touch to give time labels room
  const NODE_W  = 58;   // wide block-style pill
  const NODE_L  = LINE_X - NODE_W / 2;
  const CARD_L  = LINE_X + NODE_W / 2 + 18;
  const TIME_W  = NODE_L - 8;

  const startHour = Math.floor(TL_START / 60);
  const hours = Array.from({ length: 25 - startHour }, (_, i) => startHour + i);

  const todayTasks = tasksByDate[TODAY] || [];
  const doneCnt    = todayTasks.filter(t => t.done).length;
  const totalCnt   = todayTasks.length;
  const pct        = totalCnt ? Math.round(doneCnt / totalCnt * 100) : 0;

  // FIX 4: overlap column assignment — always shift RIGHT only
  const colMap = {};
  sorted.forEach(t => { colMap[t.id] = 0; });
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      if (!a.dur || !b.dur) continue;
      const aEnd = a.start + a.dur, bEnd = b.start + b.dur;
      if (a.start < bEnd && aEnd > b.start) {
        colMap[b.id] = Math.max(colMap[b.id], colMap[a.id] + 1);
      }
    }
  }
  const COL_SHIFT = 48;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f8f7ff", fontFamily: "'DM Sans',-apple-system,sans-serif", color: "#111827", overflow: "hidden" }}>
      <GlobalStyle />

      {/* ── TIMELINE ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", background: "#fff" }}>

        {/* TOP BAR */}
        <div style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", background: "#fff", position: "sticky", top: 0, zIndex: 50, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => goToDate(-1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <div style={{ position: "relative" }} ref={calRef}>
              <button onClick={() => setShowCal(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "2px 4px", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 1 }}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} 📅
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                  {isToday ? "Today" : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}
                </div>
              </button>
              {showCal && (
                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 200, marginTop: 8 }}>
                  <MiniCalendar selectedDate={selectedDate} onSelect={d => { setSelectedDate(d); setShowCal(false); }} tasksByDate={tasksByDate} />
                </div>
              )}
            </div>
            <button onClick={() => goToDate(1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            {!isToday && (
              <button onClick={() => setSelectedDate(TODAY)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>Today</button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {overlapWarnings.length > 0 && (
              <div style={{ padding: "5px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: 11, fontWeight: 600 }}>
                ⚠ {overlapWarnings.length} overlap{overlapWarnings.length > 1 ? "s" : ""}
              </div>
            )}
            <button onClick={() => openAdd(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              + New task
            </button>
          </div>
        </div>

        {/* TIMELINE CANVAS */}
        <div ref={tlRef} style={{ position: "relative", padding: "0 20px 100px 0", height: tlHeight }}>

          {/* Vertical line */}
          <div style={{ position: "absolute", left: LINE_X, top: 0, bottom: 0, width: 1, background: "#e5e7eb" }} />

          {/* Hour ticks */}
          {hours.map(h => {
            const y = minToPx(h * 60);
            const isMajor = h % 3 === 0;
            const label = h === 0 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : h === 24 ? "" : `${h - 12} PM`;
            return (
              <div key={h} style={{ position: "absolute", top: y, left: 0, right: 0, pointerEvents: "none" }}>
                {label && (
                  <span style={{ position: "absolute", left: 12, width: TIME_W - 12, textAlign: "left", fontSize: 10, color: isMajor ? "#9ca3af" : "#d1d5db", lineHeight: 1, transform: "translateY(-50%)", fontWeight: isMajor ? 600 : 400, whiteSpace: "nowrap" }}>{label}</span>
                )}
                <div style={{ position: "absolute", left: LINE_X + 1, right: 0, height: 1, background: isMajor ? "#f3f4f6" : "#fafafa" }} />
              </div>
            );
          })}

          {/* Now line */}
          {isToday && (
            <div style={{ position: "absolute", top: minToPx(now), left: LINE_X - 5, right: 20, pointerEvents: "none", zIndex: 5 }}>
              <div style={{ position: "absolute", left: 0, top: -4, width: 9, height: 9, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 0 4px #fca5a520" }} />
              <div style={{ position: "absolute", left: 9, right: 0, top: -0.5, height: 1.5, background: "#ef444430" }} />
              <span style={{ position: "absolute", right: 4, top: -9, fontSize: 9, color: "#ef4444", fontWeight: 700, background: "#fff", padding: "1px 6px", borderRadius: 4, border: "1px solid #fca5a5" }}>{fmt(now)}</span>
            </div>
          )}

          {/* Drop hint */}
          {drag && !drag.fromTimeline && drag.overTimeline && drag.ghostMin !== null && (
            <div style={{ position: "absolute", top: minToPx(drag.ghostMin), left: LINE_X, right: 16, pointerEvents: "none", zIndex: 15 }}>
              <div style={{ height: 2, background: "#6366f1", borderRadius: 2 }} />
              <div style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
              <span style={{ position: "absolute", right: 0, top: -11, fontSize: 9, color: "#6366f1", fontWeight: 700, background: "#fff", padding: "1px 5px", borderRadius: 4, border: "1px solid #a5b4fc" }}>{fmt(drag.ghostMin)}</span>
            </div>
          )}

          {/* FIX 3: Gaps — computed using merged spans */}
          {gaps.map((g, i) => (
            <div key={i}>
              <div style={{ position: "absolute", left: LINE_X, top: minToPx(g.gs), width: 1, height: g.dur * PX_PER_MIN, borderLeft: "1px dashed #e5e7eb", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: minToPx(g.gs) + g.dur * PX_PER_MIN / 2 - 12, left: CARD_L }}>
                <div onClick={() => openAdd(snapMin(g.gs + g.dur / 2))}
                  style={{ fontSize: 10, color: "#9ca3af", padding: "3px 10px", borderRadius: 20, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", transition: "all .2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#9ca3af"; }}>
                  🕐 {fmtDur(g.dur)} free · + add
                </div>
              </div>
            </div>
          ))}

          {/* TASKS */}
          {sorted.map(task => {
            const colShift = colMap[task.id] * COL_SHIFT;
            const status   = getStatus(task);
            const prog     = getProgress(task);
            const col      = getColor(task.color);
            const topY     = minToPx(task.start);
            const hasDur   = !!(task.dur && task.dur > 0);
            const durPx    = hasDur ? Math.max(52, task.dur * PX_PER_MIN) : 0;
            const nodeH    = hasDur ? Math.max(52, durPx) : NODE_W;
            const isPast   = status === "past";
            const isDone   = status === "done";
            const isNow    = status === "now";
            const isSoon   = status === "soon";
            const isExp    = !!expanded[task.id];
            const fillFrac = isDone ? 1 : isPast ? 1 : isNow ? prog : 0;
            const isTLDrag = drag?.fromTimeline && drag?.id === task.id && drag?.moved;
            const isOvlp   = overlapIds.has(task.id);
            const totalSubs= (task.subtasks || []).length;
            const doneSubs = (task.subtasks || []).filter(s => s.done).length;
            const hasExtra = totalSubs > 0 || !!task.notes;

            // ── PILL COLOR SCHEME ──────────────────────────────────────────
            // upcoming  : very light tint of task color — subtle, not active
            // soon      : medium shade, border more prominent
            // now       : full vibrant color top→bottom, strong glow
            // past      : solid vibrant color (slightly desaturated), shows time passed
            // done      : richest / most saturated version — rewarding, highlighted

            // time flows top→bottom: top = task start, bottom = task end
            // elapsed fill grows from TOP downward, matching where "now" sits on the pill
            // remaining (below now) stays colorless
            const elapsedPct = isNow && hasDur ? Math.min(100, Math.round(prog * 100)) : 0;

            const pillBg = isDone
              ? col.hex
              : isPast
              ? `linear-gradient(180deg, ${col.hex}dd 0%, ${col.hex}99 100%)`
              : isNow
              ? `linear-gradient(180deg, ${col.hex} 0%, ${col.hex} ${elapsedPct}%, ${col.hex}15 ${elapsedPct}%, ${col.hex}10 100%)`
              : isSoon
              ? `linear-gradient(180deg, ${col.hex}55 0%, ${col.hex}22 100%)`
              : `linear-gradient(180deg, ${col.hex}20 0%, ${col.hex}10 100%)`;

            const pillBorder = isDone ? col.hex
              : isPast  ? col.hex + "cc"
              : isNow   ? col.hex + "cc"
              : isSoon  ? col.hex + "88"
              :           col.hex + "44";

            const pillShadow = isDone
              ? `0 0 0 4px ${col.hex}33, 0 6px 20px ${col.hex}44`
              : isNow
              ? `0 0 0 4px ${col.hex}22, 0 4px 16px ${col.hex}35`
              : isPast
              ? `0 2px 8px ${col.hex}30`
              : isSoon
              ? `0 0 0 3px ${col.hex}18`
              : "none";

            // FIX 4: overlapping => hide card text, show only pill; reveal on expand
            const hideCard = isOvlp && !isExp;

            return (
              <div key={task.id} className="task-row"
                style={{ position: "absolute", top: topY, left: colShift, right: colShift > 0 ? 0 : 16, display: "flex", alignItems: "flex-start", zIndex: isTLDrag ? 30 : isExp ? 20 : 2 + colMap[task.id] }}>

                {/* PILL */}
                <div
                  onMouseDown={e => beginDrag(e, task, true)}
                  style={{
                    position: "absolute", left: NODE_L, top: 0,
                    width: NODE_W, height: nodeH,
                    borderRadius: hasDur ? Math.min(nodeH / 2, 29) : "50%",
                    background: pillBg,
                    border: `2px solid ${pillBorder}`,
                    overflow: "hidden",
                    cursor: isTLDrag ? "grabbing" : "grab",
                    boxShadow: isOvlp ? `0 0 0 2px #fbbf24, ${pillShadow}` : pillShadow,
                    userSelect: "none",
                    transition: "box-shadow .3s, border-color .3s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {/* Sharp boundary line at current-time position within pill */}
                  {isNow && hasDur && elapsedPct > 0 && elapsedPct < 100 && (
                    <div style={{
                      position: "absolute",
                      top: `${elapsedPct}%`,
                      left: 0, right: 0,
                      height: 2,
                      background: col.hex,
                      opacity: 0.7,
                      pointerEvents: "none",
                      zIndex: 3,
                    }} />
                  )}
                  {/* Icon — always centered */}
                  <div style={{ fontSize: 20, zIndex: 4, lineHeight: 1, position: "relative", filter: (isDone || isNow || isPast) ? "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" : "none" }}>
                    {task.icon}
                  </div>
                </div>

                {/* CARD — FIX 4: hidden when overlapping & not expanded */}
                {!hideCard && (
                  <div style={{ position: "absolute", left: CARD_L, right: 36, top: 0, zIndex: isExp ? 20 : "auto" }}>
                    {isExp && <div style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 12, zIndex: -1, top: 0, left: -4, right: -4 }} />}
                    <div
                      onMouseDown={e => beginDrag(e, task, true)}
                      style={{
                        minHeight: hasDur ? nodeH : 28,
                        padding: hasDur ? "10px 14px" : "5px 14px",
                        borderRadius: 12,
                        border: `1.5px solid ${isExp ? col.hex + "44" : "transparent"}`,
                        background: isExp ? "#fff" : "transparent",
                        cursor: isTLDrag ? "grabbing" : "grab",
                        display: "flex", flexDirection: "column", justifyContent: "center",
                        transition: "background .12s, border-color .12s",
                        userSelect: "none",
                        boxShadow: isExp ? "0 2px 12px rgba(0,0,0,0.06)" : "none",
                      }}
                      onMouseEnter={e => { if (!isTLDrag && !isExp) { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#e5e7eb"; }}}
                      onMouseLeave={e => { if (!isExp) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}}>

                      <div style={{ fontSize: 10, fontWeight: isNow || isSoon ? 700 : 500, color: isNow || isSoon ? col.hex : isDone ? col.hex + "99" : isPast ? col.hex + "99" : "#9ca3af", marginBottom: 2, lineHeight: 1.2 }}>
                        {isNow && hasDur ? `${fmtDur(task.start + task.dur - now)} remaining`
                          : isSoon ? `In ${fmtDur(task.start - now)}`
                          : hasDur ? `${fmt(task.start)} – ${fmt(task.start + task.dur)} · ${fmtDur(task.dur)}`
                          : fmt(task.start)}
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? col.text : isPast ? col.text : "#111827", lineHeight: 1.3, position: "relative", display: "inline-block" }}>
                        {task.name}
                        {isDone && (
                          <div style={{ position: "absolute", top: "50%", left: 0, height: 2, width: "100%", background: col.hex, borderRadius: 1, transform: "translateY(-50%)", animation: "strikeIn .35s ease-out both" }} />
                        )}
                      </div>

                      {hasExtra && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                          {totalSubs > 0 && (
                            <>
                              <div style={{ flex: 1, maxWidth: 80, height: 3, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${totalSubs ? doneSubs / totalSubs * 100 : 0}%`, background: col.hex, borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 10, color: "#9ca3af" }}>{doneSubs}/{totalSubs}</span>
                            </>
                          )}
                          <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleExpanded(task.id); }}
                            style={{ fontSize: 10, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 2px", fontWeight: 600 }}>
                            {isExp ? "▲ less" : "▼ details"}
                          </button>
                        </div>
                      )}
                      {!isExp && <div style={{ width: 18, height: 2.5, borderRadius: 2, background: col.hex, marginTop: 5, opacity: isDone ? 0.4 : 0.7 }} />}
                    </div>

                    {isExp && (
                      <TaskCardExpanded task={task} col={col}
                        onToggleSubtask={i => toggleSubtask(task.id, i)}
                        onEdit={() => { setExpanded(p => ({ ...p, [task.id]: false })); openEdit(task); }} />
                    )}
                  </div>
                )}

                {/* FIX 4: When overlapping & collapsed, show name as tooltip on pill hover */}
                {isOvlp && !isExp && (
                  <div
                    onMouseDown={e => beginDrag(e, task, true)}
                    style={{ position: "absolute", left: CARD_L, top: 6, cursor: "pointer", zIndex: 5 }}
                    onClick={e => { e.stopPropagation(); toggleExpanded(task.id); }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.hex, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ color: col.text, fontWeight: 600, fontStyle: "normal" }}>{task.name}</span>
                      <span style={{ color: "#c4c4c4" }}>· tap</span>
                    </div>
                  </div>
                )}

                {/* Complete button */}
                {!hideCard && (
                  <div style={{ position: "absolute", right: 0, top: hasDur ? 10 : 5 }}>
                    <button onClick={e => { e.stopPropagation(); toggleDone(task.id); }}
                      className={isDone ? "done-glow" : ""}
                      style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isDone ? col.hex : "#d1d5db"}`, background: isDone ? col.hex + "33" : "#fff", cursor: "pointer", transition: "border-color .2s, background .2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      {isDone && <span className="done-check" style={{ fontSize: 10, color: col.hex, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                    </button>
                  </div>
                )}

                {/* Drag badge */}
                {isTLDrag && drag.ghostMin !== null && (
                  <div style={{ position: "absolute", left: CARD_L, top: -20, background: "#6366f1", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 30 }}>
                    {fmt(drag.ghostMin)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 248, background: "#f8f7ff", borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            {editingPanelId === activePanel.id
              ? <input value={panelRenameVal} onChange={e => setPanelRenameVal(e.target.value)}
                  onBlur={finishRenamePanel} onKeyDown={e => { if (e.key === "Enter") finishRenamePanel(); if (e.key === "Escape") setEditingPanelId(null); }}
                  autoFocus style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#111827", background: "transparent", border: "none", outline: "none", fontFamily: "inherit", borderBottom: "2px solid #6366f1" }} />
              : <div onDoubleClick={() => startRenamePanel(activePanel)} style={{ fontSize: 14, fontWeight: 700, color: "#111827", cursor: "default", flex: 1 }} title="Double-click to rename">
                  {activePanel.label}
                </div>
            }
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setActivePanelIdx(i => (i - 1 + panels.length) % panels.length)} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>‹</button>
              <button onClick={() => setActivePanelIdx(i => (i + 1) % panels.length)} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>›</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {panels.map((p, i) => (
              <button key={p.id} onClick={() => setActivePanelIdx(i)} style={{ flex: 1, height: 3, borderRadius: 2, border: "none", cursor: "pointer", background: i === activePanelIdx ? "#6366f1" : "#e5e7eb", transition: "background .2s" }} />
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 6 }}>Double-click label to rename</div>
        </div>

        <div style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 10, lineHeight: 1.5 }}>Drag to schedule · drop off to unschedule</div>
          {(activePanel.tasks || []).map(t => (
            <SidePanelItem key={t.id} task={t} onDragStart={beginDrag} />
          ))}
          {(activePanel.tasks || []).length === 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", paddingTop: 20 }}>All scheduled 🎉</div>
          )}
          <button onClick={() => setModal({ mode: "addPanel" })}
            style={{ width: "100%", padding: "8px", borderRadius: 9, border: "1.5px dashed #c7d2fe", background: "#eef2ff", color: "#6366f1", cursor: "pointer", fontSize: 12, fontFamily: "inherit", marginTop: 8, fontWeight: 600, transition: "all .2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#e0e7ff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#eef2ff"; }}>
            + Add to {activePanel.label}
          </button>
        </div>

        <div style={{ padding: "12px 14px", borderTop: "1px solid #e5e7eb", background: "#fff" }}>
          <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Today's progress</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{doneCnt}/{totalCnt} tasks</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct > 70 ? "#34d399" : pct > 40 ? "#fbbf24" : "#f87171" }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct > 70 ? "#34d399" : pct > 40 ? "#fbbf24" : "#f87171", borderRadius: 2, transition: "width .5s" }} />
          </div>
        </div>
      </div>

      {/* GHOST */}
      {drag && drag.moved && (
        <div style={{ position: "fixed", left: drag.x + 16, top: drag.y - 16, pointerEvents: "none", zIndex: 1000, padding: "7px 13px", borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb", color: "#111827", fontSize: 13, display: "flex", alignItems: "center", gap: 9, boxShadow: "0 8px 36px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: getColor(drag.task.color).hex, flexShrink: 0 }} />
          <span style={{ fontSize: 15 }}>{drag.task.icon}</span>
          <span style={{ fontWeight: 600 }}>{drag.task.name}</span>
          {drag.overTimeline && drag.ghostMin !== null
            ? <span style={{ color: "#6366f1", fontWeight: 700, fontSize: 10 }}>→ {fmt(drag.ghostMin)}</span>
            : drag.fromTimeline
            ? <span style={{ color: "#9ca3af", fontSize: 10 }}>drop to unschedule</span>
            : null}
        </div>
      )}

      {/* TASK MODAL */}
      {modal && modal.mode !== "addPanel" && (
        <TaskModal
          initial={modal.mode === "edit" ? modal.task : { start: modal.presetStart, dur: null, name: "", icon: "📝", color: "slate", date: selectedDate, subtasks: [], notes: "" }}
          selectedDate={selectedDate}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onDelete={modal.mode === "edit" ? handleDelete : null}
        />
      )}

      {/* ADD TO PANEL MODAL */}
      {modal && modal.mode === "addPanel" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px", width: 360, fontFamily: "'DM Sans',-apple-system,sans-serif", color: "#111827", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add to {activePanel.label}</div>
            <AddPanelForm
              onAdd={task => {
                setPanels(prev => prev.map((p, i) => i === activePanelIdx ? { ...p, tasks: [...p.tasks, { id: genId(), ...task }] } : p));
                setModal(null);
              }}
              onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}