import React from 'react';
import { useDataGrid } from '.';
import { Checkbox } from '@/components/ui/checkbox';

const DataGridRowSelectAll = () => {
  const { table } = useDataGrid();

  return (
       <div className="w-full h-full flex items-center justify-center p-0 m-0">
      <div className="flex items-center justify-center w-4 h-4 m-0 p-0">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="m-0 p-0 h-4 w-4"
        />
      </div>
    </div>
  );
};

export { DataGridRowSelectAll };
