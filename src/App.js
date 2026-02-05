import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';

const data = [
  { year: '2025', 모집인원: 50, cut50: 25, cut70: 35, cut50등급: 2.9, cut70등급: 3.7 },
  { year: '2024', 모집인원: 44, cut50: 22, cut70: 30, cut50등급: 2.8, cut70등급: 3.6 },
  { year: '2023', 모집인원: 40, cut50: 20, cut70: 28, cut50등급: 2.75, cut70등급: 3.5 }
];

function Gauge({ total, value, color, label, grade }) {
  return (
    <div style={{ textAlign: 'center', width: 260 }}>
      <PieChart width={260} height={140}>
        <Pie
          data={[{ value }, { value: total - value }]}
          startAngle={180}
          endAngle={0}
          cx="50%"
          cy="100%"
          innerRadius={60}
          outerRadius={90}
          dataKey="value"
        >
          <Cell fill={color} />
          <Cell fill="#eee" />
        </Pie>
      </PieChart>
      <div style={{ fontWeight: 800, fontSize: 20 }}>{grade}등급</div>
      <div style={{ fontSize: 14 }}>{label} · {value}등</div>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>모두의 3개년 수시입시결과 석차</h1>
      <h3 style={{ textAlign: 'center', fontWeight: 800 }}>Copyright@All Teachers</h3>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 40 }}>
        {data.map(d => (
          <div key={d.year}>
            <h2 style={{ textAlign: 'center' }}>{d.year}학년도</h2>
            <Gauge total={d.모집인원} value={d.cut50} color="#2e7d32" label="50% cut" grade={d.cut50등급} />
            <Gauge total={d.모집인원} value={d.cut70} color="#f9a825" label="70% cut" grade={d.cut70등급} />
          </div>
        ))}
      </div>
    </div>
  );
}
