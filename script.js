/* =========================================================
   Admission Dashboard (GitHub Pages / Vanilla JS)
   - 3-year comparison: horizontal grade lines + dots by year
   - Tooltip: major + rank + grade
   - Table shows only when university selected; majors optional
   - Robust CSV header mapping
   ========================================================= */

(() => {
  // ---------- Config
  const CSV_PATH = "data/admission_data_full_cleaned.csv";
  const APP = document.querySelector(".app-container");

  const DEFAULT_MAX_GRADE = 9; // 등급선 1~9 기본 (데이터 따라 자동 조정)
  const MIN_GRADE = 1;

  // ---------- Small utils
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toNum = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/,/g, "");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const safeText = (v) => (v === null || v === undefined ? "" : String(v));
  const uniq = (arr) => Array.from(new Set(arr));

  function normalizeHeader(h) {
    return String(h)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[()·\-_]/g, "");
  }

  function parseCSV(text) {
    // Simple CSV parser with quotes support
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && (c === ",")) {
        row.push(cur);
        cur = "";
        continue;
      }
      if (!inQuotes && (c === "\n" || c === "\r")) {
        if (c === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        // ignore empty trailing row
        if (row.some((x) => String(x).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      cur += c;
    }
    // last cell
    if (cur.length || row.length) {
      row.push(cur);
      if (row.some((x) => String(x).trim() !== "")) rows.push(row);
    }
    return rows;
  }

  // ---------- Header mapping (robust)
  function detectColumns(headersRaw) {
    const headers = headersRaw.map(normalizeHeader);

    const find = (candidates) => {
      for (const cand of candidates) {
        const n = normalizeHeader(cand);
        const idx = headers.indexOf(n);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    // Common candidates (Korean + possible variations)
    const idxYear = find(["연도", "학년도", "년도", "year"]);
    const idxUniv = find(["대학명", "대학", "학교", "univ", "university"]);
    const idxTrack = find(["중심전형", "전형구분", "트랙", "구분", "track"]);
    const idxType = find(["전형명", "전형", "전형유형", "type"]);
    const idxMajor = find(["모집단위", "모집단위명", "학과", "학부", "전공", "major"]);
    const idxQuota = find(["모집인원", "인원", "정원", "quota"]);
    const idxComp = find(["경쟁률", "경쟁율", "compete", "ratio"]);
    // Rank: try a lot (including the user's screenshot-ish "응원순위" typo)
    const idxRank = find([
      "등수", "석차", "순위", "지원자석차", "환산석차",
      "응시순위", "응원순위", "지원순위", "rank"
    ]);

    // Cuts: 50/70 or equivalent
    const idxCut50 = find(["50cut", "50%cut", "50퍼cut", "50퍼센트cut", "50퍼", "중앙값", "median", "50"]);
    const idxCut70 = find(["70cut", "70%cut", "70퍼cut", "70퍼센트cut", "70퍼", "upper70", "70"]);

    // If cut columns are named like "50% cut" with symbols, normalized finder should work.
    return {
      idxYear,
      idxUniv,
      idxTrack,
      idxType,
      idxMajor,
      idxQuota,
      idxComp,
      idxRank,
      idxCut50,
      idxCut70,
    };
  }

  function buildRecords(rows) {
    const headersRaw = rows[0] || [];
    const col = detectColumns(headersRaw);

    const records = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      const year = col.idxYear >= 0 ? toNum(r[col.idxYear]) : null;
      const univ = col.idxUniv >= 0 ? safeText(r[col.idxUniv]).trim() : "";
      const track = col.idxTrack >= 0 ? safeText(r[col.idxTrack]).trim() : "";
      const type = col.idxType >= 0 ? safeText(r[col.idxType]).trim() : "";
      const major = col.idxMajor >= 0 ? safeText(r[col.idxMajor]).trim() : "";

      const quota = col.idxQuota >= 0 ? toNum(r[col.idxQuota]) : null;
      const comp = col.idxComp >= 0 ? toNum(r[col.idxComp]) : null;

      const rank = col.idxRank >= 0 ? toNum(r[col.idxRank]) : null;
      const cut50 = col.idxCut50 >= 0 ? toNum(r[col.idxCut50]) : null;
      const cut70 = col.idxCut70 >= 0 ? toNum(r[col.idxCut70]) : null;

      if (!univ || !major || !year) continue;

      records.push({
        year,
        univ,
        track: track || "전체",
        type: type || "",
        major,
        quota,
        comp,
        rank,
        cut50,
        cut70,
        _raw: r,
      });
    }
    return { records, headersRaw, col };
  }

  // ---------- UI Skeleton
  function renderShell() {
    // Remove "데이터 로드 중..." (the last <p> in your HTML)
    const loadingP = $$("p", APP).find((p) => p.textContent.includes("데이터 로드"));
    if (loadingP) loadingP.remove();

    // Build dashboard container
    const shell = document.createElement("div");
    shell.className = "dash-shell";
    shell.innerHTML = `
      <div class="dash-top">
        <div class="controls card">
          <div class="row">
            <div class="field">
              <div class="label">트랙(중심전형)</div>
              <select id="trackSel"></select>
            </div>
            <div class="field">
              <div class="label">대학</div>
              <select id="univSel"></select>
            </div>
            <div class="field">
              <div class="label">검색(모집단위)</div>
              <input id="majorSearch" type="text" placeholder="학과/모집단위 검색" />
            </div>
            <div class="field">
              <div class="label">컷 기준</div>
              <div class="seg" id="cutSeg">
                <button class="seg-btn active" data-cut="50">50% cut</button>
                <button class="seg-btn" data-cut="70">70% cut</button>
              </div>
            </div>
          </div>

          <div class="row second">
            <div class="hint">
              ● 연도별 도트를 비교하세요. <b>도트를 클릭</b>하면 모집단위가 선택되고, 아래 표가 그 선택에 맞춰 뜹니다.<br/>
              ● 아무 모집단위도 선택하지 않으면 해당 전형/대학의 <b>전체</b>가 표로 나옵니다.
            </div>
            <div class="chips" id="majorChips"></div>
          </div>
        </div>

        <div class="summary card" id="summaryBox">
          <div class="summary-title">선택 요약</div>
          <div class="summary-body" id="summaryBody">대학을 선택하면 분석이 시작됩니다.</div>
        </div>
      </div>

      <div class="dash-main">
        <div class="chart card">
          <div class="chart-head">
            <div class="chart-title">3개년 추세 비교 (등급선 + 도트)</div>
            <div class="chart-sub">도트: 모집단위(학과) / 수평선: 등급</div>
          </div>
          <div class="chart-wrap">
            <svg id="viz" width="100%" height="520" viewBox="0 0 1100 520" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="tooltip" id="tip" style="display:none;"></div>
          </div>
        </div>

        <div class="table card" id="tableCard" style="display:none;">
          <div class="table-head">
            <div class="table-title">데이터 표 (선택한 모집단위 / 미선택 시 전체)</div>
            <div class="table-sub" id="tableSub"></div>
          </div>
          <div class="table-wrap">
            <table id="dataTable">
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    APP.appendChild(shell);
  }

  // ---------- Chart rendering (SVG)
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function formatNum(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "-";
    // Show integer nicely; else 2 decimals
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return n.toFixed(2);
  }

  function computeYearList(records) {
    const years = uniq(records.map((d) => d.year).filter(Number.isFinite)).sort((a, b) => a - b);
    // take last 3 years if many
    if (years.length > 3) return years.slice(-3);
    return years;
  }

  function getGradeValue(rec, cutMode) {
    const v = cutMode === "70" ? rec.cut70 : rec.cut50;
    return Number.isFinite(v) ? v : null;
  }

  function calcGradeRange(filtered, cutMode) {
    const vals = filtered.map((d) => getGradeValue(d, cutMode)).filter(Number.isFinite);
    if (!vals.length) return { minG: MIN_GRADE, maxG: DEFAULT_MAX_GRADE };
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    // Make range nicer; keep within 1..9 default unless data clearly beyond
    const minG = Math.max(MIN_GRADE, Math.floor(minV));
    const maxG = Math.max(minG + 1, Math.ceil(maxV));
    return { minG, maxG: Math.max(DEFAULT_MAX_GRADE, maxG) };
  }

  function drawChart(state) {
    const { records, years, cutMode, activeUniv, activeTrack, selectedMajors } = state;
    const svg = $("#viz");
    const tip = $("#tip");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 1100, H = 520;
    const pad = { l: 70, r: 30, t: 40, b: 55 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    // Filter
    let filtered = records.slice();
    if (activeTrack && activeTrack !== "__ALL__") filtered = filtered.filter((d) => d.track === activeTrack);
    if (activeUniv && activeUniv !== "__NONE__") filtered = filtered.filter((d) => d.univ === activeUniv);

    // If majors selected, focus (but still allow dots for context: keep all, highlight selected)
    const focusSet = new Set(selectedMajors);

    // Grade range
    const { minG, maxG } = calcGradeRange(filtered, cutMode);

    const xYear = (year) => {
      const idx = years.indexOf(year);
      const step = years.length <= 1 ? innerW : innerW / (years.length - 1);
      return pad.l + idx * step;
    };
    const yGrade = (g) => {
      // Smaller grade (1) should be higher
      const t = (g - minG) / (maxG - minG);
      return pad.t + t * innerH;
    };

    // defs: soft shadow
    const defs = svgEl("defs");
    const filter = svgEl("filter", { id: "ds", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    filter.appendChild(svgEl("feDropShadow", { dx: "0", dy: "2", stdDeviation: "2", "flood-opacity": "0.25" }));
    defs.appendChild(filter);
    svg.appendChild(defs);

    // Background
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }));

    // Grade lines
    for (let g = MIN_GRADE; g <= maxG; g++) {
      const y = yGrade(g);
      const line = svgEl("line", { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: "rgba(0,0,0,0.10)", "stroke-width": 1 });
      svg.appendChild(line);

      // label
      const lab = svgEl("text", {
        x: pad.l - 12,
        y: y + 4,
        "text-anchor": "end",
        "font-size": "12",
        fill: "rgba(0,0,0,0.65)",
      });
      lab.textContent = `${g}`;
      svg.appendChild(lab);
    }

    // Year axis
    years.forEach((yr) => {
      const x = xYear(yr);
      const vline = svgEl("line", { x1: x, y1: pad.t, x2: x, y2: pad.t + innerH, stroke: "rgba(0,0,0,0.08)", "stroke-width": 1 });
      svg.appendChild(vline);

      const t = svgEl("text", {
        x,
        y: H - 22,
        "text-anchor": "middle",
        "font-size": "14",
        fill: "rgba(0,0,0,0.75)",
        "font-weight": "700",
      });
      t.textContent = `${yr}`;
      svg.appendChild(t);
    });

    // If no university selected, show empty hint
    if (!activeUniv || activeUniv === "__NONE__") {
      const msg = svgEl("text", {
        x: W / 2,
        y: H / 2,
        "text-anchor": "middle",
        "font-size": "16",
        fill: "rgba(0,0,0,0.55)",
      });
      msg.textContent = "상단에서 대학을 선택하면 3개년 비교 그래프가 표시됩니다.";
      svg.appendChild(msg);
      return;
    }

    // Group by (major)
    const byMajor = new Map();
    filtered.forEach((d) => {
      const g = getGradeValue(d, cutMode);
      if (!Number.isFinite(g)) return;
      const key = d.major;
      if (!byMajor.has(key)) byMajor.set(key, []);
      byMajor.get(key).push(d);
    });

    // For each major, take one point per year (if duplicates: choose the one with smallest grade value? or median)
    function pickPoint(list, year) {
      const a = list.filter((d) => d.year === year);
      if (!a.length) return null;
      // prefer record that has rank present; otherwise first
      const withRank = a.filter((d) => Number.isFinite(d.rank));
      const use = withRank.length ? withRank : a;
      // choose median cut value
      const sorted = use.slice().sort((x, y) => (getGradeValue(x, cutMode) ?? 1e9) - (getGradeValue(y, cutMode) ?? 1e9));
      return sorted[Math.floor(sorted.length / 2)];
    }

    // Draw lines for selected majors (trend)
    if (focusSet.size) {
      for (const m of focusSet) {
        const list = byMajor.get(m);
        if (!list) continue;
        const pts = years
          .map((yr) => pickPoint(list, yr))
          .filter(Boolean)
          .map((d) => ({ x: xYear(d.year), y: yGrade(getGradeValue(d, cutMode)), d }));

        if (pts.length >= 2) {
          const path = svgEl("path", {
            d: pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "),
            fill: "none",
            stroke: "rgba(0,0,0,0.55)",
            "stroke-width": 3,
            "stroke-linecap": "round",
            filter: "url(#ds)",
          });
          svg.appendChild(path);
        }
      }
    }

    // Draw dots (all majors)
    // To reduce overlap: jitter within each year column based on hash of major
    function hashStr(s) {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    }

    const dotGroup = svgEl("g");
    svg.appendChild(dotGroup);

    const majorList = Array.from(byMajor.keys()).sort((a, b) => a.localeCompare(b, "ko"));
    for (const major of majorList) {
      const list = byMajor.get(major);
      if (!list) continue;

      for (const yr of years) {
        const rec = pickPoint(list, yr);
        if (!rec) continue;

        const g = getGradeValue(rec, cutMode);
        if (!Number.isFinite(g)) continue;

        const baseX = xYear(yr);
        // jitter +/- 22 px
        const h = hashStr(major + "|" + yr);
        const jitter = ((h % 1000) / 1000 - 0.5) * 44;

        const x = clamp(baseX + jitter, pad.l + 10, W - pad.r - 10);
        const y = yGrade(g);

        const isFocused = focusSet.has(major);
        const r = isFocused ? 7.5 : 5.2;

        const c = svgEl("circle", {
          cx: x,
          cy: y,
          r,
          fill: isFocused ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.35)",
          stroke: isFocused ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
          "stroke-width": isFocused ? 2 : 1,
          filter: "url(#ds)",
          "data-major": major,
          "data-year": String(yr),
        });

        // label (rank/grade) for focused OR sparse labels
        if (isFocused) {
          const rankText = Number.isFinite(rec.rank) ? `#${formatNum(rec.rank)}` : "#-";
          const lbl = svgEl("text", {
            x: x + 10,
            y: y - 10,
            "font-size": "12",
            fill: "rgba(0,0,0,0.85)",
            "font-weight": "800",
          });
          lbl.textContent = `${rankText} · ${formatNum(g)}등급`;
          dotGroup.appendChild(lbl);
        }

        // events
        c.style.cursor = "pointer";
        c.addEventListener("mousemove", (ev) => {
          const rankText = Number.isFinite(rec.rank) ? `등수(석차): ${formatNum(rec.rank)}` : "등수(석차): -";
          const tText = rec.type ? `전형: ${rec.type}` : "";
          const qText = Number.isFinite(rec.quota) ? `모집인원: ${formatNum(rec.quota)}` : "";
          const compText = Number.isFinite(rec.comp) ? `경쟁률: ${formatNum(rec.comp)}` : "";

          tip.style.display = "block";
          tip.innerHTML = `
            <div style="font-weight:900; margin-bottom:6px;">${safeText(rec.major)}</div>
            <div>연도: <b>${rec.year}</b></div>
            <div>${rankText}</div>
            <div>${cutMode === "70" ? "70% cut" : "50% cut"}: <b>${formatNum(g)}등급</b></div>
            ${tText ? `<div>${tText}</div>` : ""}
            ${qText ? `<div>${qText}</div>` : ""}
            ${compText ? `<div>${compText}</div>` : ""}
          `;

          const rect = APP.getBoundingClientRect();
          tip.style.left = `${ev.clientX - rect.left + 12}px`;
          tip.style.top = `${ev.clientY - rect.top + 12}px`;
        });
        c.addEventListener("mouseleave", () => {
          tip.style.display = "none";
        });
        c.addEventListener("click", () => {
          toggleMajorSelection(state, major);
        });

        dotGroup.appendChild(c);
      }
    }

    // Axis titles
    const yTitle = svgEl("text", {
      x: 16,
      y: pad.t + innerH / 2,
      transform: `rotate(-90 16 ${pad.t + innerH / 2})`,
      "text-anchor": "middle",
      "font-size": "14",
      fill: "rgba(0,0,0,0.75)",
      "font-weight": "800",
    });
    yTitle.textContent = "등급 (낮을수록 우수)";
    svg.appendChild(yTitle);

    const xTitle = svgEl("text", {
      x: pad.l + innerW / 2,
      y: H - 6,
      "text-anchor": "middle",
      "font-size": "13",
      fill: "rgba(0,0,0,0.55)",
    });
    xTitle.textContent = "연도";
    svg.appendChild(xTitle);
  }

  // ---------- Table rendering
  function renderTable(state) {
    const tableCard = $("#tableCard");
    const thead = $("#dataTable thead");
    const tbody = $("#dataTable tbody");
    const sub = $("#tableSub");

    // Hide unless university selected
    if (!state.activeUniv || state.activeUniv === "__NONE__") {
      tableCard.style.display = "none";
      return;
    }
    tableCard.style.display = "block";

    // Filter
    let filtered = state.records.filter((d) => d.univ === state.activeUniv);
    if (state.activeTrack && state.activeTrack !== "__ALL__") filtered = filtered.filter((d) => d.track === state.activeTrack);

    // majors
    const focusSet = new Set(state.selectedMajors);
    const hasFocus = focusSet.size > 0;
    if (hasFocus) filtered = filtered.filter((d) => focusSet.has(d.major));

    // sort: major then year
    filtered.sort((a, b) => {
      const c = a.major.localeCompare(b.major, "ko");
      if (c !== 0) return c;
      return a.year - b.year;
    });

    const years = state.years;
    sub.textContent = `${state.activeUniv} / ${state.activeTrack === "__ALL__" ? "전체 트랙" : state.activeTrack} / ${hasFocus ? "선택 모집단위" : "전체 모집단위"} / ${state.cutMode === "70" ? "70% cut" : "50% cut"}`;

    // Build pivot by major for year comparison
    const byMajor = new Map();
    filtered.forEach((d) => {
      const g = getGradeValue(d, state.cutMode);
      if (!Number.isFinite(g)) return;
      if (!byMajor.has(d.major)) byMajor.set(d.major, {});
      const obj = byMajor.get(d.major);
      obj[d.year] = d;
    });

    // header
    while (thead.firstChild) thead.removeChild(thead.firstChild);
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    const htr = document.createElement("tr");
    const headers = ["모집단위", ...years.map((y) => `${y} (${state.cutMode === "70" ? "70" : "50"}cut)`), "증감(최신-과거)", "등수(최신)", "전형"];
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      htr.appendChild(th);
    });
    thead.appendChild(htr);

    // rows
    const majors = Array.from(byMajor.keys());
    for (const m of majors) {
      const row = document.createElement("tr");
      const cellMajor = document.createElement("td");
      cellMajor.textContent = m;
      cellMajor.className = "td-major";
      row.appendChild(cellMajor);

      const recs = years.map((y) => byMajor.get(m)[y] || null);
      const grades = recs.map((r) => (r ? getGradeValue(r, state.cutMode) : null));

      // grade cells with color cues
      for (let i = 0; i < years.length; i++) {
        const td = document.createElement("td");
        const g = grades[i];
        td.textContent = Number.isFinite(g) ? `${formatNum(g)}등급` : "-";
        td.className = "td-grade";
        if (Number.isFinite(g)) {
          // darker for better grades (smaller)
          // Use inline style without hard colors; rely on alpha
          const intensity = clamp((DEFAULT_MAX_GRADE - g) / DEFAULT_MAX_GRADE, 0, 1);
          td.style.background = `rgba(0,0,0,${0.06 + intensity * 0.14})`;
          td.style.color = `rgba(0,0,0,${0.75 + intensity * 0.20})`;
          td.style.fontWeight = intensity > 0.55 ? "900" : "700";
        }
        row.appendChild(td);
      }

      // delta newest-oldest
      const newest = grades[grades.length - 1];
      const oldest = grades[0];
      const delta = (Number.isFinite(newest) && Number.isFinite(oldest)) ? (newest - oldest) : null;
      const tdDelta = document.createElement("td");
      if (delta === null) {
        tdDelta.textContent = "-";
      } else {
        // negative delta = improved (grade smaller)
        const sign = delta > 0 ? "+" : "";
        tdDelta.textContent = `${sign}${delta.toFixed(2)} (등급)`;
        const improve = delta < 0;
        tdDelta.style.fontWeight = "900";
        tdDelta.style.background = improve ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)";
        tdDelta.style.color = improve ? "rgba(0,0,0,0.90)" : "rgba(0,0,0,0.75)";
      }
      row.appendChild(tdDelta);

      // newest rank
      const newestRec = recs[recs.length - 1];
      const tdRank = document.createElement("td");
      tdRank.textContent = newestRec && Number.isFinite(newestRec.rank) ? `#${formatNum(newestRec.rank)}` : "-";
      tdRank.style.fontWeight = "900";
      row.appendChild(tdRank);

      // type
      const tdType = document.createElement("td");
      tdType.textContent = newestRec?.type ? newestRec.type : (recs.find((r) => r?.type)?.type || "-");
      row.appendChild(tdType);

      // click to select major from table
      row.style.cursor = "pointer";
      row.addEventListener("click", () => toggleMajorSelection(state, m));

      tbody.appendChild(row);
    }
  }

  // ---------- Selection handling
  function updateChips(state) {
    const chips = $("#majorChips");
    chips.innerHTML = "";

    const set = state.selectedMajors;
    if (!set.size) {
      chips.innerHTML = `<span class="chip empty">선택된 모집단위 없음</span>`;
      return;
    }

    for (const m of Array.from(set)) {
      const el = document.createElement("span");
      el.className = "chip";
      el.innerHTML = `${m}<button class="x" title="삭제">×</button>`;
      $("button.x", el).addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedMajors.delete(m);
        refresh(state);
      });
      chips.appendChild(el);
    }

    // clear all
    const clear = document.createElement("button");
    clear.className = "chip-clear";
    clear.textContent = "선택 해제";
    clear.addEventListener("click", () => {
      state.selectedMajors.clear();
      refresh(state);
    });
    chips.appendChild(clear);
  }

  function updateSummary(state) {
    const box = $("#summaryBody");

    if (!state.activeUniv || state.activeUniv === "__NONE__") {
      box.textContent = "대학을 선택하면 분석이 시작됩니다.";
      return;
    }

    const focus = state.selectedMajors.size ? `선택 모집단위: ${state.selectedMajors.size}개` : "선택 모집단위 없음(전체 표시)";
    box.innerHTML = `
      <div style="font-weight:900; font-size:15px; margin-bottom:8px;">${state.activeUniv}</div>
      <div>트랙: <b>${state.activeTrack === "__ALL__" ? "전체" : state.activeTrack}</b></div>
      <div>기준: <b>${state.cutMode === "70" ? "70% cut" : "50% cut"}</b></div>
      <div>${focus}</div>
      <div style="margin-top:10px; opacity:0.8;">팁: 도트/표 행 클릭 → 모집단위 선택(추세선 표시)</div>
    `;
  }

  function toggleMajorSelection(state, major) {
    if (state.selectedMajors.has(major)) state.selectedMajors.delete(major);
    else state.selectedMajors.add(major);
    refresh(state);
  }

  function refresh(state) {
    updateChips(state);
    updateSummary(state);
    drawChart(state);
    renderTable(state);
  }

  // ---------- Control binding
  function initControls(state) {
    const trackSel = $("#trackSel");
    const univSel = $("#univSel");
    const search = $("#majorSearch");
    const cutSeg = $("#cutSeg");

    // Tracks
    const tracks = uniq(state.records.map((d) => d.track).filter((s) => s && s.trim() !== "")).sort((a, b) => a.localeCompare(b, "ko"));
    trackSel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "__ALL__";
    optAll.textContent = "전체";
    trackSel.appendChild(optAll);
    tracks.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      trackSel.appendChild(o);
    });
    trackSel.value = "__ALL__";

    // Universities (initially all; filtered by track later)
    function rebuildUnivs() {
      const track = trackSel.value;
      let recs = state.records.slice();
      if (track !== "__ALL__") recs = recs.filter((d) => d.track === track);
      const univs = uniq(recs.map((d) => d.univ)).sort((a, b) => a.localeCompare(b, "ko"));

      const prev = univSel.value;
      univSel.innerHTML = "";
      const none = document.createElement("option");
      none.value = "__NONE__";
      none.textContent = "대학 선택";
      univSel.appendChild(none);

      univs.forEach((u) => {
        const o = document.createElement("option");
        o.value = u;
        o.textContent = u;
        univSel.appendChild(o);
      });

      // keep selection if possible
      if (univs.includes(prev)) univSel.value = prev;
      else univSel.value = "__NONE__";
    }
    rebuildUnivs();

    trackSel.addEventListener("change", () => {
      state.activeTrack = trackSel.value;
      // When changing track, keep majors only if still exist
      state.selectedMajors.clear();
      rebuildUnivs();
      state.activeUniv = univSel.value;
      refresh(state);
    });

    univSel.addEventListener("change", () => {
      state.activeUniv = univSel.value;
      state.selectedMajors.clear();
      refresh(state);
    });

    // Cut segment
    $$(".seg-btn", cutSeg).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".seg-btn", cutSeg).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.cutMode = btn.dataset.cut; // "50" or "70"
        refresh(state);
      });
    });

    // Search majors: when user types, auto-select the first few matches (soft assist)
    let searchTimer = null;
    search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = search.value.trim();
        if (!q) return;
        if (!state.activeUniv || state.activeUniv === "__NONE__") return;

        let recs = state.records.filter((d) => d.univ === state.activeUniv);
        if (state.activeTrack !== "__ALL__") recs = recs.filter((d) => d.track === state.activeTrack);

        const majors = uniq(recs.map((d) => d.major));
        const hits = majors.filter((m) => m.includes(q)).slice(0, 6);

        // add hits
        hits.forEach((m) => state.selectedMajors.add(m));
        refresh(state);
      }, 180);
    });
  }

  // ---------- Add minimal CSS helpers (in case style.css is minimal)
  function injectSafetyStyles() {
    const s = document.createElement("style");
    s.textContent = `
      .dash-shell { margin-top: 18px; display: grid; gap: 14px; }
      .dash-top { display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 14px; align-items: stretch; }
      .dash-main { display: grid; gap: 14px; }
      .card {
        border-radius: 16px;
        background: rgba(255,255,255,0.65);
        border: 1px solid rgba(0,0,0,0.06);
        box-shadow: 0 10px 24px rgba(0,0,0,0.08);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      .controls { padding: 14px 14px 10px; }
      .row { display:flex; gap:12px; flex-wrap: wrap; align-items: end; }
      .row.second { align-items: center; margin-top: 10px; justify-content: space-between; }
      .field { min-width: 220px; flex: 1; }
      .label { font-size: 12px; font-weight: 800; opacity: 0.75; margin-bottom: 6px; }
      select, input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.10);
        background: rgba(255,255,255,0.85);
        font-size: 14px;
        outline: none;
      }
      select:focus, input:focus { border-color: rgba(0,0,0,0.25); }
      .seg { display:flex; gap:8px; }
      .seg-btn{
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.10);
        background: rgba(255,255,255,0.70);
        font-weight: 900;
        cursor:pointer;
      }
      .seg-btn.active{ background: rgba(0,0,0,0.85); color: white; border-color: rgba(0,0,0,0.85); }
      .hint{ font-size: 12.5px; line-height: 1.5; opacity: 0.8; flex: 1.2; }
      .chips{ display:flex; gap:8px; align-items:center; justify-content:flex-end; flex-wrap: wrap; }
      .chip{
        display:inline-flex; align-items:center; gap:8px;
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(0,0,0,0.06);
        border: 1px solid rgba(0,0,0,0.08);
        font-weight: 900;
        font-size: 12.5px;
      }
      .chip.empty{ opacity: 0.6; font-weight: 800; }
      .chip .x{
        border: none; cursor: pointer;
        width: 22px; height: 22px;
        border-radius: 999px;
        background: rgba(0,0,0,0.12);
        font-weight: 900;
      }
      .chip-clear{
        padding: 8px 10px; border-radius: 999px;
        border: 1px solid rgba(0,0,0,0.10);
        background: rgba(255,255,255,0.85);
        font-weight: 900;
        cursor:pointer;
      }
      .summary{ padding: 14px; }
      .summary-title{ font-weight: 1000; font-size: 14px; opacity: 0.8; margin-bottom: 8px; }
      .summary-body{ font-size: 13px; line-height: 1.6; }
      .chart{ padding: 14px; }
      .chart-head{ display:flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 10px;}
      .chart-title{ font-size: 15px; font-weight: 1000; }
      .chart-sub{ font-size: 12px; opacity: 0.7; font-weight: 800; }
      .chart-wrap{ position: relative; }
      .tooltip{
        position:absolute;
        min-width: 220px;
        max-width: 320px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255,255,255,0.92);
        border: 1px solid rgba(0,0,0,0.10);
        box-shadow: 0 12px 26px rgba(0,0,0,0.12);
        font-size: 12.5px;
        line-height: 1.5;
        pointer-events:none;
      }
      .table{ padding: 14px; }
      .table-head{ display:flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; }
      .table-title{ font-size: 15px; font-weight: 1000; }
      .table-sub{ font-size: 12px; opacity: 0.7; font-weight: 800; }
      .table-wrap{ overflow:auto; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); }
      table{ width: 100%; border-collapse: collapse; min-width: 860px; }
      th, td{ padding: 10px 10px; border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 13px; }
      th{ position: sticky; top:0; background: rgba(255,255,255,0.90); font-weight: 1000; text-align:left; }
      td.td-major{ font-weight: 1000; }
      td.td-grade{ font-weight: 900; }
      tr:hover td{ background: rgba(0,0,0,0.045); }
      @media (max-width: 980px){
        .dash-top{ grid-template-columns: 1fr; }
        .field{ min-width: 160px; }
        svg{ height: 480px; }
      }
    `;
    document.head.appendChild(s);
  }

  // ---------- Boot
  async function boot() {
    injectSafetyStyles();

    const res = await fetch(CSV_PATH);
    if (!res.ok) throw new Error(`CSV 로드 실패: ${res.status}`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    if (!rows.length) throw new Error("CSV가 비어있습니다.");

    const { records } = buildRecords(rows);

    renderShell();

    const years = computeYearList(records);

    const state = {
      records,
      years,
      cutMode: "50",
      activeTrack: "__ALL__",
      activeUniv: "__NONE__",
      selectedMajors: new Set(),
    };

    initControls(state);
    refresh(state);
  }

  boot().catch((err) => {
    console.error(err);
    const p = document.createElement("p");
    p.style.marginTop = "12px";
    p.style.fontWeight = "900";
    p.style.opacity = "0.85";
    p.textContent = `오류: ${err.message}`;
    APP.appendChild(p);
  });
})();
