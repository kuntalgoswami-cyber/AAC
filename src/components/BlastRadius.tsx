import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card } from './ui';
import { useSecurityStore } from '../store';
import { ShieldAlert, Server, Database, Globe, User, Activity, Network } from 'lucide-react';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: string;
  label: string;
  status: 'safe' | 'warning' | 'compromised';
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
  value: number;
}

export function BlastRadius() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { logs } = useSecurityStore();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // 1. Process logs to build the graph
    // In a real app, this would be a dedicated backend endpoint
    const nodesMap = new Map<string, Node>();
    const linksMap = new Map<string, Link>();

    // Add core agents
    ['agent-007', 'agent-042', 'agent-099'].forEach(agent => {
      nodesMap.set(agent, { id: agent, group: 'agent', label: agent, status: 'safe' });
    });

    // Add resources based on API calls
    const resourceMapping: Record<string, { group: string, label: string }> = {
      'READ_TICKET': { group: 'database', label: 'Zendesk DB' },
      'GET_USER_INFO': { group: 'database', label: 'User Directory' },
      'SUMMARIZE_TEXT': { group: 'service', label: 'LLM Service' },
      'DRAFT_REPLY': { group: 'service', label: 'LLM Service' },
      'SEND_EMAIL': { group: 'external', label: 'SMTP Gateway' },
      'EXPORT_DB': { group: 'database', label: 'Core DB (Sensitive)' },
      'SEND_EXTERNAL_WEBHOOK': { group: 'external', label: 'External Webhook' }
    };

    Object.entries(resourceMapping).forEach(([api, info]) => {
      nodesMap.set(api, { id: api, group: info.group, label: info.label, status: 'safe' });
    });

    // Analyze logs to build connections and determine status
    logs.forEach(log => {
      // Update node status based on risk
      const agentNode = nodesMap.get(log.agentId);
      const resourceNode = nodesMap.get(log.api);

      if (agentNode && resourceNode) {
        if (log.riskScore > 0.8) {
          agentNode.status = 'compromised';
          resourceNode.status = 'compromised';
        } else if (log.riskScore > 0.4 && agentNode.status !== 'compromised') {
          agentNode.status = 'warning';
          if (resourceNode.status !== 'compromised') resourceNode.status = 'warning';
        }

        // Create or update link
        const linkId = `${log.agentId}-${log.api}`;
        const existingLink = linksMap.get(linkId);
        if (existingLink) {
          existingLink.value += 1;
        } else {
          linksMap.set(linkId, { source: log.agentId, target: log.api, value: 1 });
        }
      }
    });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap.values());

    // 2. D3 Visualization Setup
    const width = containerRef.current.clientWidth || 500;
    const height = containerRef.current.clientHeight || 500;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');

    svg.selectAll('*').remove(); // Clear previous render

    // Define gradients and filters
    const defs = svg.append("defs");
    
    // Glow filter for compromised nodes
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(50));

    // Draw links
    const link = svg.append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => {
        const sourceNode = nodesMap.get((d.source as any).id || d.source);
        const targetNode = nodesMap.get((d.target as any).id || d.target);
        if (sourceNode?.status === 'compromised' || targetNode?.status === 'compromised') return '#ef4444'; // red-500
        if (sourceNode?.status === 'warning' || targetNode?.status === 'warning') return '#eab308'; // yellow-500
        return '#334155'; // slate-700
      })
      .attr('stroke-width', d => Math.sqrt(d.value) * 1.5);

    // Draw nodes
    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)
      .on('click', (event, d) => setSelectedNode(d as Node));

    // Node circles
    nodeGroup.append('circle')
      .attr('r', d => d.group === 'agent' ? 24 : 18)
      .attr('fill', d => {
        if (d.status === 'compromised') return '#7f1d1d'; // red-900
        if (d.status === 'warning') return '#713f12'; // yellow-900
        return '#0f172a'; // slate-900
      })
      .attr('stroke', d => {
        if (d.status === 'compromised') return '#ef4444'; // red-500
        if (d.status === 'warning') return '#eab308'; // yellow-500
        if (d.group === 'agent') return '#3b82f6'; // blue-500
        return '#64748b'; // slate-500
      })
      .attr('stroke-width', 2)
      .attr('filter', d => d.status === 'compromised' ? 'url(#glow)' : null);

    // Node Icons (using text as a simple fallback, ideally we'd use SVG paths)
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-family', 'FontAwesome, sans-serif') // Assuming standard icons aren't easily injectable via D3 here without complex SVG manipulation
      .attr('font-size', d => d.group === 'agent' ? '20px' : '16px')
      .attr('fill', d => {
        if (d.status === 'compromised') return '#fca5a5';
        if (d.status === 'warning') return '#fde047';
        return '#94a3b8';
      })
      .text(d => {
        if (d.group === 'agent') return '🤖';
        if (d.group === 'database') return '🗄️';
        if (d.group === 'service') return '⚙️';
        if (d.group === 'external') return '🌐';
        return '📦';
      });

    // Node Labels
    nodeGroup.append('text')
      .attr('y', d => d.group === 'agent' ? 35 : 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', '12px')
      .attr('font-weight', d => d.group === 'agent' ? 'bold' : 'normal')
      .text(d => d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      nodeGroup
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [logs]);

  return (
    <div className="flex h-full gap-6">
      <Card className="flex-1 bg-[#111] border-white/10 p-0 overflow-hidden relative shadow-xl flex flex-col">
        <div className="p-4 border-b border-white/10 bg-[#1a1a1a] flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-400" />
            Agent Blast Radius & Node Graph
          </h2>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Agent</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500"></div> Resource</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Compromised</span>
          </div>
        </div>
        <div className="flex-1 relative" ref={containerRef}>
          <svg ref={svgRef} className="w-full h-full absolute inset-0" />
        </div>
      </Card>

      {/* Node Details Panel */}
      <Card className="w-80 bg-[#111] border-white/10 p-0 flex flex-col shrink-0 shadow-xl">
        <div className="p-4 border-b border-white/10 bg-[#1a1a1a]">
          <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Node Inspector
          </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${
                  selectedNode.status === 'compromised' ? 'bg-red-900/50 border-red-500 text-red-400' :
                  selectedNode.status === 'warning' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400' :
                  'bg-slate-800 border-slate-600 text-slate-300'
                }`}>
                  {selectedNode.group === 'agent' ? '🤖' : selectedNode.group === 'database' ? '🗄️' : selectedNode.group === 'external' ? '🌐' : '⚙️'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedNode.label}</h3>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{selectedNode.group}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ID</span>
                  <span className="text-gray-300 font-mono text-xs">{selectedNode.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-semibold capitalize ${
                    selectedNode.status === 'compromised' ? 'text-red-400' :
                    selectedNode.status === 'warning' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>{selectedNode.status}</span>
                </div>
              </div>

              {selectedNode.group === 'agent' && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h4>
                  <div className="space-y-2">
                    {logs.filter(l => l.agentId === selectedNode.id).slice(0, 5).map(log => (
                      <div key={log.id} className="text-xs bg-black/40 p-2 rounded border border-white/5 flex justify-between items-center">
                        <span className="font-mono text-blue-400 truncate w-32">{log.api}</span>
                        <span className={`${(log.decision || '').includes('DENY') ? 'text-red-400' : (log.decision || '').includes('HITL') ? 'text-yellow-400' : 'text-green-400'}`}>
                          {(log.decision || '').split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm text-center px-4">
              <Network className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a node in the graph to view its details and blast radius impact.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
