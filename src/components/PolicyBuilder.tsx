import React, { useState } from 'react';
import { Card, Button, Badge } from './ui';
import { Plus, Settings, ShieldAlert, Zap, Edit2, Trash2, Save, X } from 'lucide-react';

interface Policy {
  id: number;
  name: string;
  role: string;
  resource: string;
  action: 'ALLOW' | 'DENY' | 'HITL_REQUIRED';
  condition?: string;
  riskThreshold: number;
}

export function PolicyBuilder() {
  const [policies, setPolicies] = useState<Policy[]>([
    { id: 1, name: 'Support Agent Baseline', role: 'support_agent', resource: 'READ_TICKET, GET_USER_INFO, SUMMARIZE_TEXT', action: 'ALLOW', riskThreshold: 0.4 },
    { id: 2, name: 'Admin Override', role: 'admin_agent', resource: '*', action: 'ALLOW', riskThreshold: 0.9 },
    { id: 3, name: 'DLP Protection', role: '*', resource: 'EXPORT_DB, SEND_EXTERNAL_WEBHOOK', condition: 'payload contains PII', action: 'DENY', riskThreshold: 0.0 },
    { id: 4, name: 'Prompt Injection Defense', role: '*', resource: '*', condition: 'payload contains injection patterns', action: 'DENY', riskThreshold: 0.0 }
  ]);

  const [playbooks, setPlaybooks] = useState([
    { id: 1, name: 'Auto-Isolate on Extreme Risk', trigger: 'Risk Score >= 0.98', action: 'Block Agent ID', status: 'active' },
    { id: 2, name: 'Require HITL for Exfiltration', trigger: 'API == EXPORT_DB', action: 'Set Decision to HITL_REQUIRED', status: 'active' },
    { id: 3, name: 'Alert on Repeated Failures', trigger: '5 DENY events in 1 min', action: 'Send PagerDuty Alert', status: 'inactive' }
  ]);

  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSavePolicy = () => {
    if (editingPolicy) {
      if (isAdding) {
        setPolicies([...policies, { ...editingPolicy, id: Date.now() }]);
      } else {
        setPolicies(policies.map(p => p.id === editingPolicy.id ? editingPolicy : p));
      }
      setEditingPolicy(null);
      setIsAdding(false);
    }
  };

  const handleDeletePolicy = (id: number) => {
    setPolicies(policies.filter(p => p.id !== id));
  };

  const startAddPolicy = () => {
    setEditingPolicy({
      id: 0,
      name: 'New Policy',
      role: '*',
      resource: '*',
      action: 'ALLOW',
      riskThreshold: 0.5
    });
    setIsAdding(true);
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* Policy Builder */}
      <Card className="flex-1 bg-[#111] border-white/10 p-0 flex flex-col shadow-xl">
        <div className="p-4 border-b border-white/10 bg-[#1a1a1a] flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            ABAC Policy Configuration
          </h2>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
            onClick={startAddPolicy}
            disabled={!!editingPolicy}
          >
            <Plus className="w-3 h-3 mr-1" /> New Policy
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {editingPolicy && (
            <div className="bg-[#1a1a1a] border border-blue-500/50 rounded-lg p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                <h3 className="font-semibold text-white text-sm">{isAdding ? 'Create New Policy' : 'Edit Policy'}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-gray-400 hover:text-white" onClick={() => { setEditingPolicy(null); setIsAdding(false); }}>
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" className="h-6 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs" onClick={handleSavePolicy}>
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="col-span-2">
                  <label className="block text-gray-400 mb-1">Policy Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none"
                    value={editingPolicy.name}
                    onChange={e => setEditingPolicy({...editingPolicy, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Role</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none font-mono"
                    value={editingPolicy.role}
                    onChange={e => setEditingPolicy({...editingPolicy, role: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Resource / API</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none font-mono"
                    value={editingPolicy.resource}
                    onChange={e => setEditingPolicy({...editingPolicy, resource: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Action</label>
                  <select 
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none"
                    value={editingPolicy.action}
                    onChange={e => setEditingPolicy({...editingPolicy, action: e.target.value as any})}
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                    <option value="HITL_REQUIRED">HITL_REQUIRED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Risk Threshold (0.0 - 1.0)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="1"
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none"
                    value={editingPolicy.riskThreshold}
                    onChange={e => setEditingPolicy({...editingPolicy, riskThreshold: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-400 mb-1">Condition (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none font-mono"
                    value={editingPolicy.condition || ''}
                    placeholder="e.g., payload contains PII"
                    onChange={e => setEditingPolicy({...editingPolicy, condition: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          {policies.map(policy => (
            <div key={policy.id} className={`bg-[#151515] border ${editingPolicy?.id === policy.id ? 'border-blue-500/50' : 'border-white/10'} rounded-lg p-4 shadow-sm hover:border-white/20 transition-colors`}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-white text-sm">{policy.name}</h3>
                <Badge variant={policy.action === 'ALLOW' ? 'success' : policy.action === 'DENY' ? 'destructive' : 'warning'} className="text-[10px]">
                  {policy.action}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                <div>
                  <span className="block text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Role</span>
                  <span className="font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{policy.role}</span>
                </div>
                <div>
                  <span className="block text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Resource / API</span>
                  <span className="font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded truncate block">{policy.resource}</span>
                </div>
                {policy.condition && (
                  <div className="col-span-2">
                    <span className="block text-gray-500 mb-1 uppercase tracking-wider text-[10px]">Condition</span>
                    <span className="text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">{policy.condition}</span>
                  </div>
                )}
                <div className="col-span-2 flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-gray-500">Risk Threshold: {policy.riskThreshold.toFixed(2)}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-gray-400 hover:text-blue-400" onClick={() => { setEditingPolicy(policy); setIsAdding(false); }}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-gray-400 hover:text-red-400" onClick={() => handleDeletePolicy(policy.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Playbooks */}
      <Card className="w-96 bg-[#111] border-white/10 p-0 flex flex-col shrink-0 shadow-xl">
        <div className="p-4 border-b border-white/10 bg-[#1a1a1a] flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Automated Playbooks
          </h2>
          <Button size="sm" variant="outline" className="h-8 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {playbooks.map(playbook => (
            <div key={playbook.id} className={`border rounded-lg p-4 shadow-sm transition-colors ${playbook.status === 'active' ? 'bg-[#151515] border-white/10' : 'bg-black/40 border-white/5 opacity-60'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-white text-sm leading-tight">{playbook.name}</h3>
                <div 
                  className={`w-2 h-2 rounded-full mt-1 cursor-pointer transition-colors ${playbook.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} 
                  onClick={() => setPlaybooks(playbooks.map(p => p.id === playbook.id ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p))}
                  title="Toggle Status"
                />
              </div>
              <div className="space-y-2 text-xs mt-3">
                <div className="bg-black/40 p-2 rounded border border-white/5">
                  <span className="text-gray-500 uppercase tracking-wider text-[10px] block mb-1">Trigger</span>
                  <span className="text-orange-400 font-mono">{playbook.trigger}</span>
                </div>
                <div className="bg-black/40 p-2 rounded border border-white/5">
                  <span className="text-gray-500 uppercase tracking-wider text-[10px] block mb-1">Action</span>
                  <span className="text-blue-400 font-mono">{playbook.action}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-gray-400 hover:text-white">
                  <Settings className="w-3 h-3 mr-1" /> Configure
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
