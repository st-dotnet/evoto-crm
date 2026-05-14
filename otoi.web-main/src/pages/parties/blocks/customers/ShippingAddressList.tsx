import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Edit,
  Trash2,
  MoreVertical,
  Home,
  Briefcase,
  Building,
  Check,
} from "lucide-react";
import { Country, State } from "country-state-city";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from "@/components/ui/dialog";

/* TYPES */

type ShippingAddress = {
  uuid?: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  country: string;
  pin: string;
  address_type: "home" | "work" | "other";
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

interface ShippingAddressListProps {
  addresses: ShippingAddress[];
  onEdit: (uuid: string) => void;
  onDelete: (uuid: string) => void;
  onSetDefault: (uuid: string) => void;
}

/*  ICON MAP  */

const typeIcon = {
  home: Home,
  work: Briefcase,
  other: Building,
};

/*  SINGLE ADDRESS ITEM COMPONENT  */

const AddressItem: React.FC<{
  address: ShippingAddress;
  onEdit: (uuid: string) => void;
  onDelete: (uuid: string) => void;
  onSetDefault: (uuid: string) => void;
}> = ({ address, onEdit, onDelete, onSetDefault }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleEdit = () => {
    if (address.uuid) {
      onEdit(address.uuid);
      setIsDropdownOpen(false);
    }
  };

  const handleSetDefault = () => {
    if (address.uuid) {
      onSetDefault(address.uuid);
      setIsDropdownOpen(false);
    }
  };

  const handleDelete = () => {
    if (address.uuid) {
      setIsDropdownOpen(false);
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDelete = () => {
    if (address.uuid) {
      onDelete(address.uuid);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const Icon = typeIcon[address.address_type];

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all duration-200 group hover:shadow-sm hover:border-l-4 hover:border-l-blue-500 border-l-4 border-l-transparent">
      {/* Left */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex flex-col items-center mt-0.5">
          <Icon className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
          {address.is_default && (
            <Check className="w-3 h-3 text-green-600 mt-1" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center mb-2">
            <span className="text-xs font-medium uppercase text-gray-500 dark:text-zinc-500">
              {address.address_type}
            </span>
            {address.is_default && (
              <span className="inline-flex items-center justify-center text-[8px] px-3 h-[2em] rounded-full bg-blue-500 text-white font-medium ml-1">
                DEFAULT
              </span>
            )}
          </div>

          {/* Main Address */}
          <div className="text-sm text-gray-800 dark:text-zinc-100 mb-2">
            <p className="font-medium">{address.address1}</p>
            {address.address2 && (
              <p className="text-gray-600 dark:text-zinc-400">{address.address2}</p>
            )}
          </div>

          {/* Location Details */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-zinc-300">City:</span>
              <span className="text-gray-600 dark:text-zinc-400">{address.city}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-zinc-300">State:</span>
              <span className="text-gray-600 dark:text-zinc-400">
                {(() => {
                  const state = State.getStateByCodeAndCountry(
                    address.state,
                    address.country,
                  );
                  return state ? state.name : address.state;
                })()}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-zinc-300">Country:</span>
              <span className="text-gray-600 dark:text-zinc-400">
                {(() => {
                  const country = Country.getCountryByCode(address.country);
                  return country ? country.name : address.country;
                })()}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-zinc-300">Pin Code:</span>
              <span className="text-gray-600 dark:text-zinc-400">{address.pin}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen(!isDropdownOpen);
          }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100"
          aria-label="Address actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-950 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-zinc-800 z-[100] animate-in slide-in-from-top-2 fade-in-0 duration-200 border dark:border-zinc-800">
            <div className="py-1" role="menu">
              {!address.is_default && (
                <button
                  type="button"
                  onClick={handleSetDefault}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-900 flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span>Set as Default</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleEdit}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-blue-600 flex items-center gap-2 transition-colors duration-150"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 flex items-center gap-2 transition-colors duration-150"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-black rounded-lg p-6 max-w-md w-full mx-4 border dark:border-zinc-800">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
                Delete Shipping Address
              </h3>
              <p className="text-sm text-gray-700 dark:text-zinc-400">
                Are you sure you want to delete this shipping address?
              </p>
            </div>
            
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/*  MAIN COMPONENT  */

const ShippingAddressList: React.FC<ShippingAddressListProps> = ({
  addresses,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  if (addresses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 border border-dashed dark:border-zinc-800 rounded-xl text-gray-400">
        <MapPin className="w-10 h-10 mb-3 text-red-500" />
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-300">
          No shipping addresses
        </p>
        <p className="text-xs">
          No addresses were found. Start by adding the first one.
        </p>
      </div>
    );
  }

  return (
    <div className="border dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-zinc-800 text-sm font-semibold text-gray-700 dark:text-zinc-200 flex justify-between items-center">
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span className="text-gray-700 dark:text-zinc-100">Shipping Addresses</span>
        </span>
        <span className="text-xs text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-900 px-2 py-1 rounded-full"><span className="text-red-500 font-semibold">{addresses.length}</span>/3</span>
      </div>

      {/* List */}
      <div className="divide-y dark:divide-zinc-800">
        {addresses.map((address) => (
          <AddressItem
            key={address.uuid}
            address={address}
            onEdit={onEdit}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        ))}
      </div>
    </div>
  );
};

export { ShippingAddressList };