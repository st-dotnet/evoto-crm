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
import { MoreVertical, Edit, Trash2, Eye, AlertCircle, Loader2 } from "lucide-react";

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
import { SpinnerDotted } from 'spinners-react';

import { getCustomerById } from "./services/customer.service";

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

import { debounce } from "@/lib/helpers";

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

  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearch(query);
      }, 500),
    [setSearch]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel?.();
    };
  }, [debouncedSearch]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      debouncedSearch.cancel?.();
      setSearch(searchInput);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  return (
    <div className="card-header flex justify-between flex-wrap gap-3 border-b-0 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5 lg:gap-5">
        <div className="flex grow md:grow-0">
          <label className="input input-sm w-full md:w-64 lg:w-72">
            <span onClick={() => setSearch(searchInput)} className="cursor-pointer flex items-center">
              <KeenIcon icon="magnifier" />
            </span>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="w-full focus:outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

const PartiesCustomerContent = ({ refreshStatus }: IPartiesCustomerContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPersonTypeQuery, setPersonTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Customer | null>(null);
  const [selectedCustomerForActivity, setSelectedCustomerForActivity] = useState<ActivityLead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [customersData, setCustomersData] = useState<Customer[]>([]);
  const [filteredItems, setFilteredItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const handleDeleteClick = (uuid: string) => {
    setCustomerToDelete(uuid);
    setShowDeleteDialog(true);
  };

  const deleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/customers/${customerToDelete}`);
      toast.success("Customer deleted successfully");
      setShowDeleteDialog(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Delete failed");
    } finally {
      setCustomerToDelete(null);
    }
  };


  const navigate = useNavigate();

  const fetchAllCustomers = async () => {
    try {
      setLoading(true);
      const response = await axios.get<CustomersQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/customers/?items_per_page=1000`
      );
      const rows = response.data.data;
      setCustomersData(rows);
    } catch (error) {
      toast.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCustomers();
  }, [refreshStatus, refreshKey]);

  useEffect(() => {
    let result = [...customersData];

    // Apply search filter
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery !== "") {
      const lowerQuery = trimmedQuery.toLowerCase();
      result = result.filter((customer) => {
        const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.toLowerCase();
        return (
          fullName.includes(lowerQuery) ||
          (customer.email || "").toLowerCase().includes(lowerQuery) ||
          (customer.mobile || "").includes(trimmedQuery) ||
          (customer.gst || "").toLowerCase().includes(lowerQuery)
        );
      });
    }

    setFilteredItems(result);
  }, [searchQuery, customersData]);

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

  const openPersonModal = async (event: React.SyntheticEvent, rowData: Customer | null = null) => {
    event.preventDefault();

    if (rowData?.uuid) {
      setSelectedPerson(rowData);
      setIsEditing(true);

      try {
        const result = await getCustomerById(rowData.uuid);
        if (result.success && result.data) {
          const customerData = {
            ...result.data,
            shipping_address1: result.data.shipping_address1 || '',
            shipping_address2: result.data.shipping_address2 || '',
            shipping_city: result.data.shipping_city || '',
            shipping_state: result.data.shipping_state || '',
            shipping_country: result.data.shipping_country || '',
            shipping_pin: result.data.shipping_pin || result.data.shipping_zip || '',
          };
          setSelectedPerson(customerData);
          setPersonModalOpen(true);
        } else {
          toast.error(result.error || 'Failed to load customer data');
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        toast.error('An error occurred while loading customer data');
      } finally {
        setIsEditing(false);
      }
    } else {
      // For new customer
      setSelectedPerson(null);
      setPersonModalOpen(true);
    }
  };

  // const handleClose = () => {
  //   setPersonModalOpen(false);
  //   setRefreshKey((prev) => prev + 1); // Trigger refresh on close

  // };

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
                {info.row.original.email || "\u00A0"}
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
          <DataGridColumnHeader title="Activity" column={column} className="justify-center" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center" >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary-active"
                  disabled={loading && selectedPerson?.uuid === row.original.uuid}
                >
                  {loading && selectedPerson?.uuid === row.original.uuid ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    if (!loading || selectedPerson?.uuid !== row.original.uuid) {
                      openPersonModal({ preventDefault: () => { } } as React.SyntheticEvent, row.original);
                    }
                  }}
                >
                  {loading && selectedPerson?.uuid === row.original.uuid ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => {
                    navigate(`/customer/${row.original.id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => {
                    handleDeleteClick(row.original.uuid);
                  }}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>

            </DropdownMenu>
          </div>
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
      });
    }
  };


  return (
    <div className="grid gap-5 lg:gap-7.5 relative">
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
          </div>
        </div>
      )}
      {loading && customersData.length === 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/20">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
          </div>
        </div>
      )}
      {!loading && (
        <DataGrid
          key={refreshKey}
          columns={columns}
          serverSide={false}
          data={filteredItems}
          loading={loading}
          rowSelection={true}
          getRowId={(row: any) => row.id}
          onRowSelectionChange={handleRowSelection}
          pagination={{ size: 5 }}
          toolbar={
            <Toolbar
              defaultSearch={searchQuery}
              setSearch={setSearchQuery}
              defaultStatusType={searchPersonTypeQuery}
              setDefaultStatusType={setPersonTypeQuery}
            />
          }
          layout={{ card: true }}
        />
      )}


      <ModalCustomer
        open={personModalOpen}
        onOpenChange={(open: boolean) => {
          setPersonModalOpen(open);

          if (!open) {
            setSelectedPerson(null);
            setRefreshKey((prev) => prev + 1);
          }
        }}
        onSuccess={() => {
          setPersonModalOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
        customer={
          selectedPerson
            ? {
              ...selectedPerson,
              person_type_id: (selectedPerson as any).person_type_id ?? 1
            }
            : null
        }
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