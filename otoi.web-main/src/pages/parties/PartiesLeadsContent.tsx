import React, { useMemo, useState, useEffect } from "react";
import {
  Person,
  QueryApiResponse,
} from "../parties/blocks/persons/person-models";
import { ModalLead } from "./blocks/persons/ModalLead";
import { ActivityForm } from "./ActivityForm";
import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
} from "@/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type PersonsQueryApiResponse = QueryApiResponse<Person>;

interface IPartiesLeadContentProps {
  refreshStatus: number;
}

interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

/** Status mapping used in the table */
const statusOptions: { [key: string]: string } = {
  "1": "New",
  "2": "In-Progress",
  "3": "Quote-Given",
  "4": "Win",
  "5": "Lose",
};

const PartiesLeadContent = ({ refreshStatus }: IPartiesLeadContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatusQuery, setSearchStatusQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedLeadForActivity, setSelectedLeadForActivity] =
    useState<ActivityLead | null>(null);
  const navigate = useNavigate();

  // Bump the grid when the parent refreshStatus changes
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus]);

  // Trigger a refresh whenever searchStatusQuery changes
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [searchStatusQuery]);

  const ColumnInputFilter = <TData, TValue>({
    column,
  }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState(
      (column.getFilterValue() as string) ?? ""
    );
    useEffect(() => {
      setInputValue((column.getFilterValue() as string) ?? "");
    }, [column]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        column.setFilterValue(inputValue);
      }
    };

    return (
      <Input
        placeholder="Filter..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-9 w-full max-w-40"
      />
    );
  };

  const openPersonModal = (
    event: { preventDefault: () => void },
    rowData: Person | null = null
  ) => {
    event.preventDefault();
    setSelectedPerson(rowData);
    setPersonModalOpen(true);
  };

  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
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
                className="font-medium text-sm text-gray-900 hover:text-primary-active mb-px cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/lead/${info.row.original.uuid}`);
                }}
              >
                {info.row.original.first_name} {info.row.original.last_name}
              </a>
              <a
                className="text-2sm text-gray-700 font-normal hover:text-primary-active cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/lead/${info.row.original.uuid}`);
                }}
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
        cell: (info: any) => info.row.original.gst,
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
        cell: (info: any) => info.row.original.mobile,
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        accessorFn: (row: Person) => row.status,
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        enableSorting: false,
        cell: (info: any) => {
          const value = info.row.original.status?.toString();
          return value ? statusOptions[value] || value : "-";
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Activity" column={column} />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-primary hover:text-primary-active">
                -Select-
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  openPersonModal(e, row.original);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/lead/${row.original.uuid}`);
                }}
              >
                Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedLeadForActivity({
                    id: row.original.uuid,
                    status: row.original.status,
                    address: row.original.address,
                    created_at: row.original.created_at,
                    activity_type: row.original.activity_type,
                  });
                  setActivityModalOpen(true);
                }}
              >
                Create Activity
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        meta: {
          headerClassName: "w-28",
          cellClassName: "text-gray-800 font-medium",
        },
      },
    ],
    [navigate]
  );

  const fetchUsers = async (params: TDataGridRequestParams) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(params.pageIndex + 1));
      queryParams.set("items_per_page", String(params.pageSize));
      if (params.sorting?.[0]?.id) {
        queryParams.set("sort", params.sorting[0].id);
        queryParams.set("order", params.sorting[0].desc ? "desc" : "asc");
      }
      if (searchQuery.trim().length > 0) {
        queryParams.set("query", searchQuery);
      }
      // Send status filter only when not "-1"
      if (searchStatusQuery !== "-1") {
        queryParams.set("status", searchStatusQuery);
      }
      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }
      const response = await axios.get<PersonsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/persons/leads?${queryParams.toString()}`
      );
      return {
        data: response.data.data,
        totalCount: response.data.pagination.total,
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setRefreshKey((prev) => prev + 1);
  };

  const handleStatusSearch = (query: string) => {
    setSearchStatusQuery(query);
  };

  const Toolbar = ({
    defaultSearch,
    setSearch,
    statusValue,
    onStatusChange,
  }: {
    defaultSearch: string;
    setSearch: (query: string) => void;
    statusValue: string;
    onStatusChange: (query: string) => void;
  }) => {
    const [searchInput, setSearchInput] = useState(defaultSearch);
    useEffect(() => {
      setSearchInput(defaultSearch);
    }, [defaultSearch]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        setSearch(searchInput);
      }
    };

    return (
      <div className="card-header flex justify-between flex-wrap gap-2 border-b-0 px-5">
        <div className="flex flex-wrap gap-2 lg:gap-5">
          <div className="flex">
            <label className="input input-sm">
              <KeenIcon icon="magnifier" />
              <input
                type="text"
                placeholder="Search users"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2.5 items-center">
            <label className="select-sm mr-2">Status</label>
            <Select
              value={statusValue}
              onValueChange={(value) => onStatusChange(value)}
            >
              <SelectTrigger className="w-32" size="sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="w-36">
                <SelectItem value="-1">All</SelectItem>
                <SelectItem value="1">New</SelectItem>
                <SelectItem value="2">In-Progress</SelectItem>
                <SelectItem value="3">Quote-Given</SelectItem>
                <SelectItem value="4">Win</SelectItem>
                <SelectItem value="5">Lose</SelectItem>
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
        key={refreshKey}
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
            statusValue={searchStatusQuery}
            onStatusChange={handleStatusSearch}
          />
        }
        layout={{ card: true }}
      />
      <ModalLead
        open={personModalOpen}
        onOpenChange={handleClose}
        person={selectedPerson}
      />
      <ActivityForm
        open={activityModalOpen}
        onOpenChange={() => setActivityModalOpen(false)}
        lead={selectedLeadForActivity}
      />
    </div>
  );
};

export { PartiesLeadContent };
