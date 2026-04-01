import React, { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurityStore } from '../store';
import { Badge, Card } from './ui';
import { cn } from '../lib/utils';
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Search, Info, X, Zap, Shield, Clock } from 'lucide-react';

const columnHelper = createColumnHelper<any>();

export function VirtualAuditLog() {
  const logs = useSecurityStore(state => state.logs);
  const parentRef = useRef<HTMLDivElement>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor('timestamp', {
        header: 'Time',
        cell: info => new Date(info.getValue()).toLocaleTimeString(),
        size: 100,
      }),
      columnHelper.accessor('agentId', {
        header: 'Agent ID',
        cell: info => info.getValue(),
        size: 130,
      }),
      columnHelper.accessor('api', {
        header: 'API Endpoint',
        cell: info => info.getValue(),
        size: 250,
      }),
      columnHelper.accessor('riskScore', {
        header: 'Risk Score',
        cell: info => {
          const score = info.getValue();
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full", score > 0.8 ? "bg-red-500" : score > 0.4 ? "bg-yellow-500" : "bg-green-500")} 
                  style={{ width: `${score * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{(score * 100).toFixed(0)}%</span>
            </div>
          );
        },
        size: 130,
      }),
      columnHelper.accessor('decision', {
        header: 'Decision',
        cell: info => {
          const decision = info.getValue() || '';
          return (
            <Badge variant={decision.includes("ALLOW") ? "success" : decision.includes("DENY") ? "destructive" : "warning"}>
              {decision}
            </Badge>
          );
        },
        size: 160,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: logs,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  return (
    <div className="flex-1 flex gap-4 overflow-hidden">
      <Card className="flex-1 flex flex-col overflow-hidden bg-[#111] border-white/10 p-0">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
          <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Real-Time Audit Ledger
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-md pl-9 pr-4 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 w-64 transition-all"
                placeholder="Search logs..."
              />
            </div>
          </div>
        </div>
        
        {/* Header row - outside scrolling container */}
        <div className="flex w-full bg-[#1a1a1a] border-b border-white/10 shadow-sm shrink-0">
          {table.getFlatHeaders().map(header => (
            <div
              key={header.id}
              className="flex items-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-white/5 select-none transition-colors"
              style={{ width: header.getSize() }}
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {{
                asc: <ArrowUp className="w-3 h-3 ml-1 text-blue-400" />,
                desc: <ArrowDown className="w-3 h-3 ml-1 text-blue-400" />,
              }[header.column.getIsSorted() as string] ?? (
                header.column.getCanSort() ? <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" /> : null
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar" ref={parentRef}>
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No logs found.</div>
          ) : (
            <div className="w-full relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {/* Virtualized body */}
              <div className="w-full absolute top-0 left-0">
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const isSelected = selectedLog?.id === row.original.id;
                  return (
                    <div
                      key={row.id}
                      onClick={() => setSelectedLog(row.original)}
                      className={cn(
                        "absolute top-0 left-0 w-full flex items-center border-b border-white/5 cursor-pointer transition-colors",
                        isSelected ? "bg-blue-500/10 border-blue-500/30" : "hover:bg-white/[0.02]"
                      )}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <div
                          key={cell.id}
                          className="px-4 text-xs text-gray-300 truncate font-mono"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="shrink-0"
          >
            <Card className="h-full bg-[#111] border-white/10 p-0 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-[#1a1a1a] flex justify-between items-center">
                <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  XAI Breakdown
                </h2>
                <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Target API</div>
                  <div className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-block">
                    {selectedLog.api}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Risk Assessment</div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className={cn("text-3xl font-light", selectedLog.riskScore > 0.8 ? "text-red-500" : selectedLog.riskScore > 0.4 ? "text-yellow-500" : "text-green-500")}>
                      {(selectedLog.riskScore * 100).toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-500 mb-1">Total Risk</span>
                  </div>
                  <p className="text-xs text-gray-400">{selectedLog.reason}</p>
                </div>

                {selectedLog.xai ? (
                  <div className="space-y-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10 pb-1">Factors</div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Activity className="w-3 h-3 text-purple-400" />
                        Sequence Anomaly
                      </div>
                      <span className="text-xs font-mono text-purple-400">+{(selectedLog.xai.sequenceRisk * 100).toFixed(1)}%</span>
                    </div>
                    <div className="text-[10px] text-gray-500 ml-5">Base transition prob: {(selectedLog.xai.baseProbability * 100).toFixed(2)}%</div>

                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Clock className="w-3 h-3 text-orange-400" />
                        Velocity Penalty
                      </div>
                      <span className="text-xs font-mono text-orange-400">+{(selectedLog.xai.velocityPenalty * 100).toFixed(1)}%</span>
                    </div>
                    <div className="text-[10px] text-gray-500 ml-5">Time since last call: {selectedLog.xai.timeSinceLastCall}ms</div>

                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Shield className="w-3 h-3 text-red-400" />
                        Payload/Context Risk
                      </div>
                      <span className="text-xs font-mono text-red-400">+{(selectedLog.xai.payloadPenalty * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">No XAI telemetry available for this event.</div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
