// ============================================================
//  ISRAELI POLLS DASHBOARD — app.js
//  DEFAULT: Bennett scenario (B, BC)
//  HISTORICAL: Old data without Bennett (D, PC)
//
//  AVERAGING METHOD:
//  Simple Moving Average (SMA) with configurable window.
//  All polls within the window are weighted equally.
//  The window is poll-count based (not time-based).
//  MA_WIN=5 means the last 5 polls are averaged.
// ============================================================

Chart.defaults.font.family = 'Heebo';
const CX = {};

// ============ HELPERS ============
function latest(data, n=10) { return [...data].sort((a,b)=>b.d.localeCompare(a.d)).slice(0,n); }
function sorted(data) { return [...data].sort((a,b)=>a.d.localeCompare(b.d)); }
function avg(polls, key) { const v=polls.map(p=>p[key]||0); return v.length?v.reduce((a,b)=>a+b,0)/v.length:0; }
function r1(n){ return Math.round(n*10)/10; }
function r0(n){ return Math.round(n); }
function coalSeats(poll,cfg){ return Object.keys(cfg).filter(k=>cfg[k].g===1).reduce((s,k)=>s+(poll[k]||0),0); }
function oppSeats(poll,cfg){ return Object.keys(cfg).filter(k=>cfg[k].g===0).reduce((s,k)=>s+(poll[k]||0),0); }
function kill(id){ if(CX[id]){CX[id].destroy();delete CX[id];} }
function makeChart(id,type,data,opts={},plugins){ kill(id); CX[id]=new Chart(document.getElementById(id),{type,data,options:opts,plugins:plugins||[]}); return CX[id]; }

// Moving average helpers
function ma(sortedPolls, key, win) {
  win = win || MA_WIN;
  const vals = sortedPolls.map(p=>p[key]||0);
  return vals.map((_,i)=>{
    const start=Math.max(0,i-win+1);
    const chunk=vals.slice(start,i+1);
    return r1(chunk.reduce((a,b)=>a+b,0)/chunk.length);
  });
}
function maFn(sortedPolls, fn, win) {
  win = win || MA_WIN;
  const vals = sortedPolls.map(fn);
  return vals.map((_,i)=>{
    const start=Math.max(0,i-win+1);
    const chunk=vals.slice(start,i+1);
    return r1(chunk.reduce((a,b)=>a+b,0)/chunk.length);
  });
}
const MA_WIN = 5;

const AX=(max)=>({x:{ticks:{color:'#64748b',maxTicksLimit:max||14,font:{size:10}},grid:{color:'#1e2d4a'}},y:{ticks:{color:'#64748b'},grid:{color:'#1e2d4a'}}});
const LG={rtl:true,labels:{color:'#94a3b8',font:{family:'Heebo',size:11},padding:6}};
const LG_FILT={...LG,labels:{...LG.labels,filter:item=>!item.text.startsWith('_')}};
function monthsAgo(n){const d=new Date();d.setMonth(d.getMonth()-n);return d.toISOString().slice(0,10);}

// ============ JOINED LIST FILTER ============
// From Jan 28, 2026, some polls include "הרשימה המשותפת" (joined list of
// חד"ש-תע"ל + רע"מ) while others still poll them separately.
// This filter lets the user choose which version to see.
let joinedFilter = 'all'; // 'all' | 'joined' | 'separate'

function getFilteredB() {
  if (joinedFilter === 'all') return B;
  if (joinedFilter === 'joined') {
    // Before cutoff: all polls. After cutoff: only polls with joined > 0
    return B.filter(p => p.d < JOINED_CUTOFF || (p.joined || 0) > 0);
  }
  // 'separate': Before cutoff: all. After cutoff: only polls with hadash or raam > 0
  return B.filter(p => p.d < JOINED_CUTOFF || (p.hadash || 0) > 0 || (p.raam || 0) > 0);
}

function onJoinedChange() {
  joinedFilter = document.getElementById('joined-filter').value;
  // Re-render current visible section
  document.querySelectorAll('.sec.on').forEach(sec => {
    const id = sec.id;
    loaded[id] = false;
    loaded[id] = true;
    loaders[id]?.();
  });
}

// ============ BAR + METER HELPERS ============
function makeBars(items, cfg, elId) {
  document.getElementById(elId).innerHTML = items.map(p=>{
    const delta = p.pv!==undefined ? r1(p.v-p.pv) : null;
    const cls = delta>0?'up':delta<0?'dn':'nt';
    const txt = delta===null?'':delta>0?`▲ +${delta}`:delta<0?`▼ ${delta}`:'—';
    const w = (p.v/40)*100;
    const c = cfg[p.k];
    return `<div class="pb"><div class="nm">${c.h}</div><div class="st" style="color:${c.c}">${p.v}</div><div class="br"><div class="fl" style="width:${w}%;background:${c.c}"></div></div>${delta!==null?`<div class="ch ${cls}">${txt}</div>`:''}</div>`;
  }).join('');
}

function makeMeter(coalAvg, elId) {
  const oppAvg = 120 - coalAvg;
  document.getElementById(elId).innerHTML = `
    <div class="cm"><div class="val" style="color:${coalAvg>=61?'var(--green)':'var(--red)'}">${coalAvg}</div>
    <div class="bar"><div class="fill" style="width:${(coalAvg/120)*100}%;background:linear-gradient(90deg,var(--accent),${coalAvg>=61?'var(--green)':'var(--red)'})"></div>
    <div class="tgt" style="right:${(61/120)*100}%"><span>61 — קו הרוב</span></div></div>
    <div class="tag" style="color:${coalAvg>=61?'var(--green)':'var(--red)'}">${coalAvg>=61?'יש רוב':'אין רוב'}</div></div>
    <div class="cm"><div class="val" style="color:var(--red)">${oppAvg}</div>
    <div class="bar"><div class="fill" style="width:${(oppAvg/120)*100}%;background:linear-gradient(90deg,var(--red),var(--orange))"></div></div>
    <div class="tag" style="color:var(--text2)">אופוזיציה</div></div>`;
}

// ============ TAB NAVIGATION ============
const loaded = {};
document.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  const s = btn.dataset.s;
  document.querySelectorAll('.sec').forEach(el=>el.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(el=>el.classList.remove('on'));
  document.getElementById(s).classList.add('on');
  btn.classList.add('on');
  if(!loaded[s]){ loaded[s]=true; loaders[s]?.(); }
});

const loaders = {};

// ============================================================
//  OVERVIEW — Bennett data
// ============================================================
loaders.overview = function() {
  const FB = getFilteredB();
  const L = latest(FB,10);
  const P = latest(FB,20).slice(10);
  const pk = Object.keys(BC);

  document.getElementById('last-date').textContent = L[0]?.d||'';
  document.getElementById('hdr-meta').innerHTML = `${FB.length} סקרים (עם בנט)<br>${D.length} סקרים (ללא בנט, ארכיון)`;

  const coalAvg = r0(L.reduce((s,p)=>s+coalSeats(p,BC),0)/L.length);
  const oppAvg = 120-coalAvg;
  const bnAvg = r1(avg(L,'bennet'));
  const likAvg = r1(avg(L,'likud'));
  const likPrev = r1(avg(P,'likud'));
  const likDelta = r1(likAvg-likPrev);

  document.getElementById('kpi-row').innerHTML = `
    <div class="kpi ai"><div class="v" style="color:var(--accent)">${FB.length}</div><div class="l">סקרים עם בנט</div></div>
    <div class="kpi ai"><div class="v" style="color:#d97706">${bnAvg}</div><div class="l">מפלגת בנט</div></div>
    <div class="kpi ai"><div class="v" style="color:#2563eb">${likAvg}</div><div class="l">ליכוד</div><div class="d ${likDelta>=0?'up':'dn'}">${likDelta>=0?'+':''}${likDelta}</div></div>
    <div class="kpi ai"><div class="v" style="color:${coalAvg>=61?'var(--green)':'var(--red)'}">${coalAvg}</div><div class="l">קואליציה</div><div class="d ${coalAvg>=61?'up':'dn'}">${coalAvg>=61?'רוב ✓':'אין רוב ✗'}</div></div>
    <div class="kpi ai"><div class="v" style="color:var(--red)">${oppAvg}</div><div class="l">אופוזיציה</div></div>`;

  const bars = pk.map(k=>({k,v:r1(avg(L,k)),pv:r1(avg(P,k))})).filter(p=>p.v>=1).sort((a,b)=>b.v-a.v);
  makeBars(bars, BC, 'ov-bars');

  const pie = bars.filter(p=>p.v>=2);
  makeChart('ch-pie','doughnut',{labels:pie.map(p=>BC[p.k].h),datasets:[{data:pie.map(p=>p.v),backgroundColor:pie.map(p=>BC[p.k].c),borderColor:'#111827',borderWidth:2}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',rtl:true,labels:{color:'#94a3b8',font:{family:'Heebo',size:11},padding:6}}}});

  makeMeter(coalAvg,'ov-meter');

  // Populate pollster dropdown
  const pollsterSel = document.getElementById('ov-pollster');
  if(pollsterSel.options.length <= 1) {
    const pollsters = [...new Set(FB.map(p=>p.p))].sort();
    pollsters.forEach(p => { const o=document.createElement('option');o.value=p;o.textContent=p;pollsterSel.appendChild(o); });
  }
  renderOverviewTrend();
};

function renderOverviewTrend() {
  const FB = getFilteredB();
  const pollsterF = document.getElementById('ov-pollster')?.value || 'all';
  const filtered = pollsterF === 'all' ? FB : FB.filter(p=>p.p === pollsterF);
  const cutoff = monthsAgo(3);
  const rec = sorted(filtered.filter(p=>p.d>=cutoff));
  if(rec.length < 2) {
    kill('ch-recent');
    document.getElementById('ch-recent').parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">אין מספיק נתונים לסוקר זה ב-3 חודשים אחרונים</div>';
    return;
  }
  // Make sure canvas exists
  const container = document.getElementById('ch-recent')?.parentElement;
  if(container && !document.getElementById('ch-recent')) {
    container.innerHTML = '<canvas id="ch-recent"></canvas>';
  }
  const topP = ['likud','bennet','democrats','liberman','shas','gantz','lapid','tora','ben_gvir','hadash','eisenkot','joined'];
  const recDS = [];
  const win = pollsterF === 'all' ? MA_WIN : Math.max(2, Math.min(MA_WIN, Math.floor(rec.length/2)));
  topP.filter(k=>BC[k]).forEach(k=>{
    const maVals = ma(rec, k, win);
    if(maVals.some(v=>v>0)){
      recDS.push({label:BC[k].h,data:maVals,borderColor:BC[k].c,borderWidth:2.5,pointRadius:0,tension:.4,fill:false});
      recDS.push({label:'_raw',data:rec.map(p=>p[k]||0),borderColor:BC[k].c+'40',borderWidth:0,pointRadius:2.5,pointBackgroundColor:BC[k].c+'50',showLine:false});
    }
  });
  makeChart('ch-recent','line',{labels:rec.map(p=>p.d),datasets:recDS},{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:AX(12),plugins:{legend:LG_FILT}});
}

// ============================================================
//  TRENDS — Bennett data
// ============================================================
let selP = ['likud','bennet','democrats','liberman','gantz','lapid','shas','ben_gvir'];

loaders.trends = function(){ renderTrends(); };

function renderTrends() {
  const FB = getFilteredB();
  const fl = document.getElementById('trend-flt');
  fl.innerHTML = Object.entries(BC).map(([k,v])=>
    `<button class="fb ${selP.includes(k)?'on':''}" style="${selP.includes(k)?'background:'+v.c+';border-color:'+v.c:''}" onclick="togP('${k}')">${v.h}</button>`
  ).join('');

  const S = sorted(FB);
  const trendDS = [];
  selP.filter(k=>BC[k]).forEach(k=>{
    trendDS.push({label:BC[k].h,data:ma(S,k),borderColor:BC[k].c,borderWidth:2.5,pointRadius:0,tension:.4,fill:false});
    trendDS.push({label:'_raw',data:S.map(p=>p[k]||0),borderColor:BC[k].c+'30',borderWidth:0,pointRadius:2,pointBackgroundColor:BC[k].c+'40',showLine:false});
  });
  makeChart('ch-trend','line',{labels:S.map(p=>p.d),datasets:trendDS},{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:AX(15),plugins:{legend:LG_FILT}});

  const changes=[];
  for(let i=1;i<S.length;i++){const diff=(S[i].likud||0)-(S[i-1].likud||0);if(Math.abs(diff)>=2)changes.push({d:S[i].d,v:diff});}
  const lc=changes.slice(-35);
  makeChart('ch-vol','bar',{labels:lc.map(c=>c.d),datasets:[{data:lc.map(c=>c.v),backgroundColor:lc.map(c=>c.v>0?'#10b981':'#ef4444'),borderRadius:3}]},{responsive:true,maintainAspectRatio:false,scales:AX(10),plugins:{legend:{display:false}}});

  const maParties=['likud','bennet','democrats'];
  const maData={};maParties.forEach(k=>{maData[k]=[];});
  const win=10;
  for(let i=win-1;i<S.length;i++){const chunk=S.slice(i-win+1,i+1);maParties.forEach(k=>{maData[k].push(r1(chunk.reduce((s,p)=>s+(p[k]||0),0)/win));});}
  makeChart('ch-ma','line',{labels:S.slice(win-1).map(p=>p.d),datasets:maParties.map(k=>({label:BC[k].h+' (ממוצע נע 10)',data:maData[k],borderColor:BC[k].c,borderWidth:2.5,pointRadius:0,tension:.4,fill:false}))},{responsive:true,maintainAspectRatio:false,scales:AX(12),plugins:{legend:LG}});
}
function togP(k){const i=selP.indexOf(k);if(i>=0)selP.splice(i,1);else selP.push(k);renderTrends();}

// ============================================================
//  COALITION — Bennett data
// ============================================================
loaders.coalition = function() {
  const FB = getFilteredB();
  const S = sorted(FB);
  const coalMA = maFn(S, p=>coalSeats(p,BC));
  const oppMA = maFn(S, p=>oppSeats(p,BC));
  makeChart('ch-coal','line',{labels:S.map(p=>p.d),datasets:[
    {label:'קואליציה',data:coalMA,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.08)',fill:true,borderWidth:2.5,pointRadius:0,tension:.4},
    {label:'אופוזיציה',data:oppMA,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.08)',fill:true,borderWidth:2.5,pointRadius:0,tension:.4},
    {label:'_rawC',data:S.map(p=>coalSeats(p,BC)),borderWidth:0,pointRadius:2,pointBackgroundColor:'#3b82f640',showLine:false},
    {label:'_rawO',data:S.map(p=>oppSeats(p,BC)),borderWidth:0,pointRadius:2,pointBackgroundColor:'#ef444440',showLine:false},
  ]},{responsive:true,maintainAspectRatio:false,scales:{...AX(15),y:{...AX().y,min:30,max:90}},plugins:{legend:LG_FILT}});

  const L = latest(FB,10);
  const coalP = Object.entries(BC).filter(([k,v])=>v.g===1);
  const oppP = Object.entries(BC).filter(([k,v])=>v.g===0);

  function fillBloc(arr,elId,totalId,label){
    const items=arr.map(([k,v])=>({k,v:r1(avg(L,k)),c:v})).filter(p=>p.v>=1).sort((a,b)=>b.v-a.v);
    const total=r0(items.reduce((s,p)=>s+p.v,0));
    document.getElementById(elId).innerHTML=items.map(p=>`<div class="pb"><div class="nm">${p.c.h}</div><div class="st" style="color:${p.c.c}">${p.v}</div><div class="br"><div class="fl" style="width:${(p.v/40)*100}%;background:${p.c.c}"></div></div></div>`).join('');
    document.getElementById(totalId).innerHTML=`<span style="font-size:1.2rem;font-weight:700;color:${total>=61?'var(--green)':'var(--accent)'}">${label}: ${total}</span>`;
  }
  fillBloc(coalP,'coal-bars','coal-total','סה״כ קואליציה');
  fillBloc(oppP,'opp-bars','opp-total','סה״כ אופוזיציה');

  const cI=coalP.map(([k,v])=>({k,v:r1(avg(L,k)),c:v})).filter(p=>p.v>=1);
  makeChart('ch-coal-pie1','doughnut',{labels:cI.map(p=>p.c.h),datasets:[{data:cI.map(p=>p.v),backgroundColor:cI.map(p=>p.c.c),borderColor:'#111827',borderWidth:2}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:LG,title:{display:true,text:'קואליציה',color:'#94a3b8',font:{family:'Rubik',size:14}}}});
  const oI=oppP.map(([k,v])=>({k,v:r1(avg(L,k)),c:v})).filter(p=>p.v>=1);
  makeChart('ch-coal-pie2','doughnut',{labels:oI.map(p=>p.c.h),datasets:[{data:oI.map(p=>p.v),backgroundColor:oI.map(p=>p.c.c),borderColor:'#111827',borderWidth:2}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:LG,title:{display:true,text:'אופוזיציה',color:'#94a3b8',font:{family:'Rubik',size:14}}}});
};

// ============================================================
//  POLLSTERS — Bennett data
// ============================================================
loaders.pollsters = function() {
  const FB = getFilteredB();
  const pm={};FB.forEach(p=>{if(!pm[p.p])pm[p.p]=[];pm[p.p].push(p.likud||0);});
  const pd=Object.entries(pm).map(([n,v])=>({n,a:r1(v.reduce((a,b)=>a+b,0)/v.length),c:v.length})).filter(p=>p.c>=3).sort((a,b)=>b.a-a.a);
  makeChart('ch-polst','bar',{labels:pd.map(p=>p.n),datasets:[{label:'ממוצע ליכוד',data:pd.map(p=>p.a),backgroundColor:pd.map(p=>p.a>=30?'#2563eb':p.a>=25?'#3b82f6':'#60a5fa'),borderRadius:5}]},{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#64748b'},grid:{color:'#1e2d4a'},min:15},y:{ticks:{color:'#94a3b8',font:{family:'Heebo',size:11}},grid:{display:false}}},plugins:{legend:{display:false}}});

  const sm={};FB.forEach(p=>{sm[p.src]=(sm[p.src]||0)+1;});
  const sd=Object.entries(sm).sort((a,b)=>b[1]-a[1]);
  const clrs=['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#84cc16','#f97316','#6366f1','#14b8a6','#e879f9','#a855f7'];
  makeChart('ch-src','bar',{labels:sd.map(s=>s[0]),datasets:[{data:sd.map(s=>s[1]),backgroundColor:clrs.slice(0,sd.length),borderRadius:5}]},{responsive:true,maintainAspectRatio:false,scales:AX(15),plugins:{legend:{display:false}}});

  const mm={};FB.forEach(p=>{const m=p.d.slice(0,7);mm[m]=(mm[m]||0)+1;});
  const months=Object.keys(mm).sort();
  makeChart('ch-mon','bar',{labels:months,datasets:[{data:months.map(m=>mm[m]),backgroundColor:'#3b82f6',borderRadius:3}]},{responsive:true,maintainAspectRatio:false,scales:AX(15),plugins:{legend:{display:false}}});

  const overallCoal=r1(FB.reduce((s,p)=>s+coalSeats(p,BC),0)/FB.length);
  const biasData=Object.entries(pm).map(([n,v])=>{
    const polls=FB.filter(p=>p.p===n);if(polls.length<5)return null;
    const pCoal=r1(polls.reduce((s,p)=>s+coalSeats(p,BC),0)/polls.length);
    return{n,bias:r1(pCoal-overallCoal),c:polls.length};
  }).filter(Boolean).sort((a,b)=>b.bias-a.bias);
  makeChart('ch-bias','bar',{labels:biasData.map(p=>p.n),datasets:[{label:'סטייה מהממוצע',data:biasData.map(p=>p.bias),backgroundColor:biasData.map(p=>p.bias>0?'#3b82f6':'#ef4444'),borderRadius:4}]},{responsive:true,maintainAspectRatio:false,scales:AX(15),plugins:{legend:{display:false}}});
};

// ============================================================
//  COMPARE — Bennett vs non-Bennett
// ============================================================
loaders.compare = function() {
  const FB = getFilteredB();
  const mL=latest(D,15);const bL=latest(FB,15);
  const parties=['likud','shas','tora','ben_gvir','gantz','lapid','democrats','liberman','hadash','raam'];
  makeChart('ch-cmp','bar',{labels:parties.map(k=>(BC[k]||PC[k])?.h||k),datasets:[
    {label:'ללא בנט (אחרונים)',data:parties.map(k=>r1(avg(mL,k))),backgroundColor:'rgba(59,130,246,.7)',borderRadius:4},
    {label:'עם בנט (אחרונים)',data:parties.map(k=>r1(avg(bL,k))),backgroundColor:'rgba(217,119,6,.7)',borderRadius:4},
  ]},{responsive:true,maintainAspectRatio:false,scales:AX(15),plugins:{legend:LG}});

  const diffs=parties.map(k=>({k,d:r1(avg(bL,k)-avg(mL,k))}));
  diffs.push({k:'bennet',d:r1(avg(bL,'bennet'))});
  makeChart('ch-cmp-diff','bar',{labels:diffs.map(p=>(PC[p.k]||BC[p.k])?.h||p.k),datasets:[{data:diffs.map(p=>p.d),backgroundColor:diffs.map(p=>p.d>0?'#10b981':p.d<0?'#ef4444':'#64748b'),borderRadius:4}]},{responsive:true,maintainAspectRatio:false,scales:AX(15),plugins:{legend:{display:false}}});
};

// ============================================================
//  EVENTS
// ============================================================
loaders.events = function() {
  const allData = [...D,...getFilteredB()].sort((a,b)=>a.d.localeCompare(b.d));
  const seen = new Set();
  const S = [];
  for(const p of [...allData].reverse()) {
    const key = p.d+'|'+p.src;
    if(!seen.has(key)){seen.add(key);S.unshift(p);}
  }

  const coalEvMA = maFn(S, p=>coalSeats(p,p.bennet!==undefined?BC:PC));
  const likEvMA = ma(S, 'likud');
  const labels = S.map(p=>p.d);

  // Build event line positions: find closest label index for each event
  const evLines = EVENTS.map(ev => {
    const evDate = (ev.date||ev.d).slice(0,10);
    let closest = -1, minDiff = Infinity;
    labels.forEach((l,i) => {
      const diff = Math.abs(new Date(l) - new Date(evDate));
      if(diff < minDiff) { minDiff = diff; closest = i; }
    });
    return { idx: closest, text: ev.text||ev.t, date: evDate };
  }).filter(ev => ev.idx >= 0);

  // Custom plugin for vertical event lines
  const eventLinesPlugin = {
    id: 'eventLines',
    afterDraw(chart) {
      const { ctx, chartArea: {top, bottom}, scales: {x} } = chart;
      evLines.forEach(ev => {
        const xPos = x.getPixelForValue(ev.idx);
        if(xPos < chart.chartArea.left || xPos > chart.chartArea.right) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        // Label
        ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.font = '10px Heebo';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(xPos, top - 4);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(ev.text.length > 18 ? ev.text.slice(0,16)+'…' : ev.text, 0, 0);
        ctx.restore();
        ctx.restore();
      });
    }
  };

  makeChart('ch-ev','line',{labels,datasets:[
    {label:'קואליציה (ממוצע נע)',data:coalEvMA,borderColor:'#3b82f6',borderWidth:2.5,pointRadius:0,tension:.4,fill:false},
    {label:'ליכוד (ממוצע נע)',data:likEvMA,borderColor:'#2563eb',borderWidth:2,pointRadius:0,tension:.4,fill:false,borderDash:[4,4]},
    {label:'_rawC',data:S.map(p=>coalSeats(p,p.bennet!==undefined?BC:PC)),borderWidth:0,pointRadius:1.5,pointBackgroundColor:'#3b82f630',showLine:false},
  ]},{responsive:true,maintainAspectRatio:false,scales:AX(15),plugins:{legend:LG_FILT},layout:{padding:{top:40}}}, [eventLinesPlugin]);

  document.getElementById('ev-list').innerHTML = EVENTS.map(e=>
    `<div class="ev-tag">${(e.date||e.d).slice(0,10)} — ${e.text||e.t}</div>`
  ).join('');

  const impactData=EVENTS.map(ev=>{
    const evDate=(ev.date||ev.d).slice(0,10);
    const before=S.filter(p=>p.d<evDate).slice(-8);
    const after=S.filter(p=>p.d>evDate).slice(0,8);
    if(before.length<2||after.length<2)return null;
    const cfg=after[0].bennet!==undefined?BC:PC;
    const bCoal=r0(before.reduce((s,p)=>s+coalSeats(p,cfg),0)/before.length);
    const aCoal=r0(after.reduce((s,p)=>s+coalSeats(p,cfg),0)/after.length);
    return{t:ev.text||ev.t,b:bCoal,a:aCoal};
  }).filter(Boolean);

  makeChart('ch-ev-impact','bar',{labels:impactData.map(e=>e.t),datasets:[
    {label:'לפני',data:impactData.map(e=>e.b),backgroundColor:'rgba(59,130,246,.6)',borderRadius:4},
    {label:'אחרי',data:impactData.map(e=>e.a),backgroundColor:'rgba(239,68,68,.6)',borderRadius:4},
  ]},{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#94a3b8',font:{size:9},maxRotation:45},grid:{color:'#1e2d4a'}},y:{ticks:{color:'#64748b'},grid:{color:'#1e2d4a'},min:45,max:75}},plugins:{legend:LG}});
};

// ============================================================
//  TABLE
// ============================================================
loaders.table = function() {
  const srcEl=document.getElementById('tbl-src');const polEl=document.getElementById('tbl-pol');
  const allSrc=new Set([...B,...D].map(p=>p.src));
  const allPol=new Set([...B,...D].map(p=>p.p));
  [...allSrc].sort().forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;srcEl.appendChild(o);});
  [...allPol].sort().forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;polEl.appendChild(o);});
  renderTbl();
};

function renderTbl() {
  const ds=document.getElementById('tbl-ds').value;
  const srcF=document.getElementById('tbl-src').value;
  const polF=document.getElementById('tbl-pol').value;
  const sortO=document.getElementById('tbl-sort').value;
  const isMain=ds==='main';const raw=isMain?D:getFilteredB();const cfg=isMain?PC:BC;const pk=Object.keys(cfg);
  let data=[...raw];
  if(srcF!=='all')data=data.filter(p=>p.src===srcF);
  if(polF!=='all')data=data.filter(p=>p.p===polF);
  data.sort((a,b)=>sortO==='desc'?b.d.localeCompare(a.d):a.d.localeCompare(b.d));
  document.getElementById('tbl-count').textContent=`${data.length} סקרים`;
  const showP=pk.filter(k=>data.some(p=>(p[k]||0)>0));
  let h=`<table class="ptbl"><thead><tr><th>#</th><th>תאריך</th><th>מקור</th><th>סוקר</th><th>מדגם</th>`;
  showP.forEach(k=>{h+=`<th style="color:${cfg[k].c}">${cfg[k].h}</th>`;});
  h+=`<th>קואל׳</th></tr></thead><tbody>`;
  data.slice(0,300).forEach(p=>{
    const coal=Object.keys(cfg).filter(k=>cfg[k].g===1).reduce((s,k)=>s+(p[k]||0),0);
    h+=`<tr><td>${p.n}</td><td>${p.d}</td><td style="font-size:.72rem">${p.src}</td><td style="font-size:.72rem">${p.p}</td><td>${p.s}</td>`;
    showP.forEach(k=>{const v=p[k]||0;h+=`<td style="color:${v>=10?cfg[k].c:'var(--text3)'};font-weight:${v>=10?'600':'400'}">${v}</td>`;});
    h+=`<td style="font-weight:700;color:${coal>=61?'var(--green)':'var(--red)'}">${coal}</td></tr>`;
  });
  h+='</tbody></table>';
  if(data.length>300)h+=`<div style="text-align:center;padding:10px;color:var(--text3);font-size:.8rem">מציג 300 מתוך ${data.length}</div>`;
  document.getElementById('tbl-box').innerHTML=h;
}

// ============================================================
//  HISTORICAL — Old data without Bennett
// ============================================================
let selHP = ['likud','democrats','liberman','gantz','lapid','shas','ben_gvir'];

loaders.historical = function() { renderHistorical(); };

function renderHistorical() {
  const L=latest(D,10);const P=latest(D,20).slice(10);
  const coalAvg=r0(L.reduce((s,p)=>s+coalSeats(p,PC),0)/L.length);
  const likAvg=r1(avg(L,'likud'));

  document.getElementById('hist-kpi').innerHTML=`
    <div class="kpi"><div class="v">${D.length}</div><div class="l">סקרים</div></div>
    <div class="kpi"><div class="v" style="color:#2563eb">${likAvg}</div><div class="l">ליכוד</div></div>
    <div class="kpi"><div class="v" style="color:${coalAvg>=61?'var(--green)':'var(--red)'}">${coalAvg}</div><div class="l">קואליציה</div></div>
    <div class="kpi"><div class="v" style="color:var(--text2)">${D[0]?.d} → ${D[D.length-1]?.d}</div><div class="l">טווח תאריכים</div></div>`;

  const bars=Object.keys(PC).map(k=>({k,v:r1(avg(L,k)),pv:r1(avg(P,k))})).filter(p=>p.v>=1).sort((a,b)=>b.v-a.v);
  makeBars(bars,PC,'hist-bars');

  document.getElementById('hist-flt').innerHTML=Object.entries(PC).map(([k,v])=>
    `<button class="fb ${selHP.includes(k)?'on':''}" style="${selHP.includes(k)?'background:'+v.c+';border-color:'+v.c:''}" onclick="togHP('${k}')">${v.h}</button>`
  ).join('');

  const S=sorted(D);
  const histDS=[];
  selHP.filter(k=>PC[k]).forEach(k=>{
    histDS.push({label:PC[k].h,data:ma(S,k),borderColor:PC[k].c,borderWidth:2.5,pointRadius:0,tension:.4,fill:false});
    histDS.push({label:'_raw',data:S.map(p=>p[k]||0),borderColor:PC[k].c+'30',borderWidth:0,pointRadius:2,pointBackgroundColor:PC[k].c+'40',showLine:false});
  });
  makeChart('ch-hist-trend','line',{labels:S.map(p=>p.d),datasets:histDS},{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:AX(15),plugins:{legend:LG_FILT}});

  const hCoalMA=maFn(S,p=>coalSeats(p,PC));
  const hOppMA=maFn(S,p=>oppSeats(p,PC));
  makeChart('ch-hist-coal','line',{labels:S.map(p=>p.d),datasets:[
    {label:'קואליציה',data:hCoalMA,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.08)',fill:true,borderWidth:2.5,pointRadius:0,tension:.4},
    {label:'אופוזיציה',data:hOppMA,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.08)',fill:true,borderWidth:2.5,pointRadius:0,tension:.4},
  ]},{responsive:true,maintainAspectRatio:false,scales:{...AX(15),y:{...AX().y,min:30,max:90}},plugins:{legend:LG}});

  const pie=bars.filter(p=>p.v>=2);
  makeChart('ch-hist-pie','doughnut',{labels:pie.map(p=>PC[p.k].h),datasets:[{data:pie.map(p=>p.v),backgroundColor:pie.map(p=>PC[p.k].c),borderColor:'#111827',borderWidth:2}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',...LG}}});
}
function togHP(k){const i=selHP.indexOf(k);if(i>=0)selHP.splice(i,1);else selHP.push(k);renderHistorical();}

// ============================================================
//  BOOT
// ============================================================
loaded.overview = true;
loaders.overview();
