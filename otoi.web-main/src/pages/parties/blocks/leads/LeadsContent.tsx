import React, { useMemo, useState, useEffect } from "react";
import {
  Lead,
  QueryLeadApiResponse,
} from "./lead-models";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreVertical, Settings, Edit, Trash2, Eye, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { ModalLead } from "./ModalLead";
import { useNavigate } from "react-router-dom";
import { ActivityForm } from "./ActivityForm";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type LeadsQueryApiResponse = QueryLeadApiResponse;

interface ILeadsContentProps {
  refreshStatus: number;
}
interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

const LeadsContent = ({ refreshStatus }: ILeadsContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatusTypeQuery, setStatusTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0); // Unique key to trigger DataGrid reload
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedLeadForActivity, setSelectedLeadForActivity] =
    useState<ActivityLead | null>(null);

  const navigate = useNavigate();

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
        column.setFilterValue(inputValue); // Apply the filter only on Enter
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

  const openLeadModal = (
    event: { preventDefault: () => void },
    rowData: Lead | null = null
  ) => {
    event.preventDefault();
    setSelectedLead(rowData);
    setLeadModalOpen(true);
  };

  const handleClose = () => {
    setLeadModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => <DataGridRowSelectAll />,
        cell: ({ row }) => <DataGridRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        meta: { headerClassName: "w-0" },
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
        meta: { headerClassName: "min-w-[300px]" },
      },
      {
        accessorFn: (row: Lead) => row.mobile,
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
        accessorFn: (row: Lead) => row.status,
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => info.row.original.status,
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Actions" column={column} />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-primary hover:text-primary-active">
                <MoreVertical className="h-4 w-4" />
              </button>
              
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  openLeadModal(e, row.original);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/lead/${row.original.uuid}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
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
               <PlusCircle className="mr-2 h-4 w-4" />
                <span>Create Activity</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-red-500">Delete</span>
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
    []
  );

  const fetchLeads = async (params: TDataGridRequestParams) => {
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
      if (searchStatusTypeQuery != "-1") {
        queryParams.set("status_type", searchStatusTypeQuery);
      }

      // Column filters
      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get<LeadsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/leads/?${queryParams.toString()}`
      );

      return {
        data: response.data.data,
        totalCount: response.data.pagination.total,
      };
    } catch (error) {
      console.log(error);
      toast(`Connection Error`, {
        description: `An error occurred while fetching leads. Please try again later`,
        action: { label: "Ok", onClick: () => console.log("Ok") },
      });
      return { data: [], totalCount: 0 };
    }
  };

  const handleRowSelection = (state: RowSelectionState) => {
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} are selected.`, {
        description: `Selected row IDs: ${selectedRowIds}`,
        action: { label: "Undo", onClick: () => console.log("Undo") },
      });
    }
  };

  // search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setRefreshKey((prev) => prev + 1);
  };
  const handleStatusTypeSearch = (query: string) => {
    setStatusTypeQuery(query);
    setRefreshKey((prev) => prev + 1);
  };

  const Toolbar = ({
    defaultSearch,
    setSearch,
    defaultStatusType,
    setDefaultStatusType,
  }: {
    defaultSearch: string;
    setSearch: (query: string) => void;
    defaultStatusType: string;
    setDefaultStatusType: (query: string) => void;
  }) => {
    const [searchInput, setSearchInput] = useState(defaultSearch);
    const [searchStatusType, setStatusType] = useState(defaultStatusType);

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
                placeholder="Search leads"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </label>
          </div>
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2.5">
            <label className="select-sm"> Status Type </label>
            <Select
              defaultValue=""
              value={searchStatusType}
              onValueChange={(value) => {
                setStatusType(value);
                setDefaultStatusType(value);
              }}
            >
              <SelectTrigger className="w-28" size="sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="w-32">
                <SelectItem value="-1">All</SelectItem>
                <SelectItem value="1">New</SelectItem>
                <SelectItem value="2">In Progress</SelectItem>
                <SelectItem value="3">Quote Given</SelectItem>
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
        onFetchData={fetchLeads}
        rowSelection={true}
        getRowId={(row: any) => row.id}
        onRowSelectionChange={handleRowSelection}
        pagination={{ size: 5 }}
        toolbar={
          <Toolbar
            defaultSearch={searchQuery}
            setSearch={handleSearch}
            defaultStatusType={searchStatusTypeQuery}
            setDefaultStatusType={handleStatusTypeSearch}
          />
        }
        layout={{ card: true }}
      />
      <ModalLead
        open={leadModalOpen}
        onOpenChange={handleClose}
        lead={selectedLead}
      />
      <ActivityForm
        open={activityModalOpen}
        onOpenChange={() => setActivityModalOpen(false)}
        lead={selectedLeadForActivity}
      />
    </div>
  );
};

export { LeadsContent };
