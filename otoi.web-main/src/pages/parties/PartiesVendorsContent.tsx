import React, { useMemo, useState, useEffect } from "react";

import {
  Vendor,
  QueryApiResponse,
} from "../parties/blocks/leads/customer-models";

import { ModalVendor } from "./blocks/leads/ModalVendor";
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
import { ChevronDown, MoreVertical, Settings, Edit, Trash2, Eye, PlusCircle } from "lucide-react";

import {
  ColumnDef,
  Column,
  RowSelectionState,
} from "@tanstack/react-table";
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
import { PersonTypeEnum } from "@/enums/PersonTypeEnum";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type VendorsQueryApiResponse = QueryApiResponse<Vendor>;

interface IPartiesVendorsContentProps {
  refreshStatus: number;
}

interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

const PartiesVendorsContent = ({
  refreshStatus,
}: IPartiesVendorsContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPersonTypeQuery, setPersonTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Vendor | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedCustomerForActivity, setSelectedCustomerForActivity] = useState<
    ActivityLead | null
  >(null);

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
        column.setFilterValue(inputValue);
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
    };

    return (
      <Input
        placeholder="Filter..."
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="h-9 w-full max-w-40"
      />
    );
  };

  const openPersonModal = (event: { preventDefault: () => void }, rowData: Vendor | null = null) => {
    event.preventDefault();
    setSelectedPerson(rowData);
    setPersonModalOpen(true);
  };

  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const columns = useMemo<ColumnDef<Vendor>[]>(
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
        accessorFn: (row) => row.company_name,
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
              <div className="font-medium text-sm text-gray-900 mb-px">
                {info.row.original.company_name}
              </div>
              <div className="text-2sm text-gray-700 font-normal">
                {info.row.original.email}
              </div>
            </div>
          </div>
        ),
        meta: {
          headerClassName: "min-w-[300px]",
        },
      },
      {
        accessorFn: (row: Vendor) => row.gst,
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
        accessorFn: (row: Vendor) => row.mobile,
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
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Activity" column={column} />
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
              <DropdownMenuItem onClick={(e) => {
                e.preventDefault();
                openPersonModal(e, row.original);
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {/* <DropdownMenuItem onClick={(e) => {
                e.preventDefault();
                navigate(`/vendor/${row.original.uuid}`);
              }}>
                <Eye className="mr-2 h-4 w-4" />
                Details
              </DropdownMenuItem> */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedCustomerForActivity({
                    id: row.original.uuid,
                    status: undefined,
                    address: row.original.address1,
                    created_at: undefined,
                    activity_type: undefined,
                  });
                  setActivityModalOpen(true);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Activity
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

      if (searchPersonTypeQuery != "-1") {
        queryParams.set("person_type", searchPersonTypeQuery);
      }

      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get<VendorsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/vendors/?${queryParams.toString()}`,
      );
      // Support both envelope ({ data, pagination }) and plain array responses
      const payload: any = response.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total = payload?.pagination?.total ?? (Array.isArray(payload) ? rows.length : 0);
      return {
        data: rows,
        totalCount: total,
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

  const handlePersonTypeSearch = (query: string) => {
    setPersonTypeQuery(query);
    setRefreshKey((prev) => prev + 1);
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(e.target.value);
    };

    const handlePersonTypeChange = (personType: string) => {
      setPersonType(personType);
      setDefaultPersonType(personType);
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
                onChange={handleChange}
                onKeyDown={handleKeyDown}
              />
            </label>
          </div>
          {/* <div className="flex flex-wrap gap-2.5">
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
          </div> */}
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
            defaultPersonType={searchPersonTypeQuery}
            setDefaultPersonType={handlePersonTypeSearch}
          />
        }
        layout={{ card: true }}
      />
      <ModalVendor
        open={personModalOpen}
        onOpenChange={handleClose}
        vendor={selectedPerson}
      />
      <ActivityForm
        open={activityModalOpen}
        onOpenChange={() => setActivityModalOpen(false)}
        lead={selectedCustomerForActivity}
      />
    </div>
  );
};

export { PartiesVendorsContent };