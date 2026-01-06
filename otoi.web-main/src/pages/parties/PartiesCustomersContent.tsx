import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Customer,
  QueryApiResponse,
} from "./blocks/customers/customer-models";
import { ModalCustomer } from "./blocks/customers/ModalCustomer";
import { ActivityForm } from "./blocks/leads/ActivityForm";

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
import { MoreVertical, Edit, Trash2, Eye, AlertCircle } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useNavigate } from "react-router-dom";
// import { PersonTypeEnum } from "@/enums/PersonTypeEnum";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type CustomersQueryApiResponse = QueryApiResponse<Customer>;

interface IPartiesCustomerContentProps {
  refreshStatus: number;
}

interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

const PartiesCustomerContent = ({ refreshStatus }: IPartiesCustomerContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchPersonTypeQuery, setPersonTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Customer | null>(null);
  const [selectedCustomerForActivity, setSelectedCustomerForActivity] = useState<ActivityLead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [customersData, setCustomersData] = useState<Customer[]>([]);


  const handleDeleteClick = (uuid: string) => {
    setCustomerToDelete(uuid);
    setShowDeleteDialog(true);
  };

  const navigate = useNavigate();



  const dataGridRef = useRef<any>(null);

  const deleteCustomer = async () => {
    if (!customerToDelete) return;

    // Optimistically remove the customer from the UI
    setCustomersData((prev) => prev.filter((customer) => customer.uuid !== customerToDelete));

    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/customers/${customerToDelete}`);
      toast.success("Customer deleted successfully");
      // Trigger a re-fetch to sync with the server
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Delete failed");
      // Revert the UI if the request fails
      setRefreshKey((prev) => prev + 1); // Re-fetch to revert
    } finally {
      setShowDeleteDialog(false);
      setCustomerToDelete(null);
    }
  };





  function useDebounce<T>(value: T, delay = 400): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setRefreshKey(prev => prev + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Manually trigger a re-fetch when refreshKey changes
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

  const openPersonModal = (event: { preventDefault: () => void }, rowData: Customer | null = null) => {
    event.preventDefault();
    setSelectedPerson(rowData);
    setPersonModalOpen(true);
  };

  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prev) => prev + 1); // Trigger refresh on close

  };

  const columns = useMemo<ColumnDef<Customer>[]>(
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
                  navigate(`/customer/${info.row.original.id}`);
                }}
              >
                {info.row.original.first_name} {info.row.original.last_name}
              </a>
              <a
                className="text-2sm text-gray-700 font-normal hover:text-primary-active cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/customer/${info.row.original.id}`);
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
        accessorFn: (row: Customer) => row.gst,
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
        accessorFn: (row: Customer) => row.mobile,
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
        accessorFn: (row: Customer) => row.city,
        id: "city",
        header: ({ column }) => (
          <DataGridColumnHeader title="City" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          return info.row.original.city;
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
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); openPersonModal(e, row.original); }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/customer/${row.original.id}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                <span>Details</span>
              </DropdownMenuItem>
              {/* <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedCustomerForActivity({
                    id: row.original.uuid,
                    status: row.original.status,
                    address: row.original.address1,
                    created_at: row.original.created_at,
                    activity_type: row.original.activity_type,
                  });
                  setActivityModalOpen(true);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                <span>Create Activity</span>
              </DropdownMenuItem> */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteClick(row.original.uuid);
                }}
              >
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

      if (searchQuery) {
        queryParams.set("query", searchQuery);
      } else {
        queryParams.delete("query");
      }

      if (searchPersonTypeQuery !== "-1") {
        queryParams.set("person_type", searchPersonTypeQuery);
      }

      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get<CustomersQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/customers/?${queryParams.toString()}&t=${Date.now()}`,
      );
      const payload: any = response.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total = payload?.pagination?.total ?? (Array.isArray(payload) ? rows.length : 0);

      // Update state with the fetched data
      setCustomersData(rows);

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
    const [searchPersonType, setPersonType] = useState(defaultPersonType);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);

      if (value.trim()) {
        setSearch(value.trim());
      } else {
        setSearch('');
      }
    };

    const handlePersonTypeChange = (personType: string) => {
      setPersonType(personType);
      setDefaultPersonType(personType);
    };

    return (
      <div className="card-header flex justify-between flex-wrap gap-2 border-b-0 px-5">
        <div className="flex flex-wrap gap-2 lg:gap-5">
          <div className="flex">
            <label className="input input-sm w-64">
              <KeenIcon icon="magnifier" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search customers..."
                value={searchInput}
                onChange={handleChange}
                className="w-full focus:outline-none"
                autoFocus
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
        key={refreshKey} // This forces the DataGrid to remount and re-fetch data
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
            setSearch={setSearchQuery}
            defaultPersonType={searchPersonTypeQuery}
            setDefaultPersonType={setPersonTypeQuery}
          />
        }
        layout={{ card: true }}
      />


      <ModalCustomer
        open={personModalOpen}
        onOpenChange={(open: boolean) => { // Explicitly type the argument
          if (!open) {
            handleClose(); // Close the modal
          }
        }}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1); // Refresh when customer is added
        }}
        customer={selectedPerson ? { ...selectedPerson, person_type_id: (selectedPerson as any).person_type_id ?? 1 } : null}
      />





      <ActivityForm
        open={activityModalOpen}
        onOpenChange={() => setActivityModalOpen(false)}
        lead={selectedCustomerForActivity}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">
              Delete Customer
            </DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete this customer?
            </DialogDescription>

          </DialogHeader>

          <DialogFooter className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={deleteCustomer}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export { PartiesCustomerContent };