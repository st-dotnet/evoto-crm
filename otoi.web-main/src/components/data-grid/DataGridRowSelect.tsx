import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Row } from '@tanstack/react-table';

export interface IDataGridRowSelectProps<TData> {
  row: Row<TData>;
}

const DataGridRowSelect = <TData,>({ row }: IDataGridRowSelectProps<TData>) => {
  return (
    <div className="w-full h-full flex items-center justify-center p-0 m-0">
      <div className="flex items-center justify-center w-4 h-4 m-0 p-0">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="m-0 p-0 h-4 w-4"
        />
      </div>
    </div>

  );
};

export { DataGridRowSelect };
