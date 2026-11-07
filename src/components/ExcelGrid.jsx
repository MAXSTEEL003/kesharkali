// src/components/ExcelGrid.jsx
// Production Excel-Style Data Grid with Keyboard Navigation & Multi-Row Paste

import React, { useState, useEffect, useRef } from 'react';
import { Check, Edit2, ArrowUpDown, Copy, Clipboard, Download, Printer } from 'lucide-react';

export default function ExcelGrid({
  columns,
  data,
  onCellChange,
  onBulkPaste,
  onRowClick,
  onDeleteRow,
  rowKey = 'id'
}) {
  const [selectedCell, setSelectedCell] = useState({ rowIndex: 0, colIndex: 0 });
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colIndex, value }
  const [savedRowId, setSavedRowId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const tableRef = useRef(null);
  const inputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Handle global keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!tableRef.current) return;
      // Do not intercept if actively typing in modal or other input outside grid
      if (editingCell) {
        if (e.key === 'Enter') {
          commitEdit();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          setEditingCell(null);
          e.preventDefault();
        } else if (e.key === 'Tab') {
          commitEdit();
          moveSelection(0, e.shiftKey ? -1 : 1);
          e.preventDefault();
        }
        return;
      }

      const maxRow = data.length - 1;
      const editableCols = columns.length - 1;

      switch (e.key) {
        case 'ArrowUp':
          moveSelection(-1, 0);
          e.preventDefault();
          break;
        case 'ArrowDown':
          moveSelection(1, 0);
          e.preventDefault();
          break;
        case 'ArrowLeft':
          moveSelection(0, -1);
          e.preventDefault();
          break;
        case 'ArrowRight':
          moveSelection(0, 1);
          e.preventDefault();
          break;
        case 'Tab':
          moveSelection(0, e.shiftKey ? -1 : 1);
          e.preventDefault();
          break;
        case 'Enter':
          startEditing(selectedCell.rowIndex, selectedCell.colIndex);
          e.preventDefault();
          break;
        default:
          // If printable character typed, immediately start editing
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const col = columns[selectedCell.colIndex];
            if (col?.editable) {
              startEditing(selectedCell.rowIndex, selectedCell.colIndex, e.key);
              e.preventDefault();
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, data, columns]);

  const moveSelection = (rowDelta, colDelta) => {
    setSelectedCell((prev) => {
      const newRow = Math.max(0, Math.min(data.length - 1, prev.rowIndex + rowDelta));
      const newCol = Math.max(0, Math.min(columns.length - 1, prev.colIndex + colDelta));
      return { rowIndex: newRow, colIndex: newCol };
    });
  };

  const startEditing = (rowIndex, colIndex, initialChar = null) => {
    const col = columns[colIndex];
    if (!col || !col.editable) return;
    const row = data[rowIndex];
    if (!row) return;

    setEditingCell({
      rowIndex,
      colIndex,
      rowId: row[rowKey],
      key: col.key,
      value: initialChar !== null ? initialChar : (row[col.key] ?? '')
    });
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const { rowIndex, colIndex, rowId, key, value } = editingCell;
    const originalValue = data[rowIndex]?.[key];

    if (value !== originalValue && onCellChange) {
      await onCellChange(rowId, key, value, data[rowIndex]);
      setSavedRowId(rowId);
      setTimeout(() => setSavedRowId(null), 2000);
    }

    setEditingCell(null);
  };

  // Multi-row Excel clipboard paste handling
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (!text || !text.includes('\t') && !text.includes('\n')) return;

    e.preventDefault();
    const rows = text.trim().split(/\r\n|\n|\r/).map(r => r.split('\t'));
    if (onBulkPaste) {
      onBulkPaste(rows, selectedCell.rowIndex, selectedCell.colIndex);
    }
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const compare = valA > valB ? 1 : -1;
      return sortConfig.direction === 'asc' ? compare : -compare;
    });
  }, [data, sortConfig]);

  return (
    <div 
      className="relative overflow-hidden rounded-lg border border-[#E8E2DC] bg-white shadow-xs"
      onPaste={handlePaste}
      tabIndex={0}
      ref={tableRef}
    >
      <div className="overflow-x-auto max-h-[640px] focus:outline-none">
        <table className="excel-grid">
          <thead>
            <tr>
              <th className="w-10 text-center font-mono text-[10px]">#</th>
              {columns.map((col, cIdx) => (
                <th
                  key={col.key || cIdx}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none hover:bg-[#781212] transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>{col.label}</span>
                    <ArrowUpDown size={12} className="opacity-60" />
                  </div>
                </th>
              ))}
              <th className="w-14 text-center">Save</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-8 text-[#777777]">
                  No operational records found. Add or filter entries.
                </td>
              </tr>
            ) : (
              sortedData.map((row, rIdx) => {
                const isRowSelected = selectedCell.rowIndex === rIdx;
                const isSaved = savedRowId === row[rowKey];

                return (
                  <tr 
                    key={row[rowKey] || rIdx}
                    className={`transition-colors ${isRowSelected ? 'bg-amber-50/40' : rIdx % 2 === 1 ? 'bg-[#FAF9F6]' : 'bg-white'}`}
                  >
                    <td className="text-center font-mono text-[11px] text-[#777777] bg-[#F4EFEB] select-none">
                      {rIdx + 1}
                    </td>

                    {columns.map((col, cIdx) => {
                      const isSelected = selectedCell.rowIndex === rIdx && selectedCell.colIndex === cIdx;
                      const isEditing = editingCell?.rowIndex === rIdx && editingCell?.colIndex === cIdx;
                      const val = row[col.key];

                      return (
                        <td
                          key={col.key || cIdx}
                          onClick={() => {
                            setSelectedCell({ rowIndex: rIdx, colIndex: cIdx });
                            if (col.editable && !isEditing) {
                              startEditing(rIdx, cIdx);
                            }
                          }}
                          className={`${isSelected ? 'selected' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={editingCell.value}
                              onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                              onBlur={commitEdit}
                              className="w-full bg-transparent border-0 p-0 text-sm focus:ring-0 focus:outline-none"
                            />
                          ) : col.render ? (
                            col.render(val, row)
                          ) : (
                            <span className={col.editable ? 'cursor-text hover:underline decoration-dashed decoration-[#C69A3B]' : ''}>
                              {val ?? '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td className="text-center">
                      {isSaved ? (
                        <span className="inline-flex items-center text-emerald-600 font-semibold text-xs">
                          <Check size={14} className="animate-bounce" />
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">•</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Grid Status Footer with Shortcuts Guide */}
      <div className="bg-[#FAF9F6] border-t border-[#E8E2DC] px-4 py-2 flex flex-wrap items-center justify-between text-xs text-[#777777]">
        <div className="flex items-center gap-4">
          <span>Rows: <strong className="text-[#252525]">{data.length}</strong></span>
          <span className="hidden md:inline">Cell: <strong className="text-[#252525]">R{selectedCell.rowIndex + 1}:C{selectedCell.colIndex + 1}</strong></span>
          <span className="hidden lg:flex items-center gap-1.5 text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] shadow-xs">↑↓←→</kbd> Navigate
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] shadow-xs">Enter</kbd> Edit
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] shadow-xs">Ctrl+V</kbd> Excel Paste
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#C69A3B] font-medium">Auto-save Enabled</span>
        </div>
      </div>
    </div>
  );
}
