import { Fragment, useState } from 'react';
import ApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { useLanguage } from '@/i18n';
import { KeenIcon, Menu, MenuItem, MenuToggle } from '@/components';
import { DropdownCard2 } from '@/partials/dropdowns/general';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const EarningsChart = () => {
  const { isRTL } = useLanguage();

  // Monthly sales data (in thousands) — replace with API data when ready
  const [period, setPeriod] = useState('12');
  const allData: number[] = [44, 55, 41, 67, 22, 43, 85, 65, 50, 70, 40, 90];
  const categories: string[] = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Slice data based on selected period
  const monthCount = parseInt(period);
  const data = allData.slice(0, monthCount);
  const cats = categories.slice(0, monthCount);

  const options: ApexOptions = {
    series: [
      {
        name: 'Sales',
        data: data
      }
    ],
    chart: {
      height: 250,
      type: 'area',
      toolbar: {
        show: false
      }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    },
    stroke: {
      curve: 'smooth',
      show: true,
      width: 3,
      colors: ['var(--tw-primary)']
    },
    xaxis: {
      categories: cats,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: 'var(--tw-gray-500)',
          fontSize: '12px'
        }
      },
      crosshairs: {
        position: 'front',
        stroke: {
          color: 'var(--tw-primary)',
          width: 1,
          dashArray: 3
        }
      },
      tooltip: {
        enabled: false,
        formatter: undefined,
        offsetY: 0,
        style: {
          fontSize: '12px'
        }
      }
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 5,
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: 'var(--tw-gray-500)',
          fontSize: '12px'
        },
        formatter: (defaultValue: number) => `$${defaultValue}K`
      }
    },
    tooltip: {
      enabled: true,
      custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
        const number = parseInt(series[seriesIndex][dataPointIndex]) * 1000;
        const month = w.globals.seriesX[seriesIndex][dataPointIndex];
        const monthName = cats[month];

        const formatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        });

        const formattedNumber = formatter.format(number);

        return `
          <div class="flex flex-col gap-2 p-3.5">
            <div class="font-medium text-2sm text-gray-600">${monthName}, 2025 Sales</div>
            <div class="flex items-center gap-1.5">
              <div class="font-semibold text-md text-gray-900">${formattedNumber}</div>
              <span class="badge badge-outline badge-success badge-xs">+24%</span>
            </div>
          </div>
        `;
      }
    },
    markers: {
      size: 0,
      colors: 'var(--tw-primary-light)',
      strokeColors: 'var(--tw-primary)',
      strokeWidth: 4,
      strokeOpacity: 1,
      strokeDashArray: 0,
      fillOpacity: 1,
      shape: 'circle',
      showNullDataPoints: true,
      hover: {
        size: 8,
        sizeOffset: 0
      },
      discrete: [],
      offsetX: 0,
      offsetY: 0
    },
    fill: {
      gradient: {
        opacityFrom: 0.25,
        opacityTo: 0
      }
    },
    grid: {
      borderColor: 'var(--tw-gray-200)',
      strokeDashArray: 5,
      yaxis: {
        lines: {
          show: true
        }
      },
      xaxis: {
        lines: {
          show: false
        }
      }
    }
  };

  return (
    <div className="card h-full">
      <div className="card-header flex-wrap gap-2">
        <h3 className="card-title">Earnings</h3>

        <div className="flex items-center flex-wrap gap-2 sm:gap-5">
          <Select defaultValue="12" onValueChange={(val) => setPeriod(val)}>
            <SelectTrigger className="w-28" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="w-32">
              <SelectItem value="1">1 month</SelectItem>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
            </SelectContent>
          </Select>

          <Menu>
            <MenuItem
              toggle="dropdown"
              trigger="click"
              dropdownProps={{
                placement: isRTL() ? 'bottom-start' : 'bottom-end',
                modifiers: [
                  {
                    name: 'offset',
                    options: {
                      offset: isRTL() ? [0, -10] : [0, 10]
                    }
                  }
                ]
              }}
            >
              <MenuToggle className="btn btn-sm btn-icon btn-light btn-clear">
                <KeenIcon icon="dots-vertical" />
              </MenuToggle>
              {DropdownCard2()}
            </MenuItem>
          </Menu>
        </div>
      </div>
      <div className="card-body flex flex-col justify-end items-stretch grow px-3 py-1">
        <ApexChart
          id="earnings_chart"
          options={options}
          series={options.series}
          type="area"
          max-width="694"
          height="250"
        />
      </div>
    </div>
  );
};

export { EarningsChart };
