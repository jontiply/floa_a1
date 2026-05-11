"use client";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── UTILS ───────────────────────────────────────────────────────────────────
const PX_PER_MIN = 2.8;
const TL_START   = 6 * 60;
const TL_END     = 24 * 60;

const minToPx = m  => (m - TL_START) * PX_PER_MIN;
const pxToMin = px => TL_START + px / PX_PER_MIN;
const snapMin = m  => Math.round(m / 5) * 5;
const clampMin = m => Math.max(TL_START, Math.min(TL_END - 1, m));

function fmt(m) {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60), mn = t % 60;
  const p = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
  return `${h12}:${String(mn).padStart(2,"0")} ${p}`;
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
  return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
}
function fromHHMM(s) {
  const [h,mn] = (s||"00:00").split(":").map(Number);
  return (h||0)*60+(mn||0);
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey()  { return dateKey(new Date()); }
function offsetDate(key, delta) {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}
function formatDateLabel(key) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
}

// ─── COLORS ──────────────────────────────────────────────────────────────────
const TASK_COLORS = [
  { id:"rose",   hex:"#e05c52" },
  { id:"amber",  hex:"#d4900a" },
  { id:"sage",   hex:"#4f9e6a" },
  { id:"sky",    hex:"#2e8fc0" },
  { id:"violet", hex:"#7c5cbf" },
  { id:"mint",   hex:"#2eaa9e" },
  { id:"peach",  hex:"#d06b50" },
  { id:"pink",   hex:"#c04d8a" },
  { id:"slate",  hex:"#6b82a8" },
  { id:"stone",  hex:"#7a6e62" },
];
const getHex = id => TASK_COLORS.find(c=>c.id===id)?.hex || "#6b82a8";

function shellColor(hex) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const mx = c => Math.round(c*0.15 + 30*0.85);
  return `rgb(${mx(r)},${mx(g)},${mx(b)})`;
}

const ICONS = ["☀️","🏃","💻","🍽️","🌙","📝","🎯","💡","🔧","✍️","🧠","🎨","📌","⚡","📋","🔍","📚","📞","🏋️","🏆","🌟","☕","🎵","🚴","🧘","🛒","💊","✈️","🎮","📊","🤝","🌿","🔥","⏰","🎪","🏠"];

// ─── SEED DATA ────────────────────────────────────────────────────────────────
let _nid = 300;
const genId = () => `t${++_nid}`;
const TODAY = todayKey();

const SEED_TASKS = {
  [TODAY]: [
    { id:"t1", name:"Morning run",  start:7*60,    dur:45,  icon:"🏃", color:"sage",   done:false, date:TODAY, subtasks:["Warm up 5 min","3km run","Cool down"], notes:"Try the park route today" },
    { id:"t2", name:"Deep work",    start:9*60,    dur:120, icon:"💻", color:"sky",    done:false, date:TODAY, subtasks:["Review PRs","Write tests","Deploy"], notes:"Focus mode: no Slack" },
    { id:"t3", name:"Lunch",        start:12*60,   dur:45,  icon:"🍽️", color:"peach",  done:false, date:TODAY, subtasks:[], notes:"" },
    { id:"t4", name:"Team standup", start:13*60,   dur:30,  icon:"🤝", color:"violet", done:false, date:TODAY, subtasks:["Share updates","Block review"], notes:"Zoom link in calendar" },
    { id:"t5", name:"Evening walk", start:18*60,   dur:40,  icon:"🌿", color:"mint",   done:false, date:TODAY, subtasks:[], notes:"" },
    { id:"t6", name:"Read",         start:21*60,   dur:60,  icon:"📚", color:"amber",  done:false, date:TODAY, subtasks:["Chapter 12","Take notes"], notes:"Atomic Habits" },
  ],
};

// Sidebar has 3 panels: unorganized, weekly, backlog
const INIT_PANELS = {
  unorganized: [
    { id:"s1", name:"Review PRs",       icon:"🔍", color:"slate",  dur:30,  subtasks:[], notes:"" },
    { id:"s2", name:"Call mom",         icon:"📞", color:"rose",   dur:20,  subtasks:[], notes:"" },
    { id:"s3", name:"Update portfolio", icon:"🎨", color:"violet", dur:90,  subtasks:[], notes:"" },
  ],
  weekly: [
    { id:"s4", name:"Gym session",      icon:"🏋️", color:"sage",   dur:60,  subtasks:["Chest","Arms","Legs"], notes:"" },
    { id:"s5", name:"Weekly review",    icon:"📊", color:"sky",    dur:45,  subtasks:["Goals check","Plan next week"], notes:"" },
  ],
  backlog: [
    { id:"s6", name:"Read 20 pages",    icon:"📚", color:"amber",  dur:30,  subtasks:[], notes:"" },
    { id:"s7", name:"Side project",     icon:"🔧", color:"peach",  dur:120, subtasks:["Design","Code","Test"], notes:"" },
  ],
};

// ─── MINI CALENDAR ────────────────────────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect, tasksByDate }) {
  const base = new Date(selectedDate+"T00:00:00");
  const [vy, setVy] = useState(base.getFullYear());
  const [vm, setVm] = useState(base.getMonth());
  const todayStr = todayKey();

  const firstDow  = new Date(vy,vm,1).getDay();
  const totalDays = new Date(vy,vm+1,0).getDate();
  const monthLabel = new Date(vy,vm,1).toLocaleString("en-US",{month:"long"});

  function prev() { vm===0?(setVm(11),setVy(y=>y-1)):setVm(m=>m-1); }
  function next() { vm===11?(setVm(0),setVy(y=>y+1)):setVm(m=>m+1); }

  return (
    <div style={{padding:"14px 12px",background:"#141414",border:"1px solid #2a2a2a",borderRadius:14,boxShadow:"0 24px 60px rgba(0,0,0,0.7)",width:220}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={prev} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:16,padding:"2px 6px",lineHeight:1}}>‹</button>
        <div style={{fontSize:11,fontWeight:700,color:"#ddd",letterSpacing:"0.05em"}}>{monthLabel} {vy}</div>
        <button onClick={next} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:16,padding:"2px 6px",lineHeight:1}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:9,color:"#555",fontWeight:700,padding:"2px 0",letterSpacing:"0.05em"}}>{d}</div>
        ))}
        {Array.from({length:firstDow}).map((_,i)=><div key={`b${i}`}/>)}
        {Array.from({length:totalDays},(_,i)=>i+1).map(d=>{
          const dk = dateKey(new Date(vy,vm,d));
          const isSel   = dk===selectedDate;
          const isToday = dk===todayStr;
          const hasTasks= (tasksByDate[dk]?.length||0)>0;
          return (
            <button key={d} onClick={()=>onSelect(dk)}
              style={{textAlign:"center",fontSize:10,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",
                background:isSel?"#e05c52":"transparent",
                color:isSel?"#fff":isToday?"#e05c52":"#aaa",
                fontWeight:isToday||isSel?700:400,
                position:"relative",transition:"background .12s",lineHeight:1}}>
              {d}
              {hasTasks&&!isSel&&<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:isToday?"#e05c52":"#444"}}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SUBTASK ROW ──────────────────────────────────────────────────────────────
function SubtaskRow({ text, done, onToggle, onDelete, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid #222"}}>
      <button onClick={onToggle} style={{width:16,height:16,borderRadius:4,border:`2px solid ${done?"#e05c52":"#444"}`,background:done?"#e05c52":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {done&&<span style={{fontSize:8,color:"#fff",fontWeight:800}}>✓</span>}
      </button>
      {editing
        ? <input value={val} onChange={e=>setVal(e.target.value)} onBlur={()=>{onChange(val);setEditing(false);}} onKeyDown={e=>{if(e.key==="Enter"){onChange(val);setEditing(false);}}}
            autoFocus style={{flex:1,background:"transparent",border:"none",color:"#eee",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
        : <span onClick={()=>setEditing(true)} style={{flex:1,fontSize:12,color:done?"#555":"#bbb",textDecoration:done?"line-through":"none",cursor:"text"}}>{text||"Untitled"}</span>
      }
      <button onClick={onDelete} style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:12,padding:"0 2px"}}>×</button>
    </div>
  );
}

// ─── TASK MODAL ───────────────────────────────────────────────────────────────
function TaskModal({ initial, selectedDate, onSave, onClose, onDelete }) {
  const [name,     setName]     = useState(initial?.name  || "");
  const [icon,     setIcon]     = useState(initial?.icon  || "📝");
  const [color,    setColor]    = useState(initial?.color || "slate");
  const [startS,   setStartS]   = useState(toHHMM(initial?.start ?? snapMin(nowMin()+15)));
  const [durMode,  setDurMode]  = useState("duration"); // "duration" | "endtime" | "none"
  const [durH,     setDurH]     = useState(initial?.dur ? Math.floor(initial.dur/60) : 0);
  const [durM,     setDurM]     = useState(initial?.dur ? initial.dur%60 : 30);
  const [endS,     setEndS]     = useState(initial?.dur ? toHHMM(initial.start+initial.dur) : toHHMM(snapMin(nowMin()+75)));
  const [taskDate, setTaskDate] = useState(initial?.date || selectedDate);
  const [subtasks, setSubtasks] = useState((initial?.subtasks||[]).map((s,i)=>({id:`sub${i}`,text:typeof s==="string"?s:s.text,done:typeof s==="object"?s.done:false})));
  const [notes,    setNotes]    = useState(initial?.notes || "");
  const [newSub,   setNewSub]   = useState("");

  const hex = getHex(color);

  const computedDur = () => {
    if (durMode==="none") return null;
    if (durMode==="duration") { const d=durH*60+durM; return d>0?d:null; }
    const s=fromHHMM(startS), e=fromHHMM(endS); return e>s?e-s:null;
  };

  function handleSave() {
    if (!name.trim()) return;
    const s = clampMin(fromHHMM(startS));
    const dur = computedDur();
    const cleanSubs = subtasks.map(s=>({text:s.text,done:s.done}));
    onSave({ name:name.trim(), icon, color, start:s, dur, date:taskDate, subtasks:cleanSubs, notes });
  }

  function addSubtask() {
    if (!newSub.trim()) return;
    setSubtasks(p=>[...p,{id:`sub${Date.now()}`,text:newSub.trim(),done:false}]);
    setNewSub("");
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:20,padding:"24px",width:400,fontFamily:"'DM Sans',-apple-system,sans-serif",boxShadow:"0 40px 100px rgba(0,0,0,0.8)",maxHeight:"90vh",overflowY:"auto",color:"#eee"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <div style={{width:32,height:32,borderRadius:10,background:hex+"22",border:`1.5px solid ${hex}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{icon}</div>
          <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase"}}>{initial?"Edit task":"New task"}</div>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:22,lineHeight:1,padding:"2px 4px"}}>×</button>
        </div>

        {/* Name */}
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSave()}
          placeholder="Task name…" autoFocus
          style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#fff",fontSize:15,fontWeight:600,padding:"10px 13px",outline:"none",fontFamily:"inherit",marginBottom:16}}/>

        {/* Color row */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Color</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {TASK_COLORS.map(tc=>(
              <button key={tc.id} onClick={()=>setColor(tc.id)}
                style={{width:24,height:24,borderRadius:"50%",background:tc.hex,border:color===tc.id?`3px solid #fff`:`3px solid transparent`,cursor:"pointer",transition:"all .12s",outline:"none"}}/>
            ))}
          </div>
        </div>

        {/* Icon row */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Icon</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,maxHeight:80,overflowY:"auto"}}>
            {ICONS.map(ic=>(
              <button key={ic} onClick={()=>setIcon(ic)}
                style={{width:32,height:32,borderRadius:7,border:`2px solid ${icon===ic?"#fff":"#2a2a2a"}`,background:icon===ic?"#2a2a2a":"transparent",fontSize:14,cursor:"pointer",transition:"all .12s"}}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:7}}>Date</div>
          <input type="date" value={taskDate} onChange={e=>setTaskDate(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#eee",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit"}}/>
        </div>

        {/* Start time */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:7}}>Start time</div>
          <input type="time" value={startS} onChange={e=>setStartS(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#eee",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit"}}/>
        </div>

        {/* Duration mode selector */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Duration</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {[["none","None"],["duration","Set duration"],["endtime","Set end time"]].map(([v,l])=>(
              <button key={v} onClick={()=>setDurMode(v)}
                style={{flex:1,padding:"6px 4px",borderRadius:8,border:`1.5px solid ${durMode===v?hex:"#2a2a2a"}`,background:durMode===v?hex+"22":"transparent",color:durMode===v?hex:"#666",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>
                {l}
              </button>
            ))}
          </div>

          {durMode==="duration"&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1}}>
                <input type="number" min={0} max={23} value={durH} onChange={e=>setDurH(Number(e.target.value))}
                  style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#eee",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",textAlign:"center"}}/>
                <div style={{fontSize:10,color:"#555",textAlign:"center",marginTop:3}}>hours</div>
              </div>
              <div style={{color:"#444",fontSize:18,marginBottom:14}}>:</div>
              <div style={{flex:1}}>
                <select value={durM} onChange={e=>setDurM(Number(e.target.value))}
                  style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#eee",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",textAlign:"center"}}>
                  {[0,5,10,15,20,25,30,45].map(v=><option key={v} value={v}>{String(v).padStart(2,"0")}</option>)}
                </select>
                <div style={{fontSize:10,color:"#555",textAlign:"center",marginTop:3}}>minutes</div>
              </div>
              {(durH>0||durM>0)&&<div style={{fontSize:12,color:hex,fontWeight:600}}>{fmtDur(durH*60+durM)}</div>}
            </div>
          )}
          {durMode==="endtime"&&(
            <>
              <input type="time" value={endS} onChange={e=>setEndS(e.target.value)}
                style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#eee",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit"}}/>
              {fromHHMM(endS)>fromHHMM(startS)&&(
                <div style={{fontSize:11,color:"#666",marginTop:5}}>Duration: <strong style={{color:hex}}>{fmtDur(fromHHMM(endS)-fromHHMM(startS))}</strong></div>
              )}
            </>
          )}
        </div>

        {/* Subtasks */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Subtasks</div>
          {subtasks.map((sub,i)=>(
            <SubtaskRow key={sub.id} text={sub.text} done={sub.done}
              onToggle={()=>setSubtasks(p=>p.map((s,j)=>j===i?{...s,done:!s.done}:s))}
              onDelete={()=>setSubtasks(p=>p.filter((_,j)=>j!==i))}
              onChange={v=>setSubtasks(p=>p.map((s,j)=>j===i?{...s,text:v}:s))}/>
          ))}
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <input value={newSub} onChange={e=>setNewSub(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSubtask()}
              placeholder="Add subtask…"
              style={{flex:1,background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:8,color:"#eee",fontSize:12,padding:"7px 10px",outline:"none",fontFamily:"inherit"}}/>
            <button onClick={addSubtask} style={{padding:"7px 12px",borderRadius:8,border:"none",background:hex,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>+</button>
          </div>
        </div>

        {/* Notes */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:7}}>Notes</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add notes, links…" rows={3}
            style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#eee",fontSize:12,padding:"9px 12px",outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.6}}/>
        </div>

        {/* Buttons */}
        <div style={{display:"flex",gap:8}}>
          {initial&&onDelete&&(
            <button onClick={onDelete} style={{padding:"9px 14px",borderRadius:9,border:"1px solid #3a1a1a",background:"#2a0a0a",color:"#e05c52",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
              Delete
            </button>
          )}
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{padding:"9px 14px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#666",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancel</button>
          <button onClick={handleSave} style={{padding:"9px 22px",borderRadius:9,border:"none",background:"#fff",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
            {initial?"Save changes":"Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TASK CARD EXPANDED ───────────────────────────────────────────────────────
function TaskCardExpanded({ task, hex, onToggleSubtask, onEdit }) {
  const doneSubs = (task.subtasks||[]).filter(s=>s.done).length;
  const totalSubs = (task.subtasks||[]).length;
  return (
    <div style={{marginTop:6,padding:"10px 12px",background:"#1a1a1a",border:"1px solid #282828",borderRadius:10}}>
      {/* Subtasks */}
      {totalSubs>0&&(
        <div style={{marginBottom:task.notes?8:0}}>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>
            Subtasks · {doneSubs}/{totalSubs}
          </div>
          <div style={{height:3,background:"#2a2a2a",borderRadius:2,marginBottom:8,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${totalSubs?doneSubs/totalSubs*100:0}%`,background:hex,borderRadius:2,transition:"width .4s"}}/>
          </div>
          {(task.subtasks||[]).map((sub,i)=>(
            <div key={i} onClick={()=>onToggleSubtask(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer"}}>
              <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sub.done?hex:"#444"}`,background:sub.done?hex:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {sub.done&&<span style={{fontSize:7,color:"#fff",fontWeight:800}}>✓</span>}
              </div>
              <span style={{fontSize:12,color:sub.done?"#555":"#aaa",textDecoration:sub.done?"line-through":"none"}}>{sub.text}</span>
            </div>
          ))}
        </div>
      )}
      {/* Notes */}
      {task.notes&&(
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:4}}>Notes</div>
          <div style={{fontSize:12,color:"#777",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{task.notes}</div>
        </div>
      )}
      <button onClick={onEdit} style={{marginTop:8,fontSize:11,color:"#555",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>✏️ Edit task</button>
    </div>
  );
}

// ─── SIDEBAR PANEL ITEM ───────────────────────────────────────────────────────
function SidePanelItem({ task, onDragStart }) {
  const hex = getHex(task.color);
  const totalSubs = task.subtasks?.length || 0;
  return (
    <div
      onMouseDown={e=>onDragStart(e,task,false)}
      style={{
        display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
        borderRadius:10,border:"1px solid #242424",background:"#181818",
        marginBottom:6,cursor:"grab",transition:"all .15s",userSelect:"none",
      }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor="#333";e.currentTarget.style.background="#202020";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="#242424";e.currentTarget.style.background="#181818";}}>
      <div style={{width:3,height:36,borderRadius:2,background:hex,flexShrink:0}}/>
      <span style={{fontSize:16}}>{task.icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:"#ddd",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
        <div style={{fontSize:10,color:"#555",marginTop:1}}>
          {task.dur?fmtDur(task.dur):"No duration"}
          {totalSubs>0&&` · ${totalSubs} subtasks`}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function FloaTasksPage() {
  const [tasksByDate, setTasksByDate]   = useState(SEED_TASKS);
  const [panels, setPanels]             = useState(INIT_PANELS);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [now, setNow]                   = useState(nowMin());
  const [modal, setModal]               = useState(null);
  const [drag, setDrag]                 = useState(null);
  const [expanded, setExpanded]         = useState({}); // taskId → bool
  const [showCal, setShowCal]           = useState(false);
  const [activePanel, setActivePanel]   = useState("unorganized"); // unorganized | weekly | backlog
  const [overlapWarnings, setOverlapWarnings] = useState([]);

  const dragRef  = useRef(null);
  const tlRef    = useRef(null);
  const calRef   = useRef(null);

  useEffect(()=>{
    const t = setInterval(()=>setNow(nowMin()), 15000);
    return ()=>clearInterval(t);
  },[]);

  // Close calendar on outside click
  useEffect(()=>{
    if (!showCal) return;
    function handler(e) {
      if (calRef.current&&!calRef.current.contains(e.target)) setShowCal(false);
    }
    window.addEventListener("mousedown",handler);
    return ()=>window.removeEventListener("mousedown",handler);
  },[showCal]);

  const tasks   = tasksByDate[selectedDate] || [];
  const sorted  = [...tasks].sort((a,b)=>a.start-b.start);
  const isToday = selectedDate===TODAY;
  const tlHeight = minToPx(TL_END) + 80;

  // ── Overlap detection ──────────────────────────────────────────────────────
  useEffect(()=>{
    const warns = [];
    for (let i=0;i<sorted.length;i++) {
      for (let j=i+1;j<sorted.length;j++) {
        const a=sorted[i], b=sorted[j];
        const aEnd=a.start+(a.dur||0);
        const bEnd=b.start+(b.dur||0);
        if (a.start<bEnd && aEnd>b.start && a.dur&&b.dur) {
          warns.push({a:a.id,b:b.id,aName:a.name,bName:b.name});
        }
      }
    }
    setOverlapWarnings(warns);
  },[tasks]);

  // ── Status ─────────────────────────────────────────────────────────────────
  function getStatus(task) {
    if (!isToday) return task.done ? "done" : "upcoming";
    if (task.done) return "done";
    const end = task.start+(task.dur||0);
    if (now>=task.start && now<=end+5) return "now";
    if (task.start-now>0 && task.start-now<=30) return "soon";
    if (task.start+(task.dur||0)<now) return "past";
    return "upcoming";
  }
  function getProgress(task) {
    if (!isToday||!task.dur) return 0;
    if (now<=task.start) return 0;
    if (now>=task.start+task.dur) return 1;
    return (now-task.start)/task.dur;
  }

  // ── Nav ────────────────────────────────────────────────────────────────────
  function goToDate(delta) { setSelectedDate(d => offsetDate(d, delta)); }

  // ── Drag ───────────────────────────────────────────────────────────────────
  function beginDrag(e, sourceTask, fromTimeline) {
    if (modal) return;
    e.preventDefault();
    const rect   = tlRef.current?.getBoundingClientRect();
    const offMin = fromTimeline && rect ? pxToMin(e.clientY-rect.top)-sourceTask.start : 0;

    const state = {
      id:sourceTask.id, fromTimeline,
      task:sourceTask, offsetMin:offMin,
      x:e.clientX, y:e.clientY,
      startX:e.clientX, startY:e.clientY,
      overTimeline:false, ghostMin:null, moved:false,
    };
    dragRef.current = state;
    setDrag({...state});

    function onMove(ev) {
      const s = dragRef.current; if (!s) return;
      const dx=ev.clientX-s.startX, dy=ev.clientY-s.startY;
      if (!s.moved&&Math.abs(dx)<4&&Math.abs(dy)<4) return;
      s.moved=true; s.x=ev.clientX; s.y=ev.clientY;
      const r=tlRef.current?.getBoundingClientRect();
      const over=!!(r&&ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom);
      s.overTimeline=over;
      if (over) {
        const raw=snapMin(clampMin(pxToMin(ev.clientY-r.top)-(fromTimeline?s.offsetMin:0)));
        s.ghostMin=raw;
        if (fromTimeline) {
          setTasksByDate(prev=>({...prev,[selectedDate]:(prev[selectedDate]||[]).map(t=>t.id===s.id?{...t,start:raw}:t)}));
        }
      } else { s.ghostMin=null; }
      setDrag({...s});
    }

    function onUp(ev) {
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      const s=dragRef.current;
      dragRef.current=null;
      setDrag(null);

      if (!s||!s.moved) {
        if (fromTimeline) toggleExpanded(sourceTask.id);
        return;
      }

      const r=tlRef.current?.getBoundingClientRect();
      const over=!!(r&&ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom);

      if (!fromTimeline) {
        if (over) {
          const m=snapMin(clampMin(pxToMin(ev.clientY-r.top)));
          // Keep all task data including dur, subtasks, notes
          setTasksByDate(prev=>({
            ...prev,
            [selectedDate]:[...(prev[selectedDate]||[]),{
              id:genId(),
              name:s.task.name,icon:s.task.icon,color:s.task.color,
              start:m, dur:s.task.dur||null,
              done:false, date:selectedDate,
              subtasks:s.task.subtasks||[], notes:s.task.notes||"",
            }],
          }));
          // Remove from panel
          setPanels(prev=>({...prev,[activePanel]:prev[activePanel].filter(t=>t.id!==s.id)}));
        }
      } else {
        if (!over) {
          // Return to panel — keep dur, subtasks, notes
          setTasksByDate(prev=>({...prev,[selectedDate]:(prev[selectedDate]||[]).filter(t=>t.id!==s.id)}));
          setPanels(prev=>{
            const key=`back_${s.id}`;
            if (prev[activePanel].find(p=>p.id===key)) return prev;
            return {...prev,[activePanel]:[...prev[activePanel],{id:key,name:s.task.name,icon:s.task.icon,color:s.task.color,dur:s.task.dur||null,subtasks:s.task.subtasks||[],notes:s.task.notes||""}]};
          });
        }
      }
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  }

  // ── Expand ─────────────────────────────────────────────────────────────────
  function toggleExpanded(id) { setExpanded(p=>({...p,[id]:!p[id]})); }

  // ── Modal ──────────────────────────────────────────────────────────────────
  function openAdd(presetMin) { setModal({mode:"add",presetStart:presetMin??snapMin(nowMin()+15)}); }
  function openEdit(task) { setModal({mode:"edit",task}); }

  function handleSave(data) {
    const td=data.date||selectedDate;
    if (modal.mode==="add") {
      setTasksByDate(prev=>({...prev,[td]:[...(prev[td]||[]),{id:genId(),...data,done:false}]}));
    } else {
      const od=modal.task.date||selectedDate;
      if (od!==td) {
        setTasksByDate(prev=>({
          ...prev,
          [od]:(prev[od]||[]).filter(t=>t.id!==modal.task.id),
          [td]:[...(prev[td]||[]),{...modal.task,...data}],
        }));
      } else {
        setTasksByDate(prev=>({...prev,[td]:(prev[td]||[]).map(t=>t.id===modal.task.id?{...t,...data}:t)}));
      }
    }
    setModal(null);
  }
  function handleDelete() {
    const d=modal.task.date||selectedDate;
    setTasksByDate(prev=>({...prev,[d]:(prev[d]||[]).filter(t=>t.id!==modal.task.id)}));
    setModal(null);
  }
  function toggleDone(id) {
    setTasksByDate(prev=>({...prev,[selectedDate]:(prev[selectedDate]||[]).map(t=>t.id===id?{...t,done:!t.done}:t)}));
  }
  function toggleSubtask(taskId, subIdx) {
    setTasksByDate(prev=>({...prev,[selectedDate]:(prev[selectedDate]||[]).map(t=>{
      if (t.id!==taskId) return t;
      const newSubs=(t.subtasks||[]).map((s,i)=>i===subIdx?{...s,done:!s.done}:s);
      return {...t,subtasks:newSubs};
    })}));
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  const LINE_X = 90;
  const NODE_W = 32;
  const NODE_L = LINE_X - NODE_W/2;
  const CARD_L = LINE_X + NODE_W/2 + 14;
  const TIME_W = NODE_L - 6;

  const startHour = Math.floor(TL_START/60);
  const hours = Array.from({length:25-startHour},(_,i)=>startHour+i);

  // Gaps
  const gaps = [];
  sorted.forEach((task,i)=>{
    const prev=sorted[i-1]; if(!prev) return;
    const gs=prev.start+(prev.dur||0), ge=task.start;
    if (ge-gs>=45) gaps.push({gs,ge,dur:ge-gs});
  });

  const PANEL_LABELS = {unorganized:"Quick Tasks",weekly:"This Week",backlog:"Backlog"};
  const PANEL_ORDER = ["unorganized","weekly","backlog"];

  return (
    <div style={{display:"flex",height:"100vh",background:"#0d0d0d",fontFamily:"'DM Sans',-apple-system,sans-serif",color:"#eee",overflow:"hidden"}}>

      {/* ── TIMELINE ── */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",position:"relative"}}>

        {/* TOP BAR */}
        <div style={{padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1e1e1e",background:"#0d0d0d",position:"sticky",top:0,zIndex:50,gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>goToDate(-1)}
              style={{width:30,height:30,borderRadius:8,border:"1px solid #222",background:"#141414",color:"#888",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#1e1e1e"}
              onMouseLeave={e=>e.currentTarget.style.background="#141414"}>‹</button>

            {/* Date + calendar toggle */}
            <div style={{position:"relative"}} ref={calRef}>
              <button onClick={()=>setShowCal(p=>!p)}
                style={{background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"2px 4px",borderRadius:8,transition:"background .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#1a1a1a"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:1}}>
                  {new Date(selectedDate+"T00:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} 📅
                </div>
                <div style={{fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.1,letterSpacing:"-0.02em"}}>
                  {isToday?"Today":new Date(selectedDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"})}
                </div>
              </button>
              {showCal&&(
                <div style={{position:"absolute",top:"100%",left:0,zIndex:200,marginTop:8}}>
                  <MiniCalendar selectedDate={selectedDate} onSelect={d=>{setSelectedDate(d);setShowCal(false);}} tasksByDate={tasksByDate}/>
                </div>
              )}
            </div>

            <button onClick={()=>goToDate(1)}
              style={{width:30,height:30,borderRadius:8,border:"1px solid #222",background:"#141414",color:"#888",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#1e1e1e"}
              onMouseLeave={e=>e.currentTarget.style.background="#141414"}>›</button>

            {!isToday&&(
              <button onClick={()=>setSelectedDate(TODAY)}
                style={{padding:"5px 12px",borderRadius:8,border:"1px solid #222",background:"#141414",color:"#888",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",letterSpacing:"0.02em",transition:"all .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#1e1e1e"}
                onMouseLeave={e=>e.currentTarget.style.background="#141414"}>Today</button>
            )}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* Overlap warnings */}
            {overlapWarnings.length>0&&(
              <div style={{padding:"5px 12px",borderRadius:8,background:"#2a1500",border:"1px solid #4a2a00",color:"#f09a3e",fontSize:11,fontWeight:600}}>
                ⚠️ {overlapWarnings.length} overlap{overlapWarnings.length>1?"s":""}
              </div>
            )}
            <button onClick={()=>openAdd(null)}
              style={{padding:"9px 18px",borderRadius:10,border:"none",background:"#e05c52",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>
              + New task
            </button>
          </div>
        </div>

        {/* TIMELINE CANVAS */}
        <div ref={tlRef} style={{position:"relative",padding:"0 20px 100px 0",height:tlHeight}}>

          {/* Vertical line */}
          <div style={{position:"absolute",left:LINE_X,top:0,bottom:0,width:1,background:"#1e1e1e"}}/>

          {/* Hour ticks */}
          {hours.map(h=>{
            const y = minToPx(h*60);
            const isMajor = h%3===0;
            const label = h===0?"12 AM":h===12?"12 PM":h<12?`${h} AM`:h===24?"":h===0?"12 AM":`${h-12} PM`;
            return (
              <div key={h} style={{position:"absolute",top:y,left:0,right:0,pointerEvents:"none"}}>
                {label&&(
                  <span style={{
                    position:"absolute",left:6,width:TIME_W-2,textAlign:"right",
                    fontSize:10,color:isMajor?"#555":"#2e2e2e",
                    lineHeight:1,transform:"translateY(-50%)",
                    fontWeight:isMajor?600:400,letterSpacing:"0.02em",whiteSpace:"nowrap",
                  }}>{label}</span>
                )}
                <div style={{position:"absolute",left:LINE_X+1,right:0,height:1,background:isMajor?"#1e1e1e":"#161616"}}/>
              </div>
            );
          })}

          {/* Now line */}
          {isToday&&(
            <div style={{position:"absolute",top:minToPx(now),left:LINE_X-5,right:20,pointerEvents:"none",zIndex:5}}>
              <div style={{position:"absolute",left:0,top:-4,width:9,height:9,borderRadius:"50%",background:"#e05c52",boxShadow:"0 0 0 4px #e05c5220"}}/>
              <div style={{position:"absolute",left:9,right:0,top:-0.5,height:1,background:"#e05c5230"}}/>
              <span style={{position:"absolute",right:4,top:-9,fontSize:9,color:"#e05c52",fontWeight:700,background:"#0d0d0d",padding:"1px 6px",borderRadius:4}}>{fmt(now)}</span>
            </div>
          )}

          {/* Drop hint */}
          {drag&&!drag.fromTimeline&&drag.overTimeline&&drag.ghostMin!==null&&(
            <div style={{position:"absolute",top:minToPx(drag.ghostMin),left:LINE_X,right:16,pointerEvents:"none",zIndex:15}}>
              <div style={{height:2,background:"#e05c52",borderRadius:2}}/>
              <div style={{position:"absolute",left:-4,top:-3,width:8,height:8,borderRadius:"50%",background:"#e05c52"}}/>
              <span style={{position:"absolute",right:0,top:-11,fontSize:9,color:"#e05c52",fontWeight:700,background:"#0d0d0d",padding:"1px 5px",borderRadius:4}}>{fmt(drag.ghostMin)}</span>
            </div>
          )}

          {/* Gaps */}
          {gaps.map((g,i)=>(
            <div key={i}>
              <div style={{position:"absolute",left:LINE_X,top:minToPx(g.gs),width:1,height:g.dur*PX_PER_MIN,borderLeft:"1px dashed #222",pointerEvents:"none"}}/>
              <div style={{position:"absolute",top:minToPx(g.gs)+g.dur*PX_PER_MIN/2-12,left:CARD_L}}>
                <div onClick={()=>openAdd(snapMin(g.gs+g.dur/2))}
                  style={{fontSize:10,color:"#444",padding:"3px 10px",borderRadius:20,border:"1px solid #222",background:"#141414",cursor:"pointer",whiteSpace:"nowrap",userSelect:"none",transition:"all .2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.color="#888";e.currentTarget.style.borderColor="#333";}}
                  onMouseLeave={e=>{e.currentTarget.style.color="#444";e.currentTarget.style.borderColor="#222";}}>
                  🕐 {fmtDur(g.dur)} free · + add
                </div>
              </div>
            </div>
          ))}

          {/* TASKS */}
          {sorted.map((task,taskIdx)=>{
            const status  = getStatus(task);
            const prog    = getProgress(task);
            const hex     = getHex(task.color);
            const shell   = shellColor(hex);
            const topY    = minToPx(task.start);
            const hasDur  = !!(task.dur&&task.dur>0);
            const durPx   = hasDur ? Math.max(44, task.dur*PX_PER_MIN) : 0;
            const nodeH   = hasDur ? Math.max(44,durPx) : NODE_W;

            const isPast     = status==="past";
            const isDone     = status==="done";
            const isNow      = status==="now";
            const isSoon     = status==="soon";
            const isExpanded = !!expanded[task.id];

            const hasFill = isDone||isPast||(isNow&&prog>0);
            const fillFraction = isDone ? 1 : isPast ? 1 : isNow ? prog : 0;
            const isTLDrag = drag?.fromTimeline && drag?.id===task.id && drag?.moved;

            // Overlap indicator for this task
            const isOverlapping = overlapWarnings.some(w=>w.a===task.id||w.b===task.id);

            const totalSubs = (task.subtasks||[]).length;
            const doneSubs  = (task.subtasks||[]).filter(s=>s.done).length;
            const hasSubsOrNotes = totalSubs>0 || !!task.notes;

            const nameColor = isDone||isPast ? "#555" : "#eee";
            const metaColor = isNow||isSoon ? hex : isPast||isDone ? "#3a3a3a" : "#666";

            return (
              <div key={task.id}
                style={{position:"absolute",top:topY,left:0,right:16,display:"flex",alignItems:"flex-start",
                  zIndex:isTLDrag?20:2,
                  opacity:isPast&&!isDone?0.5:1,
                  transition:"opacity .3s",
                }}>

                {/* Time label */}
                <div style={{width:TIME_W,flexShrink:0,textAlign:"right",paddingRight:8,paddingTop:hasDur?9:6}}>
                  <span style={{fontSize:10,fontWeight:isNow||isSoon?700:500,color:isNow||isSoon?hex:isPast?"#333":"#666",lineHeight:1,whiteSpace:"nowrap"}}>
                    {fmt(task.start)}
                  </span>
                </div>

                {/* PILL */}
                <div
                  onMouseDown={e=>beginDrag(e,task,true)}
                  style={{
                    position:"absolute",left:NODE_L,top:0,
                    width:NODE_W,height:nodeH,
                    borderRadius:hasDur?16:"50%",
                    background:shell,
                    border:`1.5px solid ${isNow||isSoon?hex+"60":isDone||isPast?hex+"40":"#282828"}`,
                    overflow:"hidden",
                    cursor:isTLDrag?"grabbing":"grab",
                    boxShadow:isNow?`0 0 0 4px ${hex}1a`:isSoon?`0 0 0 3px ${hex}12`:"none",
                    transition:"box-shadow .3s",userSelect:"none",
                    outline:isOverlapping?`2px solid #f09a3e22`:"none",
                  }}>
                  {hasFill&&(
                    <div style={{position:"absolute",top:0,left:0,right:0,height:`${fillFraction*100}%`,background:isPast||isDone?hex:hex+"cc",transition:"height 1.5s linear"}}/>
                  )}
                  <div style={{position:"absolute",top:hasDur?8:0,left:0,right:0,bottom:hasDur?16:0,display:"flex",alignItems:hasDur?"flex-start":"center",justifyContent:"center",fontSize:14,zIndex:2,paddingTop:hasDur?2:0,filter:(isDone||(isPast&&fillFraction===1))?"grayscale(1) brightness(3)":"none"}}>
                    {task.icon}
                  </div>
                  {hasDur&&(
                    <div style={{position:"absolute",bottom:5,left:0,right:0,display:"flex",justifyContent:"center",zIndex:2}}>
                      <div style={{width:13,height:13,borderRadius:4,background:isDone||isPast?"rgba(255,255,255,0.18)":isNow?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:isDone||isPast||isNow?"rgba(255,255,255,0.8)":hex+"88"}}>✓</div>
                    </div>
                  )}
                </div>

                {/* CARD */}
                <div style={{position:"absolute",left:CARD_L,right:36,top:0}}>
                  <div
                    onMouseDown={e=>beginDrag(e,task,true)}
                    style={{
                      minHeight:hasDur?nodeH:28,
                      padding:hasDur?"10px 14px":"5px 14px",
                      borderRadius:12,
                      border:`1.5px solid ${isExpanded?"#2a2a2a":"transparent"}`,
                      background:isExpanded?"#141414":"transparent",
                      cursor:isTLDrag?"grabbing":"grab",
                      display:"flex",flexDirection:"column",justifyContent:"center",
                      transition:"background .12s, border-color .12s",
                      userSelect:"none",
                    }}
                    onMouseEnter={e=>{if(!isTLDrag&&!isExpanded){e.currentTarget.style.background="#141414";e.currentTarget.style.borderColor="#282828";}}}
                    onMouseLeave={e=>{if(!isExpanded){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}}>

                    {/* Meta */}
                    <div style={{fontSize:10,fontWeight:isNow||isSoon?700:500,color:metaColor,marginBottom:2,lineHeight:1.2}}>
                      {isNow&&hasDur
                        ?`${fmtDur(task.start+task.dur-now)} remaining`
                        :isSoon
                        ?`In ${fmtDur(task.start-now)}`
                        :hasDur
                        ?`${fmt(task.start)} – ${fmt(task.start+task.dur)} · ${fmtDur(task.dur)}`
                        :fmt(task.start)}
                    </div>

                    {/* Name */}
                    <div style={{fontSize:14,fontWeight:600,color:nameColor,textDecoration:isDone?"line-through":"none",lineHeight:1.3}}>
                      {task.name}
                    </div>

                    {/* Subtask progress line + expand trigger */}
                    {hasSubsOrNotes&&(
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        {totalSubs>0&&(
                          <>
                            <div style={{flex:1,maxWidth:80,height:2,background:"#222",borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${totalSubs?doneSubs/totalSubs*100:0}%`,background:hex,borderRadius:2,transition:"width .4s"}}/>
                            </div>
                            <span style={{fontSize:10,color:"#555"}}>{doneSubs}/{totalSubs}</span>
                          </>
                        )}
                        <button
                          onMouseDown={e=>e.stopPropagation()}
                          onClick={e=>{e.stopPropagation();toggleExpanded(task.id);}}
                          style={{fontSize:10,color:"#555",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:"0 2px",transition:"color .12s"}}
                          onMouseEnter={e=>e.currentTarget.style.color="#aaa"}
                          onMouseLeave={e=>e.currentTarget.style.color="#555"}>
                          {isExpanded?"▲ less":"▼ details"}
                        </button>
                      </div>
                    )}

                    {/* Accent bar */}
                    {!isExpanded&&<div style={{width:18,height:2,borderRadius:2,background:hex,marginTop:5,opacity:isDone||isPast?0.15:0.6}}/>}
                  </div>

                  {/* Expanded section */}
                  {isExpanded&&(
                    <TaskCardExpanded
                      task={task} hex={hex}
                      onToggleSubtask={i=>toggleSubtask(task.id,i)}
                      onEdit={()=>{setExpanded(p=>({...p,[task.id]:false}));openEdit(task);}}/>
                  )}
                </div>

                {/* Complete button */}
                <div style={{position:"absolute",right:0,top:hasDur?10:5}}>
                  <button onClick={e=>{e.stopPropagation();toggleDone(task.id);}}
                    style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${isDone?"#333":hex}`,background:isDone?hex:"transparent",cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center"}}
                    onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                    {isDone&&<span style={{fontSize:9,color:"#fff",fontWeight:800}}>✓</span>}
                  </button>
                </div>

                {/* Drag badge */}
                {isTLDrag&&drag.ghostMin!==null&&(
                  <div style={{position:"absolute",left:CARD_L,top:-20,background:"#fff",color:"#000",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:5,whiteSpace:"nowrap",pointerEvents:"none",zIndex:30}}>
                    {fmt(drag.ghostMin)}
                  </div>
                )}

                {/* Overlap badge */}
                {isOverlapping&&(
                  <div style={{position:"absolute",right:28,top:hasDur?10:5,background:"#2a1500",border:"1px solid #4a2a00",borderRadius:6,padding:"2px 6px",fontSize:9,color:"#f09a3e",fontWeight:700,whiteSpace:"nowrap"}}>
                    ⚠️ overlap
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div style={{width:240,background:"#111",borderLeft:"1px solid #1e1e1e",display:"flex",flexDirection:"column",flexShrink:0}}>

        {/* Panel header + nav */}
        <div style={{padding:"16px 14px 12px",borderBottom:"1px solid #1e1e1e"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,color:"#eee"}}>{PANEL_LABELS[activePanel]}</div>
            <div style={{display:"flex",gap:4}}>
              <button
                onClick={()=>{const idx=PANEL_ORDER.indexOf(activePanel);setActivePanel(PANEL_ORDER[(idx-1+3)%3]);}}
                style={{width:26,height:26,borderRadius:7,border:"1px solid #222",background:"#181818",color:"#666",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <button
                onClick={()=>{const idx=PANEL_ORDER.indexOf(activePanel);setActivePanel(PANEL_ORDER[(idx+1)%3]);}}
                style={{width:26,height:26,borderRadius:7,border:"1px solid #222",background:"#181818",color:"#666",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
          </div>

          {/* Panel dots */}
          <div style={{display:"flex",gap:5}}>
            {PANEL_ORDER.map(p=>(
              <button key={p} onClick={()=>setActivePanel(p)}
                style={{flex:1,height:3,borderRadius:2,border:"none",cursor:"pointer",background:activePanel===p?"#e05c52":"#222",transition:"background .2s"}}/>
            ))}
          </div>
        </div>

        {/* Panel content */}
        <div style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
          <div style={{fontSize:10,color:"#444",marginBottom:10,lineHeight:1.5}}>Drag to schedule · drop off timeline to unschedule</div>
          {(panels[activePanel]||[]).map(t=>(
            <SidePanelItem key={t.id} task={t} onDragStart={beginDrag}/>
          ))}
          {(panels[activePanel]||[]).length===0&&(
            <div style={{fontSize:12,color:"#333",textAlign:"center",paddingTop:20}}>
              {activePanel==="unorganized"?"All scheduled 🎉":"Empty panel"}
            </div>
          )}

          {/* Add to panel */}
          <button
            onClick={()=>setModal({mode:"addPanel"})}
            style={{width:"100%",padding:"8px",borderRadius:9,border:"1px dashed #2a2a2a",background:"transparent",color:"#444",cursor:"pointer",fontSize:12,fontFamily:"inherit",marginTop:8,transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#444";e.currentTarget.style.color="#888";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#2a2a2a";e.currentTarget.style.color="#444";}}>
            + Add to {PANEL_LABELS[activePanel].toLowerCase()}
          </button>
        </div>

        {/* Stats footer */}
        <div style={{padding:"12px 14px",borderTop:"1px solid #1a1a1a",background:"#0e0e0e"}}>
          <div style={{fontSize:10,color:"#444",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>Today's progress</div>
          {(()=>{
            const todayTasks = tasksByDate[TODAY]||[];
            const done = todayTasks.filter(t=>t.done).length;
            const total = todayTasks.length;
            const pct = total?Math.round(done/total*100):0;
            return (
              <>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,color:"#666"}}>{done}/{total} tasks</span>
                  <span style={{fontSize:12,fontWeight:700,color:pct>70?"#4f9e6a":pct>40?"#d4900a":"#e05c52"}}>{pct}%</span>
                </div>
                <div style={{height:3,background:"#1e1e1e",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:pct>70?"#4f9e6a":pct>40?"#d4900a":"#e05c52",borderRadius:2,transition:"width .5s"}}/>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* GHOST */}
      {drag&&drag.moved&&(
        <div style={{position:"fixed",left:drag.x+16,top:drag.y-16,pointerEvents:"none",zIndex:1000,
          padding:"7px 13px",borderRadius:10,background:"#1a1a1a",border:"1px solid #333",color:"#eee",fontSize:13,
          display:"flex",alignItems:"center",gap:9,boxShadow:"0 8px 36px rgba(0,0,0,0.6)",whiteSpace:"nowrap"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:getHex(drag.task.color),flexShrink:0}}/>
          <span style={{fontSize:15}}>{drag.task.icon}</span>
          <span style={{fontWeight:600,fontSize:13}}>{drag.task.name}</span>
          {drag.overTimeline&&drag.ghostMin!==null
            ?<span style={{color:"#e05c52",fontWeight:700,fontSize:10}}>→ {fmt(drag.ghostMin)}</span>
            :drag.fromTimeline
            ?<span style={{color:"#555",fontSize:10}}>drop to unschedule</span>
            :null}
        </div>
      )}

      {/* MODAL */}
      {modal&&modal.mode!=="addPanel"&&(
        <TaskModal
          initial={modal.mode==="edit"?modal.task:{start:modal.presetStart,dur:null,name:"",icon:"📝",color:"slate",date:selectedDate,subtasks:[],notes:""}}
          selectedDate={selectedDate}
          onSave={handleSave}
          onClose={()=>setModal(null)}
          onDelete={modal.mode==="edit"?handleDelete:null}
        />
      )}
      {/* Add to panel modal */}
      {modal&&modal.mode==="addPanel"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:20,padding:"24px",width:360,fontFamily:"'DM Sans',-apple-system,sans-serif",color:"#eee"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:16}}>Add to {PANEL_LABELS[activePanel]}</div>
            <AddPanelForm
              onAdd={(task)=>{setPanels(prev=>({...prev,[activePanel]:[...prev[activePanel],{id:genId(),...task}]}));setModal(null);}}
              onClose={()=>setModal(null)}/>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPanelForm({ onAdd, onClose }) {
  const [name,  setName]  = useState("");
  const [icon,  setIcon]  = useState("📝");
  const [color, setColor] = useState("slate");
  const [durH,  setDurH]  = useState(0);
  const [durM,  setDurM]  = useState(30);
  const hex = getHex(color);

  function handle() {
    if (!name.trim()) return;
    const dur = durH*60+durM;
    onAdd({name:name.trim(),icon,color,dur:dur>0?dur:null,subtasks:[],notes:""});
  }

  return (
    <>
      <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="Task name…" autoFocus
        style={{width:"100%",boxSizing:"border-box",background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:10,color:"#fff",fontSize:15,fontWeight:600,padding:"10px 13px",outline:"none",fontFamily:"inherit",marginBottom:14}}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {TASK_COLORS.map(tc=>(
          <button key={tc.id} onClick={()=>setColor(tc.id)} style={{width:22,height:22,borderRadius:"50%",background:tc.hex,border:color===tc.id?"3px solid #fff":"3px solid transparent",cursor:"pointer",outline:"none"}}/>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
        <input type="number" min={0} max={23} value={durH} onChange={e=>setDurH(Number(e.target.value))}
          style={{width:60,background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:8,color:"#eee",fontSize:13,padding:"7px 10px",outline:"none",fontFamily:"inherit",textAlign:"center"}}/>
        <span style={{color:"#444"}}>h</span>
        <select value={durM} onChange={e=>setDurM(Number(e.target.value))}
          style={{width:70,background:"#1e1e1e",border:"1.5px solid #2a2a2a",borderRadius:8,color:"#eee",fontSize:13,padding:"7px 10px",outline:"none",fontFamily:"inherit"}}>
          {[0,5,10,15,20,25,30,45].map(v=><option key={v} value={v}>{String(v).padStart(2,"0")}</option>)}
        </select>
        <span style={{color:"#444"}}>min</span>
        {(durH>0||durM>0)&&<span style={{fontSize:12,color:hex,fontWeight:600}}>{fmtDur(durH*60+durM)}</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={{flex:1,padding:"9px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#666",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancel</button>
        <button onClick={handle} style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:"#fff",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>Add</button>
      </div>
    </>
  );
}