import React, { useMemo, useState, useEffect } from "react";
import {
  Person,
  QueryApiResponse,
} from "../parties/blocks/persons/person-models";

import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
} from "@/components";
import { ColumnDef, Column, RowSelectionState } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import axios from "axios";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type PersonsQueryApiResponse = QueryApiResponse<Person>;

interface IPartiesLeadContentProps {
  refreshStatus: number;
}

const PartiesLeadContent = ({
  refreshStatus,
}: IPartiesLeadContentProps) => {

  const [searchQuery, setSearchQuery] = useState("");
  const [searchPersonTypeQuery, setPersonTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0); // Unique key to trigger DataGrid reload

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus]);

  const ColumnInputFilter = <TData, TValue>({
    column,
  }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState(
      (column.getFilterValue() as string) ?? ""
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        console.log("Enter pressed for search");
        column.setFilterValue(inputValue); // Apply the filter only on Enter
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value); // Update local state
    };

    return (
      <Input
        placeholder="Filter..."
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown} // Trigger filter on Enter key
        className="h-9 w-full max-w-40"
      />
    );
  };

  const columns = useMemo<ColumnDef<Person>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => <DataGridRowSelectAll />,
        cell: ({ row }) => <DataGridRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: "w-0",
        },
      },
      {
        accessorFn: (row) => row.first_name,
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Name"
            filter={<ColumnInputFilter column={column} />}
            column={column}
          />
        ),
        enableSorting: true,
        cell: (info: any) => (
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <a
                className="font-medium text-sm text-gray-900 hover:text-primary-active mb-px"
                href="#"
              >
                {info.row.original.first_name} {info.row.original.last_name}
              </a>
              <a
                className="text-2sm text-gray-700 font-normal hover:text-primary-active"
                href="#"
              >
                {info.row.original.email}
              </a>
            </div>
          </div>
        ),
        meta: {
          headerClassName: "min-w-[300px]",
        },
      },
      {
        accessorFn: (row: Person) => row.gst,
        id: "gst",
        header: ({ column }) => (
          <DataGridColumnHeader title="GST" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          return info.row.original.gst;
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        accessorFn: (row: Person) => row.mobile,
        id: "mobile",
        header: ({ column }) => (
          <DataGridColumnHeader title="Mobile" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          return info.row.original.mobile;
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        accessorFn: (row: Person) => row.person_type,
        id: "type",
        header: ({ column }) => (
          <DataGridColumnHeader title="Type" column={column} />
        ),
        enableSorting: false,
        cell: (info: any) => {
          return info.row.original.person_type;
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Invoices" column={column} />
        ),
        enableSorting: false,
        cell: () => <button className="btn btn-link">Download</button>,
        meta: {
          headerClassName: "w-28",
          cellClassName: "text-gray-800 font-medium",
        },
      },
    ],
    []
  );
  const fetchUsers = async (params: TDataGridRequestParams) => {
    try {
      const queryParams = new URLSearchParams();

      queryParams.set("page", String(params.pageIndex + 1)); // Page is 1-indexed on server
      queryParams.set("items_per_page", String(params.pageSize));

      if (params.sorting?.[0]?.id) {
        queryParams.set("sort", params.sorting[0].id);
        queryParams.set("order", params.sorting[0].desc ? "desc" : "asc");
      }

      if (searchQuery.trim().length > 0) {
        queryParams.set("query", searchQuery);
      }

      if (searchPersonTypeQuery != "-1") {
        queryParams.set("person_type", searchPersonTypeQuery);
      }

      // Column filters
      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value)); // Properly serialize filter values
          }
        });
      }

      const response = await axios.get<PersonsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/persons/leads?${queryParams.toString()}`,
      );

      return {
        data: response.data.data, // Server response data
        totalCount: response.data.pagination.total, // Total count for pagination
      };
    } catch (error) {
      console.log(error);
      toast(`Connection Error`, {
        description: `An error occurred while fetching data. Please try again later`,
        action: {
          label: "Ok",
          onClick: () => console.log("Ok"),
        },
      });

      return {
        data: [],
        totalCount: 0,
      };
    }
  };

  const handleRowSelection = (state: RowSelectionState) => {
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} are selected.`, {
        description: `Selected row IDs: ${selectedRowIds}`,
        action: {
          label: "Undo",
          onClick: () => console.log("Undo"),
        },
      });
    }
  };

  // Handle search query submission
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setRefreshKey((prev) => prev + 1); // Update the refresh key to force DataGrid reload
  };

  // Handle search query submission
  const handlePersonTypeSearch = (query: string) => {
    setPersonTypeQuery(query);
    setRefreshKey((prev) => prev + 1); // Update the refresh key to force DataGrid reload
    console.log("Handle PersonTypeSearch");
  };

  const Toolbar = ({
    defaultSearch,
    setSearch,
    defaultPersonType,
    setDefaultPersonType,
  }: {
    defaultSearch: string;
    setSearch: (query: string) => void;
    defaultPersonType: string;
    setDefaultPersonType: (query: string) => void;
  }) => {
    const [searchInput, setSearchInput] = useState(defaultSearch);
    const [searchPersonType, setPersonType] = useState(defaultPersonType);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        setSearch(searchInput);
      }
    };
    // Handle onChange event
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(e.target.value); // Update the input value
    };
    const handlePersonTypeChange = (personType: string) => {
      setPersonType(personType);
      console.log("Person Type", searchPersonType);
      setDefaultPersonType(personType);
    };
    return (
      <div className="card-header flex justify-between flex-wrap gap-2 border-b-0 px-5">
        {/* <h3 className="card-title font-medium text-sm"></h3> */}
        <div className="flex flex-wrap gap-2 lg:gap-5">
          <div className="flex">
            <label className="input input-sm">
              <KeenIcon icon="magnifier" />
              <input
                type="text"
                placeholder="Search users"
                value={searchInput}
                onChange={handleChange}
                onKeyDown={handleKeyDown} // Trigger filter on Enter key
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <label className="select-sm"> Person Type </label>
            <Select
              defaultValue=""
              value={searchPersonType}
              onValueChange={(value) => handlePersonTypeChange(value)}
            >
              <SelectTrigger className="w-28" size="sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="w-32">
                <SelectItem value="-1">All</SelectItem>
                <SelectItem value="1">Customer</SelectItem>
                <SelectItem value="2">Vendor</SelectItem>
                <SelectItem value="3">Provider</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="grid gap-5 lg:gap-7.5">
      <DataGrid
        key={refreshKey} // Ensure DataGrid reloads when refreshKey changes
        columns={columns}
        serverSide={true}
        onFetchData={fetchUsers}
        rowSelection={true}
        getRowId={(row: any) => row.id}
        onRowSelectionChange={handleRowSelection}
        pagination={{ size: 5 }}
        toolbar={
          <Toolbar
            defaultSearch={searchQuery}
            setSearch={handleSearch}
            defaultPersonType={searchPersonTypeQuery}
            setDefaultPersonType={handlePersonTypeSearch}
          />
        }
        layout={{ card: true }}
      />
    </div>
  );
};

export { PartiesLeadContent };
