/* =====================================================
   HYBRID CUT DASHBOARD
   - Band (50~70) + Single cut
   - Ladder trend
   - Responsive SVG (Mobile / Tablet / PC)
   ===================================================== */

(async () => {
  const CSV_PATH = "data/admission_data_full_cleaned.csv";
  const container = document.querySelector(".app-container");

  /* ---------- Load CSV ---------- */
  const text = await fetch(CSV_PATH).then(r => r.text());
  const rows = text.trim().split("\n").map(r => r.split(","));
  const header = rows[0];
  const body = rows.slice(1);

  const idx = {
    year: header.indexOf("연도"),
    univ: header.indexOf("대학명"),
    major: header.indexOf("모집단위"),
    cut50: header.indexOf("50%컷"),
    cut70: header.indexOf("70%컷"),
  };

  const data = body.map(r => ({
    year: +r[idx.year],
    univ: r[idx.univ],
    major: r[idx.major],
    cut50: r[idx.cut50] ? +r[idx.cut50] : null,
    cut70: r[idx.cut70] ? +r[idx.cut70] : null,
  })).filter(d => d.major && d.year);

  const years = [...new Set(data.map(d => d.year))].sort();
  const majors = [...new Set(data.map(d => d.major))];

  /* ---------- Layout ---------- */
  container.innerHTML += `
    <div id="vizWrap" style="width:100%; margin-top:20px;">
      <svg id="chart"></svg>
    </div>
    <p style="
      font-size:14px;
      font-weight:700;
      opacity:.75;
      margin-top:10px;">
      ■ 색상 밴드: 50~70% 합격 안정 구간 /
      ■ 굵은 선: 단일 컷만 제공된 모집단위
    </p>
  `;

  const svg = document.getElementById("chart");

  /* ---------- Responsive size ---------- */
  function resize() {
    const W = container.clientWidth;
    const H = Math.max(420, window.innerHeight * 0.55);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    draw(W, H);
  }

  window.addEventListener("resize", resize);

  /* ---------- Draw ---------- */
  function draw(W, H) {
    svg.innerHTML = "";

    const pad = { l: 90, r: 40, t: 40, b: 70 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    const allCuts = data.flatMap(d => [d.cut50, d.cut70]).filter(Boolean);
    const minG = Math.floor(Math.min(...allCuts));
    const maxG = Math.ceil(Math.max(...allCuts));

    const x = y => pad.l + years.indexOf(y) * (innerW / (years.length - 1));
    const y = g => pad.t + (g - minG) / (maxG - minG) * innerH;

    /* ----- Grid & labels ----- */
    for (let g = minG; g <= maxG; g++) {
      const yy = y(g);
      svg.innerHTML += `
        <line x1="${pad.l}" x2="${W-pad.r}"
              y1="${yy}" y2="${yy}"
              stroke="rgba(0,0,0,.12)" />
        <text x="${pad.l-12}" y="${yy+5}"
              text-anchor="end"
              font-size="15"
              font-weight="800"
              fill="#333">${g}</text>
      `;
    }

    years.forEach(yr => {
      const xx = x(yr);
      svg.innerHTML += `
        <text x="${xx}" y="${H-25}"
              text-anchor="middle"
              font-size="18"
              font-weight="900"
              fill="#111">${yr}</text>
      `;
    });

    /* ----- Draw majors ----- */
    majors.forEach((m, i) => {
      const series = data.filter(d => d.major === m);
      let prev = null;

      series.forEach(d => {
        const xx = x(d.year);

        /* Band */
        if (d.cut50 && d.cut70) {
          svg.innerHTML += `
            <rect x="${xx-18}"
                  y="${y(d.cut50)}"
                  width="36"
                  height="${y(d.cut70)-y(d.cut50)}"
                  fill="rgba(52,152,219,.35)"
                  rx="6"/>
          `;
        }

        /* Line (cut50 preferred) */
        const g = d.cut50 ?? d.cut70;
        if (!g) return;
        const yy = y(g);

        svg.innerHTML += `
          <circle cx="${xx}" cy="${yy}"
                  r="6.5"
                  fill="#1f2d3d"
                  stroke="white"
                  stroke-width="2"/>
          <text x="${xx+10}" y="${yy-8}"
                font-size="15"
                font-weight="900"
                fill="#1f2d3d">
            ${g.toFixed(2)}
          </text>
        `;

        if (prev) {
          svg.innerHTML += `
            <line x1="${prev.x}" y1="${prev.y}"
                  x2="${xx}" y2="${yy}"
                  stroke="#1f2d3d"
                  stroke-width="3"
                  opacity=".7"/>
          `;
        }
        prev = { x: xx, y: yy };
      });
    });
  }

  resize();
})();
