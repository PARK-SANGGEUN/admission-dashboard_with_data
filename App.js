import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PieChart, Pie, Cell, Label } from 'recharts';

const yearData = [
  {
    year: '2023', 모집인원: 40, cut50: 20, cut70: 28, 충원순위: 90, 경쟁률: 10.5,
    대학명: '가야대', 중심전형: '교과', 전형명: '일반학생전형', 모집단위: '간호학과',
    cut50등급: 2.75, cut70등급: 3.5
  },
  {
    year: '2024', 모집인원: 44, cut50: 22, cut70: 30, 충원순위: 110, 경쟁률: 9.8,
    대학명: '가야대', 중심전형: '교과', 전형명: '일반학생전형', 모집단위: '간호학과',
    cut50등급: 2.8, cut70등급: 3.6
  },
  {
    year: '2025', 모집인원: 50, cut50: 25, cut70: 35, 충원순위: 120, 경쟁률: 10.2,
    대학명: '가야대', 중심전형: '교과', 전형명: '일반학생전형', 모집단위: '간호학과',
    cut50등급: 2.9, cut70등급: 3.7
  },
];

const COLORS = ['#00C49F', '#FFBB28', '#FF8042'];

function Gauge({ 모집인원, cutValue, label, color, 등급 }) {
  return (
    <div className="flex flex-col items-center w-full">
      <PieChart width={220} height={120}>
        <Pie
          data={[{ name: 'cut', value: cutValue }, { name: '남은구간', value: 모집인원 - cutValue }]}
          cx="50%"
          cy="100%"
          startAngle={180}
          endAngle={0}
          innerRadius={50}
          outerRadius={70}
          dataKey="value"
        >
          <Cell fill={color} />
          <Cell fill="#eee" />
          <Label value={`${label}`} position="centerBottom" style={{ fill: '#333', fontSize: 14, fontWeight: 'bold' }} />
        </Pie>
      </PieChart>
      <p className="text-sm font-semibold mt-[-8px]">등수: {cutValue}등 / <span className="text-base font-bold">등급: {등급}</span></p>
    </div>
  );
}

export default function AdmissionComparisonGauge() {
  const [compareMode, setCompareMode] = useState(true);

  return (
    <div className="p-4 md:p-8 bg-white min-h-screen">
      <h1 className="text-2xl md:text-4xl font-bold text-center mb-2">모두의 3개년 수시입시결과 석차</h1>
      <p className="text-center font-semibold text-sm md:text-base mb-6">Copyright@All Teachers</p>

      <div className="flex justify-end mb-4">
        <Checkbox checked={compareMode} onCheckedChange={() => setCompareMode(!compareMode)} />
        <span className="ml-2 text-sm">비교 모드</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {yearData.map((item, idx) => (
          <Card key={idx} className="bg-white shadow-lg rounded-2xl border p-4">
            <CardContent>
              <h3 className="text-lg font-bold text-center mb-2">{item.year}학년도</h3>
              <Gauge 모집인원={item.모집인원} cutValue={item.cut50} label="50% Cut" color={COLORS[0]} 등급={item.cut50등급} />
              <Gauge 모집인원={item.모집인원} cutValue={item.cut70} label="70% Cut" color={COLORS[1]} 등급={item.cut70등급} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">입시 결과 데이터</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-center text-sm">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(yearData[0]).map((key, idx) => (
                  <th key={idx} className="border px-2 py-1">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {Object.values(row).map((value, colIndex) => (
                    <td key={colIndex} className="border px-2 py-1">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-right text-sm text-gray-500 mt-2">출처: 어디가 3개년 입시결과</p>
      </div>
    </div>
  );
}
