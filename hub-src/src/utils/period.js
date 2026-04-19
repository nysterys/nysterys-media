import { fmtMonth } from './format';

export function lastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentQuarterStart() {
  const now = new Date();
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

function lastQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const sy = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const sm = q === 0 ? 9 : (q - 1) * 3;
  return {
    start: new Date(sy, sm, 1).toISOString().slice(0, 10),
    end:   new Date(sy, sm + 3, 0).toISOString().slice(0, 10),
  };
}

export function inPeriod(dateStr, period) {
  if (period === 'all') return true;
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (period === 'ytd')      return d >= `${new Date().getFullYear()}-01-01`;
  if (period === 'lastyear') return d.startsWith(String(new Date().getFullYear() - 1));
  if (period === 'qtd')      return d >= currentQuarterStart().toISOString().slice(0, 10);
  if (period === 'lastq')    { const { start, end } = lastQuarterRange(); return d >= start && d <= end; }
  return d.startsWith(period);
}

export function buildPeriodOptions(months) {
  return [
    { value: 'all',      label: 'All time' },
    { value: 'ytd',      label: 'Year to date' },
    { value: 'qtd',      label: 'Quarter to date' },
    { value: 'lastq',    label: 'Last quarter' },
    { value: 'lastyear', label: 'Last year' },
    ...months.map(m => ({ value: m, label: fmtMonth(m) })),
  ];
}

export function PeriodSelect({ period, onChange, months, style }) {
  return (
    <select
      className="form-select"
      style={{ width: 'auto', padding: '5px 10px', fontSize: 12, ...style }}
      value={period}
      onChange={e => onChange(e.target.value)}
    >
      {buildPeriodOptions(months).map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
