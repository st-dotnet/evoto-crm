import { useState, useEffect, useCallback } from 'react';
import ApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { getSalesReport, type SalesReport as SalesReportData } from '@/services/dashboard.service';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formatINR = (value: number): string => {
  return `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SalesReport = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const days = period === 'monthly' ? 90 : period === 'weekly' ? 28 : 7;
    const res = await getSalesReport(period, days);
    if (res.success && res.data) {
      setReport(res.data);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchData();

    const handler = () => fetchData();
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, [fetchData]);

  // Build chart data from API response
  const categories = report?.data_points.map((dp) => dp.label) ?? [];
  const seriesData = report?.data_points.map((dp) => dp.value) ?? [];

  const dateRange = report
    ? `${formatDate(report.start_date)} to ${formatDate(report.end_date)}`
    : '';

  const periodLabel =
    period === 'daily'
      ? `Last 7 days sales`
      : period === 'weekly'
        ? `Last 4 weeks sales`
        : `Last 3 months sales`;

  const options: ApexOptions = {
    series: [
      {
        name: 'Sales',
        data: seriesData,
      },
    ],
    chart: {
      height: 280,
      type: 'area',
      toolbar: { show: false },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    stroke: {
      curve: 'smooth',
      show: true,
      width: 3,
      colors: ['#22C55E'],
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: 'var(--tw-gray-500)', fontSize: '12px' },
      },
      crosshairs: {
        position: 'front',
        stroke: { color: '#22C55E', width: 1, dashArray: 3 },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      tickAmount: 5,
      axisTicks: { show: false },
      labels: {
        style: { colors: 'var(--tw-gray-500)', fontSize: '12px' },
        formatter: (value: number) => {
          if (value >= 1000) return `₹ ${(value / 1000).toFixed(0)}K`;
          return `₹ ${value}`;
        },
      },
    },
    tooltip: {
      enabled: true,
      custom: ({ series, seriesIndex, dataPointIndex }: any) => {
        const value = series[seriesIndex][dataPointIndex];
        const formatted = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(value);

        return `
          <div class="flex flex-col gap-1 p-3">
            <div class="font-medium text-2sm text-gray-600">${categories[dataPointIndex]}</div>
            <div class="font-semibold text-md text-gray-900">${formatted}</div>
          </div>
        `;
      },
    },
    markers: {
      size: 0,
      colors: '#dcfce7',
      strokeColors: '#22C55E',
      strokeWidth: 4,
      strokeOpacity: 1,
      hover: { size: 8, sizeOffset: 0 },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100],
        colorStops: [
          { offset: 0, color: '#22C55E', opacity: 0.3 },
          { offset: 100, color: '#22C55E', opacity: 0.02 },
        ],
      },
    },
    grid: {
      borderColor: 'var(--tw-gray-200)',
      strokeDashArray: 5,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
  };

  return (
    <div className={`card h-full transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
      <div className="card-header flex-wrap gap-2">
        <h3 className="card-title">Sales Report{dateRange ? ` - ${dateRange}` : ''}</h3>
      </div>
      <div className="card-body flex flex-col lg:flex-row items-stretch gap-4 px-3 py-1">
        {/* Chart area */}
        <div className="flex-1 min-w-0">
          <ApexChart
            id="sales_report_chart"
            options={options}
            series={options.series}
            type="area"
            height="280"
          />
        </div>

        {/* Summary sidebar */}
        <div className="flex flex-col gap-5 lg:w-[180px] shrink-0 py-4 lg:border-l lg:pl-5 border-gray-200">
          <Select
            defaultValue="daily"
            onValueChange={(val) => setPeriod(val as 'daily' | 'weekly' | 'monthly')}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="w-32">
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-1">
            <span className="text-2sm text-gray-500 text-end">{periodLabel}</span>
            <span className="text-2xl font-bold text-gray-900 text-end">
              {report ? formatINR(report.total_sales) : '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-2sm text-gray-500 text-end">Invoices Made</span>
            <span className="text-2xl font-bold text-gray-900 text-end">
              {report?.invoices_made ?? '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SalesReport };
