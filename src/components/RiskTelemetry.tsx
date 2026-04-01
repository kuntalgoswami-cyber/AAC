import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useSecurityStore } from '../store';
import { Card } from './ui';

export function RiskTelemetry() {
  const logs = useSecurityStore(state => state.logs);
  
  // Prepare data: reverse so chronological is left-to-right, take last 20
  const data = [...logs].reverse().slice(-20).map(log => ({
    time: new Date(log.timestamp).toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' }),
    risk: Math.round(log.riskScore * 100),
    api: log.api
  }));

  return (
    <Card className="bg-[#111] border-white/10 p-4 h-64 flex flex-col shrink-0 shadow-xl">
      <h2 className="font-semibold text-gray-200 mb-4 text-sm flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Real-Time Risk Telemetry
      </h2>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="time" stroke="#666" fontSize={10} tickMargin={10} />
            <YAxis stroke="#666" fontSize={10} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: '#888', marginBottom: '4px' }}
            />
            <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Deny Threshold', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={40} stroke="#eab308" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'HITL Threshold', fill: '#eab308', fontSize: 10 }} />
            <Area type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} animationDuration={300} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
