import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Flame, Zap, Gauge, ArrowDown, ArrowUp } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { MultiLineChart, yearColor, MultiLineSeries } from '../components/charts/MultiLineChart';
import { supabase } from '../lib/supabase';
import { MONTH_LABELS, EnergyReading } from '../lib/types';
import { formatGBP } from '../lib/format';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - 10 + i);

export function EnergyPage() {
  const { energyReadings, refresh, loading } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EnergyReading | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EnergyReading | null>(null);
  const [form, setForm] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(CURRENT_YEAR),
    gas_cost: '',
    electricity_cost: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // All readings sorted chronologically
  const sorted = useMemo(
    () => [...energyReadings].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month),
    [energyReadings]
  );

  // Unique years present in data, ascending
  const availableYears = useMemo(
    () => [...new Set(sorted.map((r) => r.year))].sort((a, b) => a - b),
    [sorted]
  );

  // Selected year for the table and averages; default = current year if present, else most recent
  const defaultYear = useMemo(() => {
    if (availableYears.includes(CURRENT_YEAR)) return CURRENT_YEAR;
    return availableYears[availableYears.length - 1] ?? CURRENT_YEAR;
  }, [availableYears]);

  const [selectedYear, setSelectedYear] = useState<number>(() => defaultYear);

  // When data loads and defaultYear changes, sync the selected year if not yet in data
  useMemo(() => {
    if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(defaultYear);
    }
  }, [availableYears, defaultYear, selectedYear]);

  // Averages for the SELECTED year
  const yearReadings = useMemo(
    () => sorted.filter((r) => r.year === selectedYear),
    [sorted, selectedYear]
  );

  const avgGas = useMemo(() => {
    const valid = yearReadings.filter((r) => r.gas_cost != null);
    return valid.length > 0 ? valid.reduce((s, r) => s + Number(r.gas_cost), 0) / valid.length : 0;
  }, [yearReadings]);

  const avgElec = useMemo(() => {
    const valid = yearReadings.filter((r) => r.electricity_cost != null);
    return valid.length > 0 ? valid.reduce((s, r) => s + Number(r.electricity_cost), 0) / valid.length : 0;
  }, [yearReadings]);

  // Build multi-line series: one series per year of data
  const gasSeries: MultiLineSeries[] = useMemo(
    () =>
      availableYears.map((year, idx) => ({
        year,
        color: yearColor(idx),
        data: sorted
          .filter((r) => r.year === year && r.gas_cost != null)
          .map((r) => ({ month: r.month, value: Number(r.gas_cost) })),
      })).filter((s) => s.data.length > 0),
    [sorted, availableYears]
  );

  const elecSeries: MultiLineSeries[] = useMemo(
    () =>
      availableYears.map((year, idx) => ({
        year,
        color: yearColor(idx),
        data: sorted
          .filter((r) => r.year === year && r.electricity_cost != null)
          .map((r) => ({ month: r.month, value: Number(r.electricity_cost) })),
      })).filter((s) => s.data.length > 0),
    [sorted, availableYears]
  );

  // Year-on-year comparison: compare selected year's averages with previous year
  const prevYear = selectedYear - 1;
  const prevYearReadings = useMemo(
    () => sorted.filter((r) => r.year === prevYear),
    [sorted, prevYear]
  );

  const prevAvgGas = useMemo(() => {
    const valid = prevYearReadings.filter((r) => r.gas_cost != null);
    return valid.length > 0 ? valid.reduce((s, r) => s + Number(r.gas_cost), 0) / valid.length : null;
  }, [prevYearReadings]);

  const prevAvgElec = useMemo(() => {
    const valid = prevYearReadings.filter((r) => r.electricity_cost != null);
    return valid.length > 0 ? valid.reduce((s, r) => s + Number(r.electricity_cost), 0) / valid.length : null;
  }, [prevYearReadings]);

  const gasDiff = prevAvgGas != null ? avgGas - prevAvgGas : null;
  const elecDiff = prevAvgElec != null ? avgElec - prevAvgElec : null;

  // Monthly data panel rows — all readings, most recent first
  const tableRows = useMemo(
    () => [...sorted].sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month),
    [sorted]
  );

  const openAdd = () => {
    setEditing(null);
    setForm({
      month: String(new Date().getMonth() + 1),
      year: String(CURRENT_YEAR),
      gas_cost: '',
      electricity_cost: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (r: EnergyReading) => {
    setEditing(r);
    setForm({
      month: String(r.month),
      year: String(r.year),
      gas_cost: r.gas_cost != null ? String(r.gas_cost) : '',
      electricity_cost: r.electricity_cost != null ? String(r.electricity_cost) : '',
      notes: r.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const newYear = parseInt(form.year);
    const payload = {
      month: parseInt(form.month),
      year: newYear,
      gas_cost: form.gas_cost ? parseFloat(form.gas_cost) : null,
      electricity_cost: form.electricity_cost ? parseFloat(form.electricity_cost) : null,
      notes: form.notes,
    };
    if (editing) {
      await supabase.from('energy_readings').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('energy_readings').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    setSelectedYear(newYear);
    refresh();
  };

  const del = async () => {
    if (!confirmDelete) return;
    await supabase.from('energy_readings').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    refresh();
  };

  if (loading) return null;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Energy Costs</h1>
          <p className="text-sm text-ink-400 mt-0.5">Track monthly gas and electricity bills</p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus size={16} /> Add entry</Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Gauge size={40} />}
            title="No energy entries yet"
            message="Add your monthly gas and electricity costs to track bills over time."
            action={<Button onClick={openAdd} size="sm"><Plus size={16} /> Add your first entry</Button>}
          />
        </Card>
      ) : (
        <>
          {/* 1. Average cards with year-on-year comparison (for selected year) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100 dark:bg-orange-950/30">
                  <Flame size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Avg Gas / month</p>
                  <p className="text-[10px] text-ink-400">{selectedYear}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xl font-bold text-ink-900 dark:text-ink-50">{formatGBP(avgGas)}</p>
                {gasDiff != null && (
                  <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                    {gasDiff <= 0 ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5 font-medium"><ArrowDown size={14} />{formatGBP(Math.abs(gasDiff))} <span className="text-ink-400 font-normal">vs {prevYear}</span></span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-0.5 font-medium"><ArrowUp size={14} />{formatGBP(gasDiff)} <span className="text-ink-400 font-normal">vs {prevYear}</span></span>
                    )}
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-100 dark:bg-brand-950/30">
                  <Zap size={16} className="text-brand-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Avg Electricity / month</p>
                  <p className="text-[10px] text-ink-400">{selectedYear}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xl font-bold text-ink-900 dark:text-ink-50">{formatGBP(avgElec)}</p>
                {elecDiff != null && (
                  <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                    {elecDiff <= 0 ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5 font-medium"><ArrowDown size={14} />{formatGBP(Math.abs(elecDiff))} <span className="text-ink-400 font-normal">vs {prevYear}</span></span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-0.5 font-medium"><ArrowUp size={14} />{formatGBP(elecDiff)} <span className="text-ink-400 font-normal">vs {prevYear}</span></span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 2. Year filter */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-ink-400 shrink-0">Filter year:</span>
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedYear === y
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* 3. Gas multi-year graph */}
          {gasSeries.length > 0 && (
            <Card>
              <CardHeader
                title="Gas Cost by Month"
                icon={<Flame size={16} className="text-orange-500" />}
                subtitle={gasSeries.length > 1 ? `${gasSeries.length} years compared` : String(gasSeries[0]?.year)}
              />
              <div className="px-4 pb-5">
                <MultiLineChart
                  series={gasSeries}
                  formatValue={(v) => formatGBP(v)}
                  height={230}
                />
              </div>
            </Card>
          )}

          {/* 4. Electricity multi-year graph */}
          {elecSeries.length > 0 && (
            <Card>
              <CardHeader
                title="Electricity Cost by Month"
                icon={<Zap size={16} className="text-brand-500" />}
                subtitle={elecSeries.length > 1 ? `${elecSeries.length} years compared` : String(elecSeries[0]?.year)}
              />
              <div className="px-4 pb-5">
                <MultiLineChart
                  series={elecSeries}
                  formatValue={(v) => formatGBP(v)}
                  height={230}
                />
              </div>
            </Card>
          )}

          {/* 5. Monthly data table — all readings, most recent first */}
          <Card>
            <div className="p-5 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">
                  Monthly Data
                </h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  {tableRows.length} {tableRows.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
            </div>
            {tableRows.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-400">
                No entries yet. Add an entry to start tracking.
              </p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto overscroll-contain overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-ink-900 z-10">
                    <tr className="border-b border-ink-100 dark:border-ink-800 text-xs text-ink-400">
                      <th className="text-left font-medium px-5 py-2">Month</th>
                      <th className="text-right font-medium px-3 py-2">Gas Cost</th>
                      <th className="text-right font-medium px-3 py-2">Electricity Cost</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-b border-ink-50 dark:border-ink-850 hover:bg-ink-50 dark:hover:bg-ink-850/50 transition-colors ${i % 2 === 1 ? 'bg-ink-50/50 dark:bg-ink-850/30' : ''}`}
                      >
                        <td className="px-5 py-3 font-medium text-ink-900 dark:text-ink-50">
                          {MONTH_LABELS[r.month - 1]} {r.year}
                        </td>
                        <td className="text-right px-3 py-3 text-ink-700 dark:text-ink-200">
                          {r.gas_cost != null ? formatGBP(Number(r.gas_cost)) : '—'}
                        </td>
                        <td className="text-right px-3 py-3 text-ink-700 dark:text-ink-200">
                          {r.electricity_cost != null ? formatGBP(Number(r.electricity_cost)) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(r)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-ink-400 hover:text-red-500 transition-colors ml-1"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit energy entry' : 'Add energy entry'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add entry'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Month"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
            >
              {MONTH_LABELS.map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </Select>
            <Select
              label="Year"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </Select>
          </div>
          <Input
            label="Gas cost"
            type="number"
            inputMode="decimal"
            prefix="£"
            value={form.gas_cost}
            onChange={(e) => setForm({ ...form, gas_cost: e.target.value })}
            placeholder="e.g. 85.00"
          />
          <Input
            label="Electricity cost"
            type="number"
            inputMode="decimal"
            prefix="£"
            value={form.electricity_cost}
            onChange={(e) => setForm({ ...form, electricity_cost: e.target.value })}
            placeholder="e.g. 45.00"
          />
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. Winter rate"
          />
        </div>
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete entry?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={del}>Delete</Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Delete energy entry for{' '}
          <strong>
            {confirmDelete ? MONTH_LABELS[confirmDelete.month - 1] : ''} {confirmDelete?.year}
          </strong>?
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
