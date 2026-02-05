const CSV_PATH = "data/admission_data_full_cleaned.csv";

const hybridSVG = document.getElementById("hybridChart");
const deltaSVG = document.getElementById("deltaChart");

const univSel = document.getElementById("univSelect");
const trackSel = document.getElementById("trackSelect");
const majorSel = document.getElementById("majorSelect");

const tableBody = document.querySelector("#dataTable tbody");

let RAW = [];
let state = { univ:"", track:"", major:"" };

/* ===== CSV LOAD ===== */
fetch(CSV_PATH)
  .then(r=>r.text())
  .then(text=>{
    const rows = text.trim().split("\n").map(r=>r.split(","));
    const h = rows[0];
    const d = rows.slice(1);

    const idx = {
      year: h.indexOf("연도"),
      univ: h.indexOf("대학명"),
      track: h.indexOf("중심전형") !== -1 ? h.indexOf("중심전형") : h.indexOf("전형"),
      major: h.indexOf("모집단위"),
      c50: h.indexOf("50%cut"),
      c70: h.indexOf("70%cut"),
    };

    RAW = d.map(r=>({
      year:+r[idx.year],
      univ:r[idx.univ],
      track:r[idx.track],
      major:r[idx.major],
      c50:r[idx.c50]?+r[idx.c50]:null,
      c70:r[idx.c70]?+r[idx.c70]:null,
    })).filter(d=>d.year && d.major);

    initFilters();
    renderAll();
  });

/* ===== FILTER INIT ===== */
function initFilters(){
  fillSelect(univSel, RAW.map(d=>d.univ));
  fillSelect(trackSel, RAW.map(d=>d.track));
  updateMajorSelect();

  univSel.onchange=()=>{state.univ=univSel.value; updateMajorSelect(); renderAll();};
  trackSel.onchange=()=>{state.track=trackSel.value; updateMajorSelect(); renderAll();};
  majorSel.onchange=()=>{state.major=majorSel.value; renderAll();};
}

function fillSelect(sel, arr){
  sel.innerHTML = `<option value="">전체</option>`;
  [...new Set(arr.filter(Boolean))].forEach(v=>{
    sel.innerHTML += `<option value="${v}">${v}</option>`;
  });
}

function updateMajorSelect(){
  const majors = filtered(false).map(d=>d.major);
  fillSelect(majorSel, majors);
}

/* ===== FILTER ===== */
function filtered(applyMajor=true){
  return RAW.filter(d=>
    (!state.univ || d.univ===state.univ) &&
    (!state.track || d.track===state.track) &&
    (!applyMajor || !state.major || d.major===state.major)
  );
}

/* ===== HYBRID CHART ===== */
function drawHybrid(){
  hybridSVG.innerHTML="";
  const data = filtered(false);
  if(!data.length) return;

  const years=[...new Set(data.map(d=>d.year))].sort();
  const cuts=data.flatMap(d=>[d.c50,d.c70]).filter(v=>v!==null);
  const minG=Math.floor(Math.min(...cuts));
  const maxG=Math.ceil(Math.max(...cuts));

  const W=hybridSVG.clientWidth, H=hybridSVG.clientHeight;
  const pad={l:80,r:40,t:40,b:60};
  const x=y=>pad.l+years.indexOf(y)*(W-pad.l-pad.r)/(years.length-1);
  const y=g=>pad.t+(g-minG)/(maxG-minG)*(H-pad.t-pad.b);

  for(let g=minG;g<=maxG;g++){
    hybridSVG.innerHTML+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(g)}" y2="${y(g)}" stroke="#ddd"/>
      <text x="${pad.l-8}" y="${y(g)+5}" text-anchor="end" font-size="15" font-weight="900">${g}</text>`;
  }
  years.forEach(yr=>{
    hybridSVG.innerHTML+=`<text x="${x(yr)}" y="${H-20}" text-anchor="middle" font-size="18" font-weight="900">${yr}</text>`;
  });

  const byMajor={};
  data.forEach(d=>{if(!byMajor[d.major])byMajor[d.major]=[]; byMajor[d.major].push(d);});

  Object.entries(byMajor).forEach(([m,series])=>{
    series.sort((a,b)=>a.year-b.year);
    let prev=null;
    const active=!state.major||state.major===m;
    const color=active?"#1f4bd8":"#bbb";
    const opacity=active?1:0.15;

    series.forEach(d=>{
      const xx=x(d.year);
      if(d.c50!==null && d.c70!==null){
        hybridSVG.innerHTML+=`<rect x="${xx-14}" y="${y(d.c50)}" width="28" height="${y(d.c70)-y(d.c50)}"
          fill="${active?"rgba(52,152,219,.45)":"#ddd"}" rx="6"/>`;
      }
      const g=d.c50??d.c70; if(g===null)return;
      const yy=y(g);
      hybridSVG.innerHTML+=`<circle cx="${xx}" cy="${yy}" r="6.5" fill="${color}" opacity="${opacity}"/>`;
      if(prev){
        hybridSVG.innerHTML+=`<line x1="${prev.x}" y1="${prev.y}" x2="${xx}" y2="${yy}"
          stroke="${color}" stroke-width="3" opacity="${opacity}"/>`;
      }
      prev={x:xx,y:yy};
    });
  });
}

/* ===== DATA TABLE ===== */
function drawTable(){
  tableBody.innerHTML="";
  const data=filtered();
  const years=[...new Set(data.map(d=>d.year))].sort();

  const byMajor={};
  data.forEach(d=>{if(!byMajor[d.major])byMajor[d.major]={}; byMajor[d.major][d.year]=d;});

  Object.entries(byMajor).forEach(([m,v])=>{
    const tr=document.createElement("tr");
    if(state.major===m) tr.classList.add("highlight");
    tr.innerHTML=`<td>${m}</td>`+years.map(y=>{
      const d=v[y]; const g=d?(d.c50??d.c70):"-";
      return `<td>${g?g.toFixed(2):"-"}</td>`;
    }).join("");
    tableBody.appendChild(tr);
  });
}

/* ===== DELTA ===== */
function drawDelta(){
  deltaSVG.innerHTML="";
  const data=filtered(false);
  if(!data.length) return;

  const years=[...new Set(data.map(d=>d.year))].sort();
  const start=years[0], end=years[years.length-1];
  const map={};
  data.forEach(d=>{if(!map[d.major])map[d.major]={}; map[d.major][d.year]=d;});

  const deltas=Object.entries(map).map(([m,v])=>{
    if(!v[start]||!v[end])return null;
    const a=v[start].c70??v[start].c50;
    const b=v[end].c70??v[end].c50;
    if(a===null||b===null)return null;
    return {major:m, delta:b-a};
  }).filter(Boolean);

  const W=deltaSVG.clientWidth,H=deltaSVG.clientHeight;
  const pad={l:220,r:40,t:40,b:40};
  const maxD=Math.max(...deltas.map(d=>Math.abs(d.delta)));
  const x=d=>pad.l+(d+maxD)/(2*maxD)*(W-pad.l-pad.r);

  deltas.forEach((d,i)=>{
    const yy=pad.t+i*28;
    const active=!state.major||state.major===d.major;
    deltaSVG.innerHTML+=`
      <text x="${pad.l-10}" y="${yy+5}" text-anchor="end" font-size="14" font-weight="800"
        opacity="${active?1:0.2}">${d.major}</text>
      <circle cx="${x(d.delta)}" cy="${yy}" r="6.5"
        fill="${d.delta>0?"#e74c3c":"#2ecc71"}" opacity="${active?1:0.2}"/>
      <text x="${x(d.delta)+8}" y="${yy+5}" font-size="14" font-weight="900"
        opacity="${active?1:0.2}">${d.delta.toFixed(2)}</text>`;
  });
}

/* ===== TABS ===== */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    hybridSVG.style.display=btn.dataset.tab==="hybrid"?"block":"none";
    deltaSVG.style.display=btn.dataset.tab==="delta"?"block":"none";
  };
});

function renderAll(){
  drawHybrid();
  drawDelta();
  drawTable();
}
