import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import type { AssetSummary } from '../analytics/overview';

const column = createColumnHelper<AssetSummary>();

interface AssetTableProps {
  rows: AssetSummary[];
  selectedAssetId: string | null;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
}

export function AssetTable({ rows, selectedAssetId, onSelect, onOpen }: AssetTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'utilization', desc: true }]);
  const table = useReactTable({
    data: rows,
    columns: [
      column.accessor((row) => row.asset.code, { id: 'code', header: 'Asset' }),
      column.accessor((row) => row.asset.name, { id: 'name', header: 'Name' }),
      column.accessor((row) => row.asset.location, { id: 'location', header: 'Location' }),
      column.accessor('utilization', { header: 'Utilization', cell: (info) => `${(info.getValue() * 100).toFixed(1)}%` }),
      column.accessor('availability', { header: 'Availability', cell: (info) => `${(info.getValue() * 100).toFixed(1)}%` }),
      column.accessor('coverage', { header: 'Coverage', cell: (info) => `${(info.getValue() * 100).toFixed(1)}%` }),
      column.accessor('output', { header: 'Output', cell: (info) => `${Math.round(info.getValue()).toLocaleString()} u` }),
    ],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} scope="col" aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'}>
                  <button type="button" className="table-sort" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={row.original.asset.id === selectedAssetId ? 'selected-row' : ''}
              onClick={() => onSelect(row.original.asset.id)}
            >
              {row.getVisibleCells().map((cell, index) => (
                <td key={cell.id}>
                  {index === 0 && onOpen ? (
                    <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); onOpen(row.original.asset.id); }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </button>
                  ) : flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
