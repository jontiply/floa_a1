"use client";
import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — replace getUserWakeTime() with your backend call later
// Returns wake time in minutes from midnight, default 6:30
// ─────────────────────────────────────────────────────────────────────────────
function getUserWakeTime(/* userId */) {
  // TODO: fetch from backend. Return minutes from midnight.
  return 6 * 60 + 30; // default 6:30 AM
}

const WAKE_MIN   = getUserWakeTime();
const PX_PER_MIN = 2.6;
const TL_START   = WAKE_MIN;           // timeline starts at wake time
const TL_END     = 24 * 60;            // ends midnight

function minToPx(m)  { return (m - TL_START) * PX_PER_MIN; }
function pxToMin(px) { return TL_START + px / PX_PER_MIN; }
function snapMin(m)  { return Math.round(m / 5) * 5; }
function clampMin(m) { return Math.max(0, Math.min(TL_END - 1, m)); }

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

// ─────────────────────────────────────────────────────────────────────────────
// COLORS & ICONS
// ─────────────────────────────────────────────────────────────────────────────
const TASK_COLORS = [
  { id:"slate",  hex:"#6b82a8" },
  { id:"rose",   hex:"#d94f46" },
  { id:"amber",  hex:"#d4900a" },
  { id:"sage",   hex:"#4f9e5e" },
  { id:"violet", hex:"#7c5cbf" },
  { id:"sky",    hex:"#2e8fc0" },
  { id:"peach",  hex:"#d06b50" },
  { id:"mint",   hex:"#2eaa9e" },
  { id:"stone",  hex:"#7a6e62" },
  { id:"pink",   hex:"#c04d8a" },
];
function getHex(id) { return TASK_COLORS.find(c=>c.id===id)?.hex || "#6b82a8"; }

// slightly lighter tinted bg for pill shell (upcoming)
function shellColor(hex) {
  // parse hex, lighten heavily
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const mix = (c) => Math.round(c*0.18 + 235*0.82);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

const ICONS = ["☀️","🏃","💻","🍽️","🌙","📝","🎯","💡","🔧","✍️","🧠","🎨","📌","⚡","📋","🔍","📚","📞","🏋️","🏆","🌟","☕","🎵","🚴","🧘","🛒","💊","✈️","🎮","📊","🤝","🌿"];

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
let _nid = 200;
const genId = () => `t${++_nid}`;
const TODAY = todayKey();

const SEED_TASKS = {
  [TODAY]: [
    { id:"t1", name:"Wake up",     start:6*60+30, dur:null, icon:"☀️", color:"amber",  done:false, date:TODAY },
    { id:"t2", name:"Morning run", start:7*60,    dur:45,   icon:"🏃", color:"sage",   done:false, date:TODAY },
    { id:"t3", name:"Deep work",   start:9*60,    dur:120,  icon:"💻", color:"sky",    done:false, date:TODAY },
    { id:"t4", name:"Lunch",       start:12*60,   dur:45,   icon:"🍽️", color:"peach",  done:false, date:TODAY },
    { id:"t5", name:"Evening walk",start:18*60,   dur:40,   icon:"🌿", color:"mint",   done:false, date:TODAY },
    { id:"t6", name:"Go to bed",   start:22*60,   dur:null, icon:"🌙", color:"violet", done:false, date:TODAY },
  ],
};
const SEED_SIDE = [
  { id:"s1", name:"Review PRs",       icon:"🔍", color:"slate"  },
  { id:"s2", name:"Read 20 pages",    icon:"📚", color:"amber"  },
  { id:"s3", name:"Call mom",         icon:"📞", color:"rose"   },
  { id:"s4", name:"Update portfolio", icon:"🎨", color:"violet" },
  { id:"s5", name:"Gym session",      icon:"🏋️", color:"sage"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// MINI CALENDAR
// ─────────────────────────────────────────────────────────────────────────────
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
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={prev} style={{background:"none",border:"none",color:"#999",cursor:"pointer",fontSize:16,padding:"2px 6px",lineHeight:1}}>‹</button>
        <div style={{fontSize:11,fontWeight:700,color:"#444",letterSpacing:"0.02em"}}>{monthLabel} {vy}</div>
        <button onClick={next} style={{background:"none",border:"none",color:"#999",cursor:"pointer",fontSize:16,padding:"2px 6px",lineHeight:1}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:8,color:"#bbb",fontWeight:700,padding:"2px 0",letterSpacing:"0.05em"}}>{d}</div>
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
                background:isSel?"#1a1a1a":"transparent",
                color:isSel?"#fff":isToday?"#d94f46":"#444",
                fontWeight:isToday||isSel?700:400,
                position:"relative",transition:"background .12s",lineHeight:1}}>
              {d}
              {hasTasks&&!isSel&&(
                <div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:isToday?"#d94f46":"#ccc"}}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK MODAL
// ─────────────────────────────────────────────────────────────────────────────
function TaskModal({ initial, selectedDate, onSave, onClose, onDelete }) {
  const [name,     setName]     = useState(initial?.name  || "");
  const [icon,     setIcon]     = useState(initial?.icon  || "📝");
  const [color,    setColor]    = useState(initial?.color || "slate");
  const [startS,   setStartS]   = useState(toHHMM(initial?.start ?? snapMin(nowMin()+15)));
  const [hasEnd,   setHasEnd]   = useState(!!(initial?.dur));
  const [endS,     setEndS]     = useState(
    initial?.dur ? toHHMM(initial.start+initial.dur) : toHHMM(snapMin(nowMin()+75))
  );
  const [taskDate, setTaskDate] = useState(initial?.date || selectedDate);
  const hex = getHex(color);

  function handleSave() {
    if (!name.trim()) return;
    const s = clampMin(fromHHMM(startS));
    const e = hasEnd ? clampMin(fromHHMM(endS)) : null;
    const dur = hasEnd && e > s ? e-s : null;
    onSave({ name:name.trim(), icon, color, start:s, dur, date:taskDate });
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(245,242,238,0.82)",backdropFilter:"blur(12px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",border:"1px solid #e0dbd4",borderRadius:22,padding:"26px 24px 22px",width:364,fontFamily:"'DM Sans',-apple-system,sans-serif",boxShadow:"0 28px 80px rgba(0,0,0,0.13)",maxHeight:"90vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <div style={{width:32,height:32,borderRadius:10,background:hex+"18",border:`1.5px solid ${hex}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{icon}</div>
          <div style={{fontSize:12,fontWeight:700,color:"#888",letterSpacing:"0.07em",textTransform:"uppercase"}}>
            {initial?"Edit task":"New task"}
          </div>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:20,lineHeight:1,padding:"2px 4px"}}>×</button>
        </div>

        {/* Name */}
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSave()}
          placeholder="Task name…" autoFocus
          style={{width:"100%",boxSizing:"border-box",background:"#faf8f5",border:"1.5px solid #e8e2da",borderRadius:10,color:"#1a1a1a",fontSize:15,fontWeight:600,padding:"10px 13px",outline:"none",fontFamily:"inherit",marginBottom:16}}/>

        {/* Color */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Color</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {TASK_COLORS.map(tc=>(
              <button key={tc.id} onClick={()=>setColor(tc.id)} title={tc.id}
                style={{width:26,height:26,borderRadius:"50%",background:tc.hex,
                  border:color===tc.id?`3px solid #1a1a1a`:`3px solid transparent`,
                  cursor:"pointer",transition:"all .12s",outline:"none",
                  boxShadow:color===tc.id?"0 0 0 2px #fff inset":""}}/>
            ))}
          </div>
        </div>

        {/* Icon */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Icon</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,maxHeight:90,overflowY:"auto"}}>
            {ICONS.map(ic=>(
              <button key={ic} onClick={()=>setIcon(ic)}
                style={{width:33,height:33,borderRadius:8,border:`2px solid ${icon===ic?"#1a1a1a":"#ece7e0"}`,background:icon===ic?"#f5f2ee":"transparent",fontSize:15,cursor:"pointer",transition:"all .12s"}}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:7}}>Date</div>
          <input type="date" value={taskDate} onChange={e=>setTaskDate(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:"#faf8f5",border:"1.5px solid #e8e2da",borderRadius:10,color:"#1a1a1a",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit"}}/>
        </div>

        {/* Start */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:7}}>Start time</div>
          <input type="time" value={startS} onChange={e=>setStartS(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:"#faf8f5",border:"1.5px solid #e8e2da",borderRadius:10,color:"#1a1a1a",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit"}}/>
        </div>

        {/* End toggle */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:hasEnd?12:20}}>
          <button onClick={()=>setHasEnd(p=>!p)}
            style={{width:34,height:19,borderRadius:10,border:"none",background:hasEnd?"#1a1a1a":"#ddd6cc",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
            <div style={{position:"absolute",top:2.5,left:hasEnd?15:2.5,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,0.22)"}}/>
          </button>
          <span style={{fontSize:12,color:"#999"}}>Set end time</span>
        </div>

        {hasEnd&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:7}}>End time</div>
            <input type="time" value={endS} onChange={e=>setEndS(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",background:"#faf8f5",border:"1.5px solid #e8e2da",borderRadius:10,color:"#1a1a1a",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit"}}/>
            {fromHHMM(endS)>fromHHMM(startS)&&(
              <div style={{fontSize:11,color:"#aaa",marginTop:5}}>Duration: <strong style={{color:"#555"}}>{fmtDur(fromHHMM(endS)-fromHHMM(startS))}</strong></div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div style={{display:"flex",gap:8,paddingTop:4}}>
          {initial&&onDelete&&(
            <button onClick={onDelete} style={{padding:"9px 14px",borderRadius:9,border:"1px solid #f0e0de",background:"#fff8f7",color:"#d94f46",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
              Delete
            </button>
          )}
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{padding:"9px 14px",borderRadius:9,border:"1px solid #ece7e0",background:"transparent",color:"#999",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
            Cancel
          </button>
          <button onClick={handleSave} style={{padding:"9px 22px",borderRadius:9,border:"none",background:"#1a1a1a",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
            {initial?"Save changes":"Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function FloaTasksPage() {
  const [tasksByDate, setTasksByDate] = useState(SEED_TASKS);
  const [sideTasks,   setSide]        = useState(SEED_SIDE);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [now,   setNow]   = useState(nowMin());
  const [modal, setModal] = useState(null);
  const [drag,  setDrag]  = useState(null);
  const dragRef = useRef(null);
  const tlRef   = useRef(null);

  useEffect(()=>{
    const t = setInterval(()=>setNow(nowMin()), 15000);
    return ()=>clearInterval(t);
  },[]);

  const tasks   = tasksByDate[selectedDate] || [];
  const sorted  = [...tasks].sort((a,b)=>a.start-b.start);
  const isToday = selectedDate===TODAY;

  // Height: full day from TL_START to midnight + padding
  const tlHeight = minToPx(TL_END) + 80;

  // ── Status ──────────────────────────────────────────────────────────
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

  // ── Nav helpers ─────────────────────────────────────────────────────
  function goToDate(delta) { setSelectedDate(d => offsetDate(d, delta)); }

  // ── Unified drag ────────────────────────────────────────────────────
  // Both pill AND card share the same drag initiation for timeline tasks.
  // A click (no movement) opens the edit modal instead.
  function beginDrag(e, sourceTask, fromTimeline) {
    if (modal) return;
    e.preventDefault();
    const rect  = tlRef.current?.getBoundingClientRect();
    const offMin = fromTimeline && rect ? pxToMin(e.clientY-rect.top)-sourceTask.start : 0;

    const state = {
      id: sourceTask.id, fromTimeline,
      task: sourceTask, offsetMin: offMin,
      x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      overTimeline: false, ghostMin: null, moved: false,
    };
    dragRef.current = state;
    setDrag({...state});

    function onMove(ev) {
      const s = dragRef.current; if (!s) return;
      const dx = ev.clientX-s.startX, dy = ev.clientY-s.startY;
      if (!s.moved && Math.abs(dx)<4 && Math.abs(dy)<4) return; // dead zone
      s.moved = true;
      s.x = ev.clientX; s.y = ev.clientY;
      const r = tlRef.current?.getBoundingClientRect();
      const over = !!(r && ev.clientX>=r.left && ev.clientX<=r.right && ev.clientY>=r.top && ev.clientY<=r.bottom);
      s.overTimeline = over;
      if (over) {
        const raw = snapMin(clampMin(pxToMin(ev.clientY-r.top)-(fromTimeline?s.offsetMin:0)));
        s.ghostMin = raw;
        if (fromTimeline) {
          setTasksByDate(prev=>({
            ...prev,
            [selectedDate]:(prev[selectedDate]||[]).map(t=>t.id===s.id?{...t,start:raw}:t),
          }));
        }
      } else { s.ghostMin=null; }
      setDrag({...s});
    }

    function onUp(ev) {
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      const s = dragRef.current;
      dragRef.current = null;
      setDrag(null);

      // Click (no move) → open edit
      if (!s||!s.moved) {
        if (fromTimeline) openEdit(sourceTask);
        return;
      }

      const r = tlRef.current?.getBoundingClientRect();
      const over = !!(r && ev.clientX>=r.left && ev.clientX<=r.right && ev.clientY>=r.top && ev.clientY<=r.bottom);

      if (!fromTimeline) {
        if (over) {
          const m = snapMin(clampMin(pxToMin(ev.clientY-r.top)));
          setTasksByDate(prev=>({
            ...prev,
            [selectedDate]:[...(prev[selectedDate]||[]),{id:genId(),name:s.task.name,icon:s.task.icon,color:s.task.color,start:m,dur:null,done:false,date:selectedDate}],
          }));
          setSide(prev=>prev.filter(t=>t.id!==s.id));
        }
      } else {
        if (!over) {
          // Send back to sidebar
          setTasksByDate(prev=>({...prev,[selectedDate]:(prev[selectedDate]||[]).filter(t=>t.id!==s.id)}));
          setSide(prev=>{
            const key=`back_${s.id}`;
            if (prev.find(p=>p.id===key)) return prev;
            return [...prev,{id:key,name:s.task.name,icon:s.task.icon,color:s.task.color}];
          });
        }
      }
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  }

  // ── Modal ────────────────────────────────────────────────────────────
  function openAdd(presetMin) { setModal({mode:"add",presetStart:presetMin??snapMin(nowMin()+15)}); }
  function openEdit(task)     { setModal({mode:"edit",task}); }

  function handleSave(data) {
    const td = data.date||selectedDate;
    if (modal.mode==="add") {
      setTasksByDate(prev=>({...prev,[td]:[...(prev[td]||[]),{id:genId(),...data,done:false}]}));
    } else {
      const od = modal.task.date||selectedDate;
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
    const d = modal.task.date||selectedDate;
    setTasksByDate(prev=>({...prev,[d]:(prev[d]||[]).filter(t=>t.id!==modal.task.id)}));
    setModal(null);
  }
  function toggleDone(id) {
    setTasksByDate(prev=>({...prev,[selectedDate]:(prev[selectedDate]||[]).map(t=>t.id===id?{...t,done:!t.done}:t)}));
  }

  // ── Gaps ─────────────────────────────────────────────────────────────
  const gaps = [];
  sorted.forEach((task,i)=>{
    const prev=sorted[i-1]; if(!prev) return;
    const gs=prev.start+(prev.dur||0), ge=task.start;
    if (ge-gs>=45) gaps.push({gs,ge,dur:ge-gs});
  });

  // ── Layout geometry ───────────────────────────────────────────────────
  // Time labels left, pill centred on LINE_X, card to the right
  const LINE_X = 108;
  const NODE_W = 34;
  const NODE_L = LINE_X - NODE_W/2;
  const CARD_L = LINE_X + NODE_W/2 + 16;
  const TIME_W = NODE_L - 8;

  // Hours to render
  const startHour = Math.floor(TL_START/60);
  const hours = Array.from({length:25-startHour},(_,i)=>startHour+i);

  return (
    <div style={{display:"flex",height:"100vh",background:"#f5f1ec",fontFamily:"'DM Sans',-apple-system,sans-serif",color:"#1a1a1a",overflow:"hidden"}}>

      {/* ── TIMELINE COLUMN ── */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",position:"relative"}}>

        {/* ── TOP BAR ── */}
        <div style={{padding:"16px 24px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e4ddd5",background:"#f5f1ec",position:"sticky",top:0,zIndex:10,gap:12}}>

          {/* Left: date info + prev/next/today */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>goToDate(-1)}
              style={{width:30,height:30,borderRadius:8,border:"1px solid #ddd6cc",background:"#fff",color:"#555",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .12s",flexShrink:0}}
              onMouseEnter={e=>{e.currentTarget.style.background="#f0ece6";}}
              onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>‹</button>

            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:1}}>
                {new Date(selectedDate+"T00:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
              </div>
              <div style={{fontSize:19,fontWeight:700,color:"#1a1a1a",lineHeight:1.1}}>
                {isToday?"Today":new Date(selectedDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"})}
              </div>
            </div>

            <button onClick={()=>goToDate(1)}
              style={{width:30,height:30,borderRadius:8,border:"1px solid #ddd6cc",background:"#fff",color:"#555",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .12s",flexShrink:0}}
              onMouseEnter={e=>{e.currentTarget.style.background="#f0ece6";}}
              onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>›</button>

            {!isToday&&(
              <button onClick={()=>setSelectedDate(TODAY)}
                style={{padding:"5px 12px",borderRadius:8,border:"1px solid #ddd6cc",background:"#fff",color:"#666",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",letterSpacing:"0.02em",transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#f0ece6";}}
                onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>Today</button>
            )}
          </div>

          {/* Right: add button */}
          <button onClick={()=>openAdd(null)}
            style={{padding:"9px 20px",borderRadius:10,border:"none",background:"#1a1a1a",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",flexShrink:0,letterSpacing:"0.01em"}}>
            + New task
          </button>
        </div>

        {/* ── TIMELINE CANVAS ── */}
        <div ref={tlRef} style={{position:"relative",padding:"0 20px 100px 0",height:tlHeight}}>

          {/* Vertical line */}
          <div style={{position:"absolute",left:LINE_X,top:0,bottom:0,width:1,background:"#ddd6cc"}}/>

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
                    fontSize:10, // bigger = more readable
                    color:isMajor?"#999":"#ccc",
                    lineHeight:1,transform:"translateY(-50%)",
                    fontWeight:isMajor?600:400,letterSpacing:"0.02em",whiteSpace:"nowrap",
                  }}>
                    {label}
                  </span>
                )}
                <div style={{position:"absolute",left:LINE_X+1,right:0,height:1,background:isMajor?"#e6e0d8":"#ede8e2"}}/>
              </div>
            );
          })}

          {/* Now line */}
          {isToday&&(
            <div style={{position:"absolute",top:minToPx(now),left:LINE_X-5,right:20,pointerEvents:"none",zIndex:5}}>
              <div style={{position:"absolute",left:0,top:-4,width:9,height:9,borderRadius:"50%",background:"#d94f46",boxShadow:"0 0 0 3px #d94f4620"}}/>
              <div style={{position:"absolute",left:9,right:0,top:-0.5,height:1,background:"#d94f4635"}}/>
              <span style={{position:"absolute",right:4,top:-9,fontSize:9,color:"#d94f46",fontWeight:700,background:"#f5f1ec",padding:"1px 6px",borderRadius:4,letterSpacing:"0.02em"}}>{fmt(now)}</span>
            </div>
          )}

          {/* Drop hint for sidebar→timeline drag */}
          {drag&&!drag.fromTimeline&&drag.overTimeline&&drag.ghostMin!==null&&(
            <div style={{position:"absolute",top:minToPx(drag.ghostMin),left:LINE_X,right:16,pointerEvents:"none",zIndex:15}}>
              <div style={{height:2,background:"#d94f46",borderRadius:2}}/>
              <div style={{position:"absolute",left:-4,top:-3,width:8,height:8,borderRadius:"50%",background:"#d94f46"}}/>
              <span style={{position:"absolute",right:0,top:-11,fontSize:9,color:"#d94f46",fontWeight:700,background:"#f5f1ec",padding:"1px 5px",borderRadius:4}}>{fmt(drag.ghostMin)}</span>
            </div>
          )}

          {/* Gaps */}
          {gaps.map((g,i)=>(
            <div key={i}>
              <div style={{position:"absolute",left:LINE_X,top:minToPx(g.gs),width:1,height:g.dur*PX_PER_MIN,borderLeft:"1px dashed #ddd6cc",pointerEvents:"none"}}/>
              <div style={{position:"absolute",top:minToPx(g.gs)+g.dur*PX_PER_MIN/2-12,left:CARD_L}}>
                <div onClick={()=>openAdd(snapMin(g.gs+g.dur/2))}
                  style={{fontSize:10,color:"#bbb",padding:"3px 10px",borderRadius:20,border:"1px solid #e4ddd5",background:"#faf6f1",cursor:"pointer",whiteSpace:"nowrap",userSelect:"none",transition:"all .2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.color="#888";e.currentTarget.style.borderColor="#ccc";}}
                  onMouseLeave={e=>{e.currentTarget.style.color="#bbb";e.currentTarget.style.borderColor="#e4ddd5";}}>
                  🕐 {fmtDur(g.dur)} free · + add
                </div>
              </div>
            </div>
          ))}

          {/* ── TASKS ── */}
          {sorted.map(task=>{
            const status  = getStatus(task);
            const prog    = getProgress(task);
            const hex     = getHex(task.color);
            const shell   = shellColor(hex);
            const topY    = minToPx(task.start);
            const hasDur  = !!(task.dur&&task.dur>0);
            const durPx   = hasDur ? Math.max(44, task.dur*PX_PER_MIN) : 0;
            const nodeH   = hasDur ? Math.max(44,durPx) : NODE_W;

            const isTLDrag = drag?.fromTimeline && drag?.id===task.id && drag?.moved;

            // Pill coloring:
            // past  → fully filled (hex, slightly faded)
            // now   → filling up with progress (hex gradient)
            // done  → fully filled (hex, solid)
            // soon/upcoming → tinted shell, colored icon
            const isPast    = status==="past";
            const isDone    = status==="done";
            const isNow     = status==="now";
            const isSoon    = status==="soon";
            const isUpcoming= status==="upcoming";

            // For past: pill is fully filled but slightly desaturated
            const fillFraction = isDone ? 1 : isPast ? 1 : isNow ? prog : 0;
            const pillFillColor = isPast
              ? hex+"bb"
              : `linear-gradient(180deg,${hex}ee 0%,${hex}cc 100%)`;
            const hasFill = isDone||isPast||(isNow&&prog>0);
            const iconFilter = (isDone||(isPast&&fillFraction===1)) ? "grayscale(1) brightness(5)" : isNow&&prog>0.6 ? "brightness(10) grayscale(1)" : "none";

            // Card text colors — must always be visible
            const nameColor = isDone||isPast ? "#aaa" : "#1a1a1a";
            const metaColor = isNow||isSoon ? hex : isPast||isDone ? "#c0b8b0" : "#999";

            return (
              <div key={task.id}
                style={{position:"absolute",top:topY,left:0,right:16,display:"flex",alignItems:"flex-start",
                  zIndex:isTLDrag?20:2,
                  opacity:isPast&&!isDone?0.55:1,
                  transition:"opacity .3s",
                }}>

                {/* Time label — always readable */}
                <div style={{width:TIME_W,flexShrink:0,textAlign:"right",paddingRight:9,paddingTop:hasDur?10:7}}>
                  <span style={{
                    fontSize:10,fontWeight:isNow||isSoon?700:500,
                    color:isNow||isSoon?hex:isPast?"#c0b8b0":"#888",
                    lineHeight:1,whiteSpace:"nowrap",letterSpacing:"0.01em",
                  }}>
                    {fmt(task.start)}
                  </span>
                </div>

                {/* ── PILL / DOT — draggable — */}
                <div
                  onMouseDown={e=>beginDrag(e,task,true)}
                  style={{
                    position:"absolute",left:NODE_L,top:0,
                    width:NODE_W,height:nodeH,
                    borderRadius:hasDur?17:"50%",
                    background:shell,
                    border:`1.5px solid ${isNow||isSoon?hex+"60":isDone||isPast?hex+"80":"#ddd6cc"}`,
                    overflow:"hidden",position:"absolute",left:NODE_L,top:0,
                    cursor:isTLDrag?"grabbing":"grab",
                    boxShadow:isNow?`0 0 0 4px ${hex}1a`:isSoon?`0 0 0 3px ${hex}12`:"none",
                    transition:"box-shadow .3s",userSelect:"none",
                  }}>
                  {/* Fill layer */}
                  {hasFill&&(
                    <div style={{
                      position:"absolute",top:0,left:0,right:0,
                      height:`${fillFraction*100}%`,
                      background:isPast||isDone?hex:pillFillColor,
                      transition:"height 1.5s linear",
                    }}/>
                  )}
                  {/* Icon */}
                  <div style={{
                    position:"absolute",
                    top:hasDur?8:0,left:0,right:0,
                    bottom:hasDur?16:0,
                    display:"flex",alignItems:hasDur?"flex-start":"center",justifyContent:"center",
                    fontSize:14,zIndex:2,
                    filter:iconFilter,
                    paddingTop:hasDur?2:0,
                  }}>
                    {task.icon}
                  </div>
                  {/* Checkmark at bottom of pill */}
                  {hasDur&&(
                    <div style={{position:"absolute",bottom:5,left:0,right:0,display:"flex",justifyContent:"center",zIndex:2}}>
                      <div style={{
                        width:13,height:13,borderRadius:4,
                        background:isDone||isPast?"rgba(255,255,255,0.22)":isNow?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.06)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:7,fontWeight:700,
                        color:isDone||isPast||isNow?"#fff":hex+"cc",
                      }}>✓</div>
                    </div>
                  )}
                </div>

                {/* ── CARD — also draggable (same handler) — */}
                <div
                  onMouseDown={e=>beginDrag(e,task,true)}
                  style={{
                    position:"absolute",left:CARD_L,right:34,top:0,
                    minHeight:hasDur?nodeH:28,
                    padding:hasDur?"10px 14px":"5px 14px",
                    borderRadius:12,
                    border:"1.5px solid transparent",
                    background:"transparent",
                    cursor:isTLDrag?"grabbing":"grab",
                    display:"flex",flexDirection:"column",justifyContent:"center",
                    transition:"background .12s, border-color .12s",
                    userSelect:"none",
                  }}
                  onMouseEnter={e=>{if(!isTLDrag){e.currentTarget.style.background="#ece6de";e.currentTarget.style.borderColor="#ddd6cc";}}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}>

                  {/* Meta line */}
                  <div style={{fontSize:10,fontWeight:isNow||isSoon?700:500,color:metaColor,marginBottom:3,lineHeight:1.2}}>
                    {isNow&&hasDur
                      ?`${fmtDur(task.start+task.dur-now)} remaining`
                      :isSoon
                      ?`In ${fmtDur(task.start-now)}`
                      :hasDur
                      ?`${fmt(task.start)} – ${fmt(task.start+task.dur)} · ${fmtDur(task.dur)}`
                      :fmt(task.start)}
                  </div>

                  {/* Task name — always high contrast */}
                  <div style={{
                    fontSize:14,fontWeight:600,
                    color:nameColor,
                    textDecoration:isDone?"line-through":"none",
                    lineHeight:1.3,
                  }}>
                    {task.name}
                  </div>

                  {/* Color accent bar */}
                  <div style={{width:20,height:2.5,borderRadius:2,background:hex,marginTop:5,opacity:isDone||isPast?0.2:0.7}}/>
                </div>

                {/* Complete button */}
                <div style={{position:"absolute",right:0,top:hasDur?10:5}}>
                  <button onClick={e=>{e.stopPropagation();toggleDone(task.id);}}
                    style={{
                      width:20,height:20,borderRadius:"50%",
                      border:`2px solid ${isDone?"#ccc":hex}`,
                      background:isDone?hex:"transparent",
                      cursor:"pointer",transition:"all .2s",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    }}
                    onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                    {isDone&&<span style={{fontSize:9,color:"#fff",fontWeight:800,lineHeight:1}}>✓</span>}
                  </button>
                </div>

                {/* Drag time badge */}
                {isTLDrag&&drag.ghostMin!==null&&(
                  <div style={{position:"absolute",left:CARD_L,top:-20,background:"#1a1a1a",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:5,whiteSpace:"nowrap",pointerEvents:"none",zIndex:30,letterSpacing:"0.02em"}}>
                    {fmt(drag.ghostMin)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div style={{width:222,background:"#ede8e1",borderLeft:"1px solid #ddd6cc",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column"}}>

        {/* Calendar section */}
        <div style={{padding:"18px 14px 14px",borderBottom:"1px solid #ddd6cc"}}>
          <div style={{fontSize:9,fontWeight:700,color:"#bbb",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Calendar</div>
          <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} tasksByDate={tasksByDate}/>
        </div>

        {/* Backlog */}
        <div style={{flex:1,padding:"14px 12px"}}>
          <div style={{fontSize:9,fontWeight:700,color:"#bbb",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Backlog</div>
          <div style={{fontSize:10,color:"#c0b8b0",marginBottom:12,lineHeight:1.5}}>Drag to schedule · drop off timeline to unschedule</div>

          {sideTasks.map(t=>{
            const hex = getHex(t.color);
            return (
              <div key={t.id} onMouseDown={e=>beginDrag(e,t,false)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:10,border:"1px solid #ddd6cc",background:"#f5f1ec",marginBottom:6,cursor:"grab",transition:"all .15s",userSelect:"none"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#ccc";e.currentTarget.style.background="#fff";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#ddd6cc";e.currentTarget.style.background="#f5f1ec";}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:hex,flexShrink:0}}/>
                <span style={{fontSize:15}}>{t.icon}</span>
                <span style={{fontSize:12,fontWeight:500,color:"#555",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
              </div>
            );
          })}

          {sideTasks.length===0&&(
            <div style={{fontSize:12,color:"#ccc",textAlign:"center",paddingTop:20}}>All scheduled 🎉</div>
          )}
        </div>
      </div>

      {/* ── FLOATING GHOST ── */}
      {drag&&drag.moved&&(
        <div style={{position:"fixed",left:drag.x+16,top:drag.y-16,pointerEvents:"none",zIndex:1000,
          padding:"7px 13px",borderRadius:10,background:"#1a1a1a",color:"#fff",fontSize:13,
          display:"flex",alignItems:"center",gap:9,boxShadow:"0 8px 36px rgba(0,0,0,0.2)",whiteSpace:"nowrap",border:"1px solid #333"}}>
          <div style={{width:9,height:9,borderRadius:"50%",background:getHex(drag.task.color),flexShrink:0}}/>
          <span style={{fontSize:15}}>{drag.task.icon}</span>
          <span style={{fontWeight:600,fontSize:13}}>{drag.task.name}</span>
          {drag.overTimeline&&drag.ghostMin!==null
            ?<span style={{color:"#d94f46",fontWeight:700,fontSize:10}}>→ {fmt(drag.ghostMin)}</span>
            :drag.fromTimeline
            ?<span style={{color:"#888",fontSize:10}}>drop to unschedule</span>
            :null}
        </div>
      )}

      {/* ── MODAL ── */}
      {modal&&(
        <TaskModal
          initial={modal.mode==="edit"?modal.task:{start:modal.presetStart,dur:null,name:"",icon:"📝",color:"slate",date:selectedDate}}
          selectedDate={selectedDate}
          onSave={handleSave}
          onClose={()=>setModal(null)}
          onDelete={modal.mode==="edit"?handleDelete:null}
        />
      )}
    </div>
  );
}