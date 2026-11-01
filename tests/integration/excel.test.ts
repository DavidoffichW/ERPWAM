// @vitest-environment jsdom

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { WorkbookState } from '../../src/contracts';
import {
  confirmMappings,
  createDatasetFromTable,
  createSyntheticFacilitiesDataset,
  stampDatasetRevisions,
  validateDataset,
} from '../../src/core';
import {
  WorkbookImportError,
  preflightWorkbookPackage,
  preparePlanningWorkbook,
  readPlanningWorkbook,
} from '../../src/web/adapters/excel';

async function workbookFixture(): Promise<WorkbookState> {
  const first = await stampDatasetRevisions(validateDataset(confirmMappings(createSyntheticFacilitiesDataset())));
  const second = await stampDatasetRevisions(validateDataset(confirmMappings(createDatasetFromTable({
    sourceName: 'round-trip.xlsx',
    sourceIdentity: 'sha256:round-trip-source',
    sheetName: 'Additional Plan',
    synthetic: false,
    headers: ['Planned Job ID', 'Status', 'Unknown source field', 'Formula-like text'],
    rows: [
      ['SECOND-1', 'Ready', { value: 'preserve me', type: 'hyperlink', hyperlink: 'https://example.test/evidence' }, '=1+1'],
      ['SECOND-2', 'Proposed', null, '+SUM(1,2)'],
    ],
  }))));
  return {
    sourceName: 'round-trip.xlsx',
    sourceIdentity: 'sha256:round-trip-source',
    sheets: [first, second],
    activeSheetIndex: 1,
  };
}

function rewriteZip(bytes: Uint8Array, mutate: (files: Record<string, Uint8Array>) => void): Uint8Array {
  const files = unzipSync(bytes);
  mutate(files);
  return zipSync(files, { level: 6 });
}

function replaceXml(files: Record<string, Uint8Array>, path: string, update: (xml: string) => string): void {
  const source = files[path];
  if (!source) throw new Error(`Missing fixture member ${path}.`);
  files[path] = strToU8(update(strFromU8(source)));
}

describe('planning workbook interoperability', () => {
  it('round-trips multiple sheets, source order, unknown columns, revisions, and formula-like text', async () => {
    const source = await workbookFixture();
    const exported = await preparePlanningWorkbook(source);
    const restored = await readPlanningWorkbook(exported.bytes, 'edited-round-trip.xlsx');

    expect(restored.sheets).toHaveLength(2);
    expect(restored.activeSheetIndex).toBe(1);
    expect(restored.sheets.map((sheet) => sheet.sheetName)).toEqual(source.sheets.map((sheet) => sheet.sheetName));
    expect(restored.sheets[1].columns.map((column) => column.originalHeader)).toEqual([
      'Planned Job ID', 'Status', 'Unknown source field', 'Formula-like text',
    ]);
    expect(restored.sheets[1].rows[0].cells[restored.sheets[1].columns[2].id].currentRaw).toBe('preserve me');
    expect(restored.sheets[1].rows[0].cells[restored.sheets[1].columns[2].id].hyperlink).toBe('https://example.test/evidence');
    expect(restored.sheets[1].rows[0].cells[restored.sheets[1].columns[3].id].currentRaw).toBe('=1+1');
    expect(restored.sheets[1].snapshotRevision).toBe(exported.workbook.sheets[1].snapshotRevision);
  });

  it('exports formula-like values as inert strings without changing their canonical values', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const files = unzipSync(exported.bytes);
    const worksheetXml = Object.entries(files)
      .filter(([path]) => path.startsWith('xl/worksheets/') && path.endsWith('.xml'))
      .map(([, bytes]) => strFromU8(bytes))
      .join('\n');

    expect(worksheetXml).not.toContain('<f>');
    const restored = await readPlanningWorkbook(exported.bytes, 'safe.xlsx');
    const formulaColumn = restored.sheets[1].columns.find((column) => column.originalHeader === 'Formula-like text')!;
    expect(restored.sheets[1].rows.map((row) => row.cells[formulaColumn.id].currentRaw)).toEqual(['=1+1', '+SUM(1,2)']);
  });

  it('preserves a source formula only as inert provenance and never emits executable formula markup', async () => {
    const dataset = await stampDatasetRevisions(validateDataset(confirmMappings(createDatasetFromTable({
      sourceName: 'formula-source.xlsx',
      sourceIdentity: 'sha256:formula-source',
      sheetName: 'Formula source',
      synthetic: false,
      headers: ['Planned Job ID', 'Calculated value'],
      rows: [['FORMULA-1', { value: 2, type: 'formula', formula: '1+1' }]],
    }))));
    const exported = await preparePlanningWorkbook({
      sourceName: 'formula-source.xlsx',
      sourceIdentity: dataset.sourceIdentity,
      sheets: [dataset],
      activeSheetIndex: 0,
    });
    const worksheetXml = Object.entries(unzipSync(exported.bytes))
      .filter(([path]) => path.startsWith('xl/worksheets/') && path.endsWith('.xml'))
      .map(([, bytes]) => strFromU8(bytes))
      .join('\n');
    const restored = await readPlanningWorkbook(exported.bytes, 'formula-round-trip.xlsx');
    const valueColumn = restored.sheets[0].columns[1];
    const cell = restored.sheets[0].rows[0].cells[valueColumn.id];

    expect(worksheetXml).not.toContain('<f>');
    expect(cell.currentRaw).toBe(2);
    expect(cell.formula).toBe('1+1');
    expect(restored.sheets[0].issues.some((issue) => issue.code === 'INERT_FORMULA')).toBe(true);
  });

  it('reconciles an externally edited scalar while preserving its original value and provenance', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const changed = rewriteZip(exported.bytes, (files) => {
      const entry = Object.entries(files).find(([, value]) => strFromU8(value).includes('SECOND-1'));
      if (!entry) throw new Error('Fixture source value was not found.');
      const [path, value] = entry;
      files[path] = strToU8(strFromU8(value).replace('SECOND-1', 'SECOND-1-EDITED'));
    });
    const restored = await readPlanningWorkbook(changed, 'externally-edited.xlsx');
    const grain = restored.sheets[1].grainColumnId!;
    const cell = restored.sheets[1].rows[0].cells[grain];

    expect(cell.originalRaw).toBe('SECOND-1');
    expect(cell.currentRaw).toBe('SECOND-1-EDITED');
    expect(cell.modified).toBe(true);
    expect(cell.originalProvenance.kind).toBe('IMPORTED');
    expect(cell.provenance.kind).toBe('EXTERNAL_IMPORTED');
  });

  it('rejects formula changes in an identity-bearing exported workbook', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const changed = rewriteZip(exported.bytes, (files) => {
      replaceXml(files, 'xl/worksheets/sheet1.xml', (xml) => {
        const replaced = xml.replace(/<c r="B3"[^>]*>[\s\S]*?<\/c>/, '<c r="B3"><f>1+1</f><v>2</v></c>');
        if (replaced === xml) throw new Error('Fixture cell B3 was not found.');
        return replaced;
      });
    });
    await expect(readPlanningWorkbook(changed, 'formula-edit.xlsx')).rejects.toThrow(/unsupported formula change/i);
  });

  it('rejects hidden planning worksheets instead of silently dropping data', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const changed = rewriteZip(exported.bytes, (files) => {
      replaceXml(files, 'xl/workbook.xml', (xml) => {
        const replaced = xml.replace(/<sheet\b([^>]*)>/g, (tag, attributes: string) => {
          if (!attributes.includes('name="Facilities Plan"')) return tag;
          const cleaned = attributes.replace(/\sstate="[^"]*"/, '').replace(/\/\s*$/, '');
          return `<sheet${cleaned} state="hidden"/>`;
        });
        if (replaced === xml) throw new Error('Fixture worksheet was not found.');
        return replaced;
      });
    });
    await expect(readPlanningWorkbook(changed, 'hidden.xlsx')).rejects.toThrow(/hidden worksheet/i);
  });

  it('rejects unsafe ZIP paths and unsupported file formats before parsing content', async () => {
    const unsafe = zipSync({ '../escape.xml': strToU8('<x/>') });
    expect(() => preflightWorkbookPackage(unsafe)).toThrow(WorkbookImportError);
    await expect(readPlanningWorkbook(new Uint8Array([1, 2, 3]), 'legacy.xls')).rejects.toThrow(/\.xlsx workbook/i);
  });

  it('enforces compressed and declared-expanded workbook limits before parsing worksheets', async () => {
    await expect(readPlanningWorkbook(new Uint8Array((10 * 1024 * 1024) + 1), 'oversized.xlsx'))
      .rejects.toThrow(/between 1 byte and 10 MB/i);

    const packageBytes = zipSync({ 'xl/workbook.xml': strToU8('<workbook/>') });
    const oversizedDeclaration = packageBytes.slice();
    const view = new DataView(oversizedDeclaration.buffer, oversizedDeclaration.byteOffset, oversizedDeclaration.byteLength);
    let centralOffset = -1;
    for (let index = 0; index <= oversizedDeclaration.byteLength - 4; index += 1) {
      if (view.getUint32(index, true) === 0x02014b50) {
        centralOffset = index;
        break;
      }
    }
    expect(centralOffset).toBeGreaterThanOrEqual(0);
    view.setUint32(centralOffset + 24, (64 * 1024 * 1024) + 1, true);
    expect(() => preflightWorkbookPackage(oversizedDeclaration)).toThrow(/expands beyond the safe processing limit/i);
  });

  it('warns about external-link package content without resolving it', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const changed = rewriteZip(exported.bytes, (files) => {
      files['xl/externalLinks/externalLink1.xml'] = strToU8('<externalLink/>');
    });
    const restored = await readPlanningWorkbook(changed, 'external-link.xlsx');
    expect(restored.sheets.every((sheet) => sheet.issues.some((issue) => issue.code === 'EXTERNAL_LINK_CONTENT'))).toBe(true);
  });

  it('rejects corrupted embedded revision metadata', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const changed = rewriteZip(exported.bytes, (files) => {
      const entry = Object.entries(files).find(([, value]) => strFromU8(value).includes('ERP_PLANNING_WORKBOOK'));
      if (!entry) throw new Error('Metadata fixture member was not found.');
      const [path, value] = entry;
      const source = strFromU8(value);
      const replaced = source.replace(/sha256:[0-9a-f]{64}/, `sha256:${'0'.repeat(64)}`);
      if (replaced === source) throw new Error('Metadata digest was not found.');
      files[path] = strToU8(replaced);
    });
    await expect(readPlanningWorkbook(changed, 'corrupted-metadata.xlsx')).rejects.toThrow(/digest|revision|integrity/i);
  });

  it('rejects duplicate visible worksheet names even when package case differs', async () => {
    const exported = await preparePlanningWorkbook(await workbookFixture());
    const changed = rewriteZip(exported.bytes, (files) => {
      replaceXml(files, 'xl/workbook.xml', (xml) => xml.replace('name="Additional Plan"', 'name="Facilities Plan"'));
    });
    await expect(readPlanningWorkbook(changed, 'duplicate-sheets.xlsx')).rejects.toThrow(/duplicate worksheet name/i);
  });
});
