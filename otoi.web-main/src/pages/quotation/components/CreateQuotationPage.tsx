import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Plus,
  Save,
  X,
  UserPlus,
  Search,
  MapPin,
  MapPinIcon,
  HomeIcon,
  BriefcaseIcon,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpinnerDotted } from "spinners-react";
import { Input } from "@/components/ui/input";
import { Country, State, City } from "country-state-city";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalCustomer } from "@/pages/parties/blocks/customers/ModalCustomer";
import axios from "axios";
import { toast } from "sonner";
import { createQuotation, getQuotationById, updateQuotation } from "../services/quotation.services";
import { updateInvoiceFromQuotation } from "@/pages/invoice/services/invoice.services";
import AddItemPage from "./AdditemPage";
import CreateItemModal from "../../items/CreateItemModal";
import { DialogDescription as RadixDialogDescription } from "@radix-ui/react-dialog";
import { ShippingAddressModal } from "@/pages/parties/blocks/customers/ShippingAddressModal";
import { ShippingAddressList } from "@/pages/parties/blocks/customers/ShippingAddressList";
import { ShippingAddress } from "@/pages/parties/blocks/customers/customer-models";

interface Party {
  id: string;
  name: string;
  balance: number;
  uuid: string;
  mobile: string;
}

interface Address {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [key: string]: any; // For any additional fields
}


interface Customer {
  uuid: string;
  customer_id?: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  contact_person?: string;
  mobile: string;
  email?: string | null;
  gst?: string;
  pin?: string;
  billing_address?: Address;
  shipping_address?: Address;
  status?: string;
  [key: string]: any;
}

interface QuotationItem {
  id: string;
  item_id: string;
  item_name: string;
  hsn_sac?: string;
  quantity: number;
  price_per_item: number;
  discount: number;
  tax: number;
  amount: number;
  measuring_unit_id?: number;
  description?: string | null;
}

interface InventoryItem {
  item_id: string;
  item_name: string;
  opening_stock: number;
  sales_price: number;
  purchase_price: number | null;
  type: string;
  category: string;
  hsn_code?: string | null;
  gst_tax_rate?: number;
  measuring_unit_id?: number;
  quantity?: number;
}

/* Shipping Address Formik Setup */
const shippingAddressInitialValues = {
  country: "",
  state: "",
  city: "",
  pin: "",
};

const shippingAddressValidationSchema = Yup.object().shape({
  country: Yup.string().required("Country is required"),
  state: Yup.string().required("State is required"),
  city: Yup.string().required("City is required"),
  pin: Yup.string()
    .required("Pin Code is required")
    .matches(/^[0-9]+$/, "Pin must be a number"),
});

// Validation function to check for duplicate address types
const validateAddressType = (
  address: ShippingAddress,
  existingAddresses: ShippingAddress[],
  editingAddress?: ShippingAddress | null,
) => {
  const duplicateAddress = existingAddresses.find(
    (addr) =>
      addr.address_type === address.address_type &&
      addr.uuid !== editingAddress?.uuid,
  );

  if (duplicateAddress) {
    throw new Error(`A ${address.address_type} address already exists. Please choose a different address type.`);
  }

  return true;
};

const addDays = (date: string | number | Date, days: number) => {
  if (!date) return "";
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const formatAddress = (customer: any): string[] => {
  if (!customer) return [];
  const parts = [];
  if (customer.address1) parts.push(customer.address1);
  if (customer.address2) parts.push(customer.address2);
  const cityStatePostal = [
    customer.city,
    customer.state,
    customer.pin,
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStatePostal) parts.push(cityStatePostal);
  if (customer.country) parts.push(customer.country);
  return parts;
};

const diffDays = (
  start: string | number | Date,
  end: string | number | Date,
) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)), 0);
};

const CreateQuotationPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const today = new Date().toISOString().split("T")[0];

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [autoSelectCustomerUUID, setAutoSelectCustomerUUID] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | undefined>();

  // Action button state
  const [activeDropdownUuid, setActiveDropdownUuid] = useState<string | null>(null);
  const [addressToOperate, setAddressToOperate] = useState<ShippingAddress | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Formik for shipping address
  const shippingFormik = useFormik({
    initialValues: shippingAddressInitialValues,
    validationSchema: shippingAddressValidationSchema,
    onSubmit: (values) => {
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    quotationNo: "",
    quotationDate: today,
    validFor: 10,
    validityDate: addDays(today, 10),
    status: "win",
  });
  const [isPartyDialogOpen, setIsPartyDialogOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [isCreatingParty, setIsCreatingParty] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [newPartyName, setNewPartyName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isShippingModalOpen, setIsShippingModalOpen] =
    useState<boolean>(false);
  const [addAddressModalOpen, setAddAddressModalOpen] = useState<boolean>(false);
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(
    [],
  );
  const [selectedAddress, setSelectedAddress] =
    useState<ShippingAddress | null>(null);

  const [notes, setNotes] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [showTermsField, setShowTermsField] = useState(false);
  const [additionalCharges, setAdditionalCharges] = useState<{ name: string; amount: number }[]>([]);
  const [showAdditionalChargesField, setShowAdditionalChargesField] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState(0);
  const [discount, setDiscount] = useState<{ type: "percentage" | "amount"; value: number }>({
    type: "percentage",
    value: 0,
  });
  const [showDiscountField, setShowDiscountField] = useState(false);
  const [autoRoundOff, setAutoRoundOff] = useState(false);
  const [roundOffAmount, setRoundOffAmount] = useState(0);
  const [tax, setTax] = useState(0);

  // Add these calculation helper functions before the return statement:

  const calculateTotalBeforeRoundOff = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscount();
    const taxAmount = calculateTax();
    const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);

    // Apply overall discount if set
    const overallDiscountAmount = discount.type === "percentage"
      ? (subtotal * discount.value) / 100
      : discount.value;

    return subtotal - discountAmount - overallDiscountAmount + taxAmount + additionalChargesTotal;
  };

  const calculateFinalTotal = () => {
    const totalBeforeRound = calculateTotalBeforeRoundOff();
    if (autoRoundOff) {
      const rounded = Math.round(totalBeforeRound);
      setRoundOffAmount(rounded - totalBeforeRound);
      return rounded;
    }
    return totalBeforeRound + roundOffAmount;
  };

  const handleAddAdditionalCharge = () => {
    if (newChargeName.trim() && newChargeAmount > 0) {
      setAdditionalCharges([...additionalCharges, { name: newChargeName, amount: newChargeAmount }]);
      setNewChargeName("");
      setNewChargeAmount(0);
    }
  };

  const handleRemoveAdditionalCharge = (index: number) => {
    setAdditionalCharges(additionalCharges.filter((_, i) => i !== index));
  };

  const fetchParties = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/customers/?items_per_page=1000`,
      );
      const customers = response.data.data;
      const winCustomers = customers.filter(
        (customer: Customer) => customer.status === "4",
      );
      const partiesList = winCustomers.map((customer: Customer) => ({
        id: customer.uuid,
        uuid: customer.uuid,
        name: `${customer.first_name} ${customer.last_name}`.trim(),
        balance: 0,
        mobile: customer.mobile,
        customerData: customer,
      }));
      setParties(partiesList);

      // Handle auto-selection if needed
      if (autoSelectCustomerUUID) {
        const newCustomer = partiesList.find((p: { uuid: string | null }) => p.uuid === autoSelectCustomerUUID);
        if (newCustomer) {
          setSelectedParty(newCustomer);
          fetchCustomerData(newCustomer.uuid);
        }
        setAutoSelectCustomerUUID(null); // Reset after handling
      }
    } catch {
      toast.error("Failed to fetch parties");
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  useEffect(() => {
    if (!formData.quotationDate || !formData.validFor) return;
    setFormData((prev) => ({
      ...prev,
      validityDate: addDays(
        prev.quotationDate,
        typeof prev.validFor === "number" ? prev.validFor : 0,
      ),
    }));
  }, [formData.quotationDate, formData.validFor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "validityDate") {
      setFormData((prev) => ({
        ...prev,
        validityDate: value,
        validFor: value ? diffDays(prev.quotationDate, value) : 0,
      }));
      return;
    }
    if (name === "validFor") {
      if (value === "") {
        setFormData((prev) => ({
          ...prev,
          validFor: 0,
          validityDate: "",
        }));
        return;
      }
      const numValue = Number(value);
      if (isNaN(numValue)) return;
      const days = Math.max(0, numValue);
      setFormData((prev) => ({
        ...prev,
        validFor: days,
        validityDate: prev.quotationDate ? addDays(prev.quotationDate, days) : "",
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddParty = () => {
    if (!newPartyName.trim()) return;
    const newParty = {
      id: Date.now().toString(),
      uuid: Date.now().toString(),
      name: newPartyName.trim(),
      balance: 0,
      mobile: "",
    };
    setParties((prev) => [...prev, newParty]);
    setSelectedParty(newParty);
    setNewPartyName("");
    setIsCreatingParty(false);
    setIsPartyDialogOpen(false);
  };

  const handleSelectParty = (party: Party) => {
    setSelectedParty(party);
    setIsPartyDialogOpen(false);
    fetchCustomerData(party.uuid);
  };

  const filteredParties = parties.filter((party) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      party.name.toLowerCase().includes(searchLower) ||
      (party.mobile && party.mobile.includes(searchQuery))
    );
  });

  const fetchCustomerData = async (customerUUID: string) => {
    if (!customerUUID) return;
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/customers/${customerUUID}`,
      );

      // Process shipping addresses from the API response
      let addresses: ShippingAddress[] = [];
      if (
        response.data.shipping_addresses &&
        Array.isArray(response.data.shipping_addresses)
      ) {
        addresses = response.data.shipping_addresses.map(
          (addr: any, index: number) => ({
            ...addr,
            uuid: addr.uuid || addr.id || `api-${index}-${Date.now()}`,
            created_at: addr.created_at || new Date().toISOString(),
            updated_at: addr.updated_at || new Date().toISOString(),
          }),
        );
      } else {
        if (response.data.shipping_address1 || response.data.shipping_city) {
          addresses = [
            {
              uuid: `default-${Date.now()}`,
              address_type: "home",
              address1:
                response.data.shipping_address1 || response.data.address1 || "",
              address2:
                response.data.shipping_address2 || response.data.address2 || "",
              city: response.data.shipping_city || response.data.city || "",
              state: response.data.shipping_state || response.data.state || "",
              country:
                response.data.shipping_country || response.data.country || "",
              pin: response.data.shipping_pin || response.data.pin || "",
              is_default: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        }
      }
      setShippingAddresses(addresses);
      if (addresses.length > 0) {
        const defaultAddress =
          addresses.find((addr) => addr.is_default) || addresses[0];
        setSelectedAddress(defaultAddress);
      } else {
        setSelectedAddress(null);
      }
      const customerData = {
        ...response.data,
        shipping_address1:
          response.data.shipping_address1 || response.data.address1 || "",
        shipping_address2:
          response.data.shipping_address2 || response.data.address2 || "",
        shipping_city: response.data.shipping_city || response.data.city || "",
        shipping_state:
          response.data.shipping_state || response.data.state || "",
        shipping_country:
          response.data.shipping_country || response.data.country || "",
        shipping_pin: response.data.shipping_pin || response.data.pin || "",
      };

      setSelectedCustomer(customerData);
    } catch (error) {
      toast.error("Failed to fetch customer details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchQuotation = async (quotationId: string) => {
    setIsLoading(true);
    try {
      const response = await getQuotationById(quotationId);
      if (response.success && response.data) {
        const data = response.data;
        setFormData({
          quotationNo: data.quotation_number,
          quotationDate: data.quotation_date ? data.quotation_date.split('T')[0] : today,
          validFor: 0,
          validityDate: data.valid_till ? data.valid_till.split('T')[0] : "",
          status: data.status,
        });

        if (data.customer) {
          fetchCustomerData(data.customer_id);
        }

        if (data.items) {
          const mappedItems = data.items.map((item: any) => ({
            id: item.uuid || item.id,
            item_id: item.item_id,
            item_name: item.product_name || item.item_name || item.description || "Item",
            description: item.description || item.item_description || "",
            quantity: item.quantity,
            price_per_item: item.unit_price,
            discount:
              item.discount_percentage ??
              item.discount?.discount_percentage ??
              0,
            tax:
              item.tax_percentage ??
              item.tax?.tax_percentage ??
              0,
            amount: item.total_price,
            measuring_unit_id: item.measuring_unit_id || 1,
          }));
          setQuotationItems(mappedItems);
          if (mappedItems.length > 0) {
            const firstTax = mappedItems[0].tax || 0;
            setTax(firstTax);
          }
        }

        const resolvedNotes =
          data.notes ||
          data.additional_notes?.notes ||
          "";
        const resolvedTerms =
          data.terms_and_conditions ||
          data.additional_notes?.terms_and_conditions ||
          "";
        setNotes(resolvedNotes);
        setTermsAndConditions(resolvedTerms);
        setShowNotesField(!!resolvedNotes);
        setShowTermsField(!!resolvedTerms);

        if (data.quotation_date && data.valid_till) {
          const diff = diffDays(data.quotation_date, data.valid_till);
          setFormData(prev => ({ ...prev, validFor: diff }));
        }

      } else {
        toast.error("Failed to load quotation details");
        navigate('/quotes/list');
      }
    } catch (error) {
      console.error("Error loading quotation:", error);
      toast.error("Failed to load quotation details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && id) {
      handleFetchQuotation(id);
    }
  }, [id, isEditMode]);

  const handleAddAddress = async (newAddress: ShippingAddress) => {
    if (!selectedCustomer?.uuid) {
      toast.error("No customer selected");
      return;
    }

    setIsAddressLoading(true);
    try {
      // Check if we're editing an existing address
      const isEditing = editingAddress && editingAddress.uuid;

      let updatedAddresses: ShippingAddress[];

      if (isEditing) {
        // Update existing address
        updatedAddresses = shippingAddresses.map(addr =>
          addr.uuid === editingAddress.uuid ? newAddress : addr
        );
      } else {
        // Validate address type before proceeding (only for new addresses)
        validateAddressType(newAddress, shippingAddresses);

        // Add new address
        updatedAddresses = [...shippingAddresses, newAddress];
      }

      // Prepare the payload with the updated shipping addresses
      const payload = {
        shipping_addresses: updatedAddresses.map(addr => ({
          uuid: addr.uuid,
          address1: addr.address1,
          address2: addr.address2 || null,
          city: addr.city,
          state: addr.state,
          country: addr.country,
          pin: addr.pin,
          address_type: addr.address_type,
          is_default: addr.is_default,
        })),
      };

      // Call the API to update the customer with the new/updated address
      const response = await axios.put(
        `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
        payload
      );

      // Update local state after successful API call
      setShippingAddresses(updatedAddresses);

      // Update the customer data with the new addresses
      const updatedCustomer = {
        ...selectedCustomer,
        shipping_addresses: updatedAddresses,
      };
      setSelectedCustomer(updatedCustomer);


      // If this is the first address or set as default, select it
      if (updatedAddresses.length === 1 || newAddress.is_default) {
        setSelectedAddress(newAddress);
      } else if (isEditing && selectedAddress?.uuid === editingAddress.uuid) {
        // If we edited the currently selected address, update the selection
        setSelectedAddress(newAddress);
      }

      toast.success(isEditing ? "Address updated successfully." : "Address saved successfully.");

      // Clear editing state
      setEditingAddress(undefined);
    } catch (error: any) {
      console.error("Error saving address:", error);
      let errorMessage = "Failed to save address. Please try again.";


      if (error.response?.data?.error) {
        const errorCode = error.response.data.error;
        switch (errorCode) {
          case "address_type_exists":
            errorMessage = "An address with this type already exists";
            break;
          case "database_error":
            errorMessage = "A database error occurred while saving the address";
            break;
          default:
            errorMessage = error.response.data.error || errorMessage;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsAddressLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdownUuid(null);
      }
    };

    if (activeDropdownUuid) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdownUuid]);

  // Handle edit address
  const handleEditAddress = () => {
    if (activeDropdownUuid) {
      const addressToEdit = shippingAddresses.find(addr => addr.uuid === activeDropdownUuid);
      if (addressToEdit) {
        setEditingAddress(addressToEdit);
        setAddAddressModalOpen(true);
      }
    }
    setActiveDropdownUuid(null);
  };

  // Handle set default address
  const handleSetDefaultAddress = async () => {
    const targetUuid = activeDropdownUuid;
    if (!targetUuid || !selectedCustomer?.uuid) {
      toast.error("No address or customer selected");
      return;
    }

    setIsAddressLoading(true);
    try {
      // Update all addresses to set the selected one as default
      const updatedAddresses = shippingAddresses.map((addr) => ({
        ...addr,
        is_default: addr.uuid === targetUuid,
      }));

      // Prepare the payload
      const payload = {
        shipping_addresses: updatedAddresses.map(addr => ({
          uuid: addr.uuid,
          address1: addr.address1,
          address2: addr.address2 || null,
          city: addr.city,
          state: addr.state,
          country: addr.country,
          pin: addr.pin,
          address_type: addr.address_type,
          is_default: addr.is_default,
        })),
      };

      // Call the API to update the customer
      await axios.put(
        `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
        payload
      );

      // Update local state
      setShippingAddresses(updatedAddresses);

      const defaultAddress = shippingAddresses.find(addr => addr.uuid === targetUuid);
      if (defaultAddress) {
        setSelectedAddress({ ...defaultAddress, is_default: true });
      }

      toast.success("Default address updated successfully.");
    } catch (error) {
      console.error("Error updating default address:", error);
      toast.error("Failed to update default address.");
    } finally {
      setIsAddressLoading(false);
    }
  };

  // Handle delete address
  const handleDeleteAddress = () => {
    if (activeDropdownUuid) {
      const addressToDelete = shippingAddresses.find(addr => addr.uuid === activeDropdownUuid);
      if (addressToDelete) {
        setAddressToOperate(addressToDelete);
        setShowDeleteConfirm(true);
      }
    }
    setActiveDropdownUuid(null);
  };

  // Confirm delete address
  const handleConfirmDelete = async () => {
    if (!addressToOperate?.uuid || !selectedCustomer?.uuid) {
      toast.error("No address or customer selected");
      return;
    }

    setIsAddressLoading(true);
    try {
      // Remove the address from the list
      const updatedAddresses = shippingAddresses.filter(
        (addr) => addr.uuid !== addressToOperate.uuid
      );

      // If we removed the default address and there are remaining addresses, make the first one default
      if (addressToOperate.is_default && updatedAddresses.length > 0) {
        updatedAddresses[0].is_default = true;
      }

      // Prepare the payload
      const payload = {
        shipping_addresses: updatedAddresses.map(addr => ({
          uuid: addr.uuid,
          address1: addr.address1,
          address2: addr.address2 || null,
          city: addr.city,
          state: addr.state,
          country: addr.country,
          pin: addr.pin,
          address_type: addr.address_type,
          is_default: addr.is_default,
        })),
      };

      // Call the API to update the customer
      await axios.put(
        `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
        payload
      );

      // Update local state
      setShippingAddresses(updatedAddresses);

      // Set the new selected address
      if (updatedAddresses.length > 0) {
        const defaultAddress = updatedAddresses.find((addr) => addr.is_default) || updatedAddresses[0];
        setSelectedAddress(defaultAddress);
      } else {
        setSelectedAddress(null);
      }

      toast.success("Address deleted successfully.");
      setShowDeleteConfirm(false);
      setAddressToOperate(null);
    } catch (error) {
      console.error("Error deleting address:", error);
      toast.error("Failed to delete address.");
    } finally {
      setIsAddressLoading(false);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setAddressToOperate(null);
  };

  const getMeasuringUnit = (unitId?: number) => {
    switch (unitId) {
      case 1:
        return "PCS";
      case 2:
        return "KG";
      case 3:
        return "LTR";
      case 4:
        return "MTR";
      default:
        return "PCS";
    }
  };

  const handleAddItems = (items: InventoryItem[]) => {
    const newItems: QuotationItem[] = items.map((item, index) => {
      const quantity = item.quantity || 1;
      const discount = 0;
      const tax = item.gst_tax_rate || 0;
      const amount = Math.round(
        (quantity * item.sales_price * (1 - discount / 100) * (1 + tax / 100)) * 100
      ) / 100;
      return {
        id: `item-${Date.now()}-${index}`,
        item_id: item.item_id,
        item_name: item.item_name,
        hsn_sac: item.hsn_code || "",
        quantity: quantity,
        price_per_item: item.sales_price,
        discount: discount,
        tax: tax,
        amount: amount,
        measuring_unit_id: item.measuring_unit_id,
      };
    });
    setQuotationItems([...quotationItems, ...newItems]);
    toast.success(`${items.length} item(s) added to quotation`);
  };

  const handleCreateNewItem = () => {
    setShowAddItemModal(false);
    setShowCreateItemModal(true);
  };

  const handleItemCreated = () => {
    setShowCreateItemModal(false);
    setShowAddItemModal(true);
  };

  const handleRemoveItem = (itemId: string) => {
    setQuotationItems(quotationItems.filter((item) => item.id !== itemId));
    toast.success("Item removed from quotation");
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    setQuotationItems(
      quotationItems.map((item) => {
        if (item.id === itemId) {
          const amount = Math.round(
            (newQuantity *
              item.price_per_item *
              (1 - item.discount / 100) *
              (1 + item.tax / 100)) * 100
          ) / 100;
          return { ...item, quantity: newQuantity, amount };
        }
        return item;
      }),
    );
  };

  const handleUpdateDiscount = (itemId: string, newDiscount: number) => {
    setQuotationItems(
      quotationItems.map((item) => {
        if (item.id === itemId) {
          const amount = Math.round(
            (item.quantity *
              item.price_per_item *
              (1 - newDiscount / 100) *
              (1 + item.tax / 100)) * 100
          ) / 100;
          return { ...item, discount: newDiscount, amount };
        }
        return item;
      }),
    );
  };

  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    setQuotationItems(
      quotationItems.map((item) => {
        if (item.id === itemId) {
          const baseAmount = item.quantity * newPrice;

          const discountedAmount =
            baseAmount * (1 - item.discount / 100);

          const totalAmount =
            discountedAmount * (1 + item.tax / 100);

          const amount = Math.round(totalAmount * 100) / 100;

          return {
            ...item,
            price_per_item: newPrice,
            amount,
          };
        }
        return item;
      })
    );
  };


  const handleUpdateTax = (itemId: string, newTax: number) => {
    setTax(newTax);
    setQuotationItems(
      quotationItems.map((item) => {
        if (item.id === itemId) {
          const amount = Math.round(
            (item.quantity *
              item.price_per_item *
              (1 - item.discount / 100) *
              (1 + newTax / 100)) * 100
          ) / 100;
          return { ...item, tax: newTax, amount };
        }
        return item;
      }),
    );
  };
  const calculateSubtotal = () => {
    return quotationItems.reduce((sum, item) => {
      const amount = Math.round(item.quantity * item.price_per_item * 100) / 100;
      return sum + amount;
    }, 0);
  };

  const calculateDiscount = () => {
    const total = quotationItems.reduce(
      (sum, item) =>
        sum + (item.quantity * item.price_per_item * item.discount) / 100,
      0
    );

    return Math.round(total * 100) / 100;
  };


  const calculateOverallDiscount = () => {
    const subtotal = calculateSubtotal();
    if (discount.type === "percentage") {
      return (subtotal * discount.value) / 100;
    } else {
      return discount.value;
    }
  };

  const calculateTax = () => {
    const totalTax = quotationItems.reduce((sum, item) => {
      const taxableAmount =
        item.quantity * item.price_per_item * (1 - item.discount / 100);

      return sum + (taxableAmount * item.tax) / 100;
    }, 0);

    return Math.round(totalTax * 100) / 100;
  };



  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTax();
  };

  const handleBackClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmLeave = () => {
    setShowConfirmModal(false);
    navigate(-1);
  };

  const handleCancelLeave = () => {
    setShowConfirmModal(false);
  };

  const handleSaveQuotation = async (navigateAfterSave = false) => {
    setIsSaving(true);
    try {
      // Calculate totals
      const subtotal = calculateSubtotal();
      const totalDiscount = calculateDiscount();
      const totalTax = calculateTax();
      const totalAmount = calculateTotal();

      // Prepare submission data
      const submissionData = {
        ...formData,
        selectedCustomer,
        quotationItems,
        notes,
        terms: termsAndConditions,
        subtotal,
        total_discount: totalDiscount,
        total_tax: totalTax,
        total_amount: totalAmount,
        created_at: new Date().toISOString(),
      };

      let response;
      if (isEditMode && id) {
        response = await updateQuotation(id, submissionData);
      } else {
        response = await createQuotation(submissionData);
      }

      if (response.success) {
        toast.success(isEditMode ? "Quotation updated successfully!" : "Quotation saved successfully!");

        if (isEditMode && id) {
          const invoiceResult = await updateInvoiceFromQuotation(id, submissionData);
          if (!invoiceResult.success) {
            toast.error(invoiceResult.error || "Failed to update linked invoice");
          }
        }

        if (navigateAfterSave) {
          navigate("/quotes/list");
        }

        return response.data;
      } else {
        toast.error(response.error || "Failed to save quotation");
        return null;
      }
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast.error("Failed to save quotation");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6 relative">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#1B84FF"
          />
        </div>
      )}
      {isAddressLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#1B84FF"
          />
        </div>
      )}
      {/* Header */}
      <div className="sticky top-[70px] z-60 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode ? "Edit Quotation" : "Create Quotation"}
          </h1>
        </div>
        <Button
          type="button"
          className="bg-[#1B84FF] hover:bg-[#0F6FE0] text-white gap-2 px-4 py-2 rounded-lg"
          disabled={isSaving}
          onClick={async () => {
            if (!selectedCustomer) {
              toast.error("Please select a customer");
              return;
            }

            if (quotationItems.length === 0) {
              toast.error("Please add at least one item");
              return;
            }

            if (isEditMode) {
              await handleSaveQuotation(true);
              return;
            }

            // Prepare quotation data
            const quotationData = {
              ...formData,
              selectedCustomer,
              quotationItems,
              notes,
              terms: termsAndConditions,
            };

            // Save quotation FIRST
            const savedQuotation = await handleSaveQuotation(false);

            if (!savedQuotation) return;

            // Navigate to preview AFTER save
            navigate("/quotes/preview", {
              state: {
                quotationData,
                quotationId: savedQuotation.uuid || savedQuotation.id,
              },
            });
          }}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Quotation"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pb-4">
        <div className="lg:col-span-4 bg-white border rounded-xl p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Bill To</h3>
              {selectedCustomer ? (
                <div className="border rounded-xl min-h-[180px] p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {selectedCustomer.first_name}{" "}
                        {selectedCustomer.last_name}
                      </h4>
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        {selectedCustomer.company_name && (
                          <p className="font-medium">
                            {selectedCustomer.company_name}
                          </p>
                        )}
                        {selectedCustomer.contact_person && (
                          <p>{selectedCustomer.contact_person}</p>
                        )}
                        <div className="mt-2 space-y-1">
                          {selectedCustomer.mobile && (
                            <p className="text-gray-600">
                              <span className="font-medium">Phone:</span>{" "}
                              {selectedCustomer.mobile}
                            </p>
                          )}
                          {selectedCustomer.email && (
                            <p className="text-gray-600">
                              <span className="font-medium">Email:</span>{" "}
                              {selectedCustomer.email}
                            </p>
                          )}
                          {selectedCustomer.gst && (
                            <p className="text-gray-600">
                              <span className="font-medium">GST:</span>{" "}
                              {selectedCustomer.gst}
                            </p>
                          )}
                          <div className="mt-2 space-y-1">
                            {selectedCustomer.address1 && (
                              <p className="text-gray-600">
                                <span className="font-medium">
                                  Billing Address 1:
                                </span>{" "}
                                {selectedCustomer.address1}
                              </p>
                            )}
                            {selectedCustomer.address2 && (
                              <p className="text-gray-600">
                                <span className="font-medium">
                                  Billing Address 2:
                                </span>{" "}
                                {selectedCustomer.address2}
                              </p>
                            )}
                            <div className="mt-2 text-sm text-gray-600 space-y-1">
                              <p>
                                {selectedCustomer.city && (
                                  <span>
                                    <span className="font-medium">City:</span>{" "}
                                    {selectedCustomer.city},{" "}
                                  </span>
                                )}
                                {selectedCustomer.state && (
                                  <span>
                                    <span className="font-medium">State:</span>{" "}
                                    {selectedCustomer.state},{" "}
                                  </span>
                                )}
                                {selectedCustomer.pin && (
                                  <span>
                                    <span className="font-medium">PIN:</span>{" "}
                                    {selectedCustomer.pin}
                                  </span>
                                )}
                                {selectedCustomer.country && (
                                  <span>
                                    ,{" "}
                                    <span className="font-medium">
                                      Country:
                                    </span>{" "}
                                    {selectedCustomer.country}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPartyDialogOpen(true)}
                      className="h-8"
                    >
                      Change Party
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] flex flex-col items-center justify-center bg-gray-50 p-4">
                  <Button
                    type="button"
                    onClick={() => setIsPartyDialogOpen(true)}
                    variant="outline"
                    className="gap-2 border-dashed text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Party
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Search and select a party
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Ship To</h3>
              {selectedCustomer ? (
                <div className="border rounded-xl h-[180px] p-4 bg-white overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="h-[150px] overflow-hidden">
                      {!selectedAddress && shippingAddresses.length === 0 ? (
                        <div>
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            {selectedCustomer.first_name}{" "}
                            {selectedCustomer.last_name}
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              Same as Billing
                            </span>
                          </h4>
                          <div className="mt-2 text-sm text-gray-700 space-y-1">
                            {selectedCustomer.company_name && (
                              <p className="font-medium">
                                {selectedCustomer.company_name}
                              </p>
                            )}
                            {selectedCustomer.contact_person && (
                              <p>{selectedCustomer.contact_person}</p>
                            )}
                            <div className="mt-2 space-y-1">
                              {selectedCustomer.mobile && (
                                <p className="text-gray-600">
                                  <span className="font-medium">Phone:</span>{" "}
                                  {selectedCustomer.mobile}
                                </p>
                              )}
                              {selectedCustomer.email && (
                                <p className="text-gray-600">
                                  <span className="font-medium">Email:</span>{" "}
                                  {selectedCustomer.email}
                                </p>
                              )}
                              {selectedCustomer.gst && (
                                <p className="text-gray-600">
                                  <span className="font-medium">GST:</span>{" "}
                                  {selectedCustomer.gst}
                                </p>
                              )}
                              <div className="mt-2 space-y-1">
                                {selectedCustomer.address1 && (
                                  <p className="text-gray-600">
                                    <span className="font-medium">
                                      Shipping Address 1:
                                    </span>{" "}
                                    {selectedCustomer.address1}
                                  </p>
                                )}
                                {selectedCustomer.address2 && (
                                  <p className="text-gray-600">
                                    <span className="font-medium">
                                      Shipping Address 2:
                                    </span>{" "}
                                    {selectedCustomer.address2}
                                  </p>
                                )}
                                <div className="mt-2 text-sm text-gray-600 space-y-1">
                                  <p>
                                    {selectedCustomer.city && (
                                      <span>
                                        <span className="font-medium">
                                          City:
                                        </span>{" "}
                                        {selectedCustomer.city},{" "}
                                      </span>
                                    )}
                                    {selectedCustomer.state && (
                                      <span>
                                        <span className="font-medium">
                                          State:
                                        </span>{" "}
                                        {selectedCustomer.state},{" "}
                                      </span>
                                    )}
                                    {selectedCustomer.pin && (
                                      <span>
                                        <span className="font-medium">
                                          PIN:
                                        </span>{" "}
                                        {selectedCustomer.pin}
                                      </span>
                                    )}
                                    {selectedCustomer.country && (
                                      <span>
                                        ,{" "}
                                        <span className="font-medium">
                                          Country:
                                        </span>{" "}
                                        {selectedCustomer.country}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : !selectedAddress ? (
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {selectedCustomer.first_name}{" "}
                            {selectedCustomer.last_name}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            No shipping address found
                          </p>
                          <p className="text-sm text-gray-500">
                            Click on "Add Address" to add a shipping address
                          </p>
                        </div>
                      ) : (
                        <div className="relative group" style={{ position: 'static' }}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {selectedCustomer.first_name}{" "}
                                {selectedCustomer.last_name}
                              </h4>
                              <div className="mt-2 text-sm text-gray-700 space-y-1">
                                {selectedCustomer.company_name && (
                                  <p className="font-medium">
                                    {selectedCustomer.company_name}
                                  </p>
                                )}
                                {selectedCustomer.contact_person && (
                                  <p>{selectedCustomer.contact_person}</p>
                                )}
                                <div className="mt-2 space-y-1">
                                  {selectedCustomer.mobile && (
                                    <p className="text-gray-600">
                                      <span className="font-medium">Phone:</span>{" "}
                                      {selectedCustomer.mobile}
                                    </p>
                                  )}
                                  {selectedCustomer.email && (
                                    <p className="text-gray-600">
                                      <span className="font-medium">Email:</span>{" "}
                                      {selectedCustomer.email}
                                    </p>
                                  )}
                                  {selectedCustomer.gst && (
                                    <p className="text-gray-600">
                                      <span className="font-medium">GST:</span>{" "}
                                      {selectedCustomer.gst}
                                    </p>
                                  )}
                                  <div className="mt-2 space-y-1">
                                    {selectedAddress.address1 && (
                                      <p className="text-gray-600">
                                        <span className="font-medium">
                                          Shipping Address 1:
                                        </span>{" "}
                                        {selectedAddress.address1}
                                      </p>
                                    )}
                                    {selectedAddress.address2 && (
                                      <p className="text-gray-600">
                                        <span className="font-medium">
                                          Shipping Address 2:
                                        </span>{" "}
                                        {selectedAddress.address2}
                                      </p>
                                    )}
                                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                                      <p>
                                        {selectedAddress.city && (
                                          <span>
                                            <span className="font-medium">
                                              City:
                                            </span>{" "}
                                            {selectedAddress.city},{" "}
                                          </span>
                                        )}
                                        {selectedAddress.state && (
                                          <span>
                                            <span className="font-medium">
                                              State:
                                            </span>{" "}
                                            {selectedAddress.state},{" "}
                                          </span>
                                        )}
                                        {selectedAddress.pin && (
                                          <span>
                                            <span className="font-medium">
                                              PIN:
                                            </span>{" "}
                                            {selectedAddress.pin}
                                          </span>
                                        )}
                                        {selectedAddress.country && (
                                          <span>
                                            ,{" "}
                                            <span className="font-medium">
                                              Country:
                                            </span>{" "}
                                            {selectedAddress.country}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsShippingModalOpen(true)}
                        className="text-xs h-7"
                      >
                        <MapPin className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                        Change Address
                      </Button>
                      {shippingAddresses.length < 3 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddAddressModalOpen(true)}
                          className="text-xs h-7"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                          Add Address
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] bg-gray-50 flex items-center justify-center p-4">
                  <p className="text-sm text-gray-400">
                    Shipping address will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Quotation Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Quotation No.</label>
              <Input
                name="quotationNo"
                value={formData.quotationNo}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Valid For (Days)</label>
              <Input
                type="number"
                name="validFor"
                value={formData.validFor === 0 ? "" : formData.validFor}
                onChange={handleChange}
                className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Quotation Date</label>
              <Input
                type="date"
                name="quotationDate"
                value={formData.quotationDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Validity Date</label>
              <Input
                type="date"
                name="validityDate"
                value={formData.validityDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Party Selection Dialog */}
        <Dialog open={isPartyDialogOpen} onOpenChange={setIsPartyDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-lg border border-gray-200 shadow-lg">
            <DialogHeader className="bg-white px-6 py-4 border-b">
              <DialogTitle className="text-lg font-semibold text-gray-800">
                Create Parties
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 space-y-5">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  placeholder="Search Parties by name or mobile..."
                  className="pl-10 h-10 rounded-md border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-400 focus-visible:ring-offset-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Party List */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {isCreatingParty ? (
                  <div className="p-5 space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Customer Name
                      </label>
                      <Input
                        placeholder="Enter customer name"
                        value={newPartyName}
                        onChange={(e) => setNewPartyName(e.target.value)}
                        autoFocus
                        className="h-11 rounded-lg border-gray-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCreatingParty(false)}
                        className="h-9 px-4 rounded-lg border-gray-300 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddParty}
                        disabled={!newPartyName.trim()}
                        className="h-9 px-4 rounded-md bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Add Party
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {filteredParties.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <UserPlus className="h-5 w-5 text-gray-600" />
                        </div>
                        <h3 className="mt-3 text-sm font-medium text-gray-900">
                          No Party found
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Get started by creating a new Party.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {filteredParties.map((party) => (
                          <li
                            key={party.id}
                            className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedParty?.id === party.id ? "bg-gray-100" : ""
                              }`}
                            onClick={() => handleSelectParty(party)}
                          >
                            <div className="flex items-center">
                              <div
                                className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${selectedParty?.id === party.id
                                  ? "bg-green-100"
                                  : "bg-gray-100"
                                  }`}
                              >
                                <span
                                  className={`font-medium text-sm ${selectedParty?.id === party.id
                                    ? "text-green-700"
                                    : "text-gray-600"
                                    }`}
                                >
                                  {party.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                                  {party.name}
                                </div>
                                {party.mobile && (
                                  <div className="text-sm text-gray-500 flex items-center mt-1">
                                    <span className="text-gray-400 mr-1.5">
                                      <svg
                                        className="h-3.5 w-3.5"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                      </svg>
                                    </span>
                                    {party.mobile}
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Create New Button */}
              {!isCreatingParty && (
                <Button
                  variant="outline"
                  className="w-full h-10 bg-white hover:bg-gray-50 border-gray-200 rounded-md text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-colors flex items-center justify-center"
                  onClick={() => {
                    setIsCustomerModalOpen(true);
                    setIsPartyDialogOpen(false);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create New Party
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Customer Creation Modal */}
        <ModalCustomer
          open={isCustomerModalOpen}
          onOpenChange={setIsCustomerModalOpen}
          customer={null}
          defaultStatus="4"
          title="Create Party"
          hideStatusField={true}
          hideSameAsBilling={true}
          onSuccess={(newCustomer?: any) => {
            setIsCustomerModalOpen(false);

            if (newCustomer && newCustomer.uuid) {
              const party = {
                id: newCustomer.uuid,
                uuid: newCustomer.uuid,
                name: `${newCustomer.first_name} ${newCustomer.last_name}`.trim(),
                balance: 0,
                mobile: newCustomer.mobile,
                customerData: newCustomer,
              };

              setParties(prev => [party, ...prev]);

              setSelectedParty(party);

              setSelectedCustomer(newCustomer);
              fetchCustomerData(newCustomer.uuid);
            } else {
              fetchParties();
            }
          }}
        />

        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="sm:max-w-[400px] p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Unsaved Changes
              </DialogTitle>
              <p className="text-sm text-gray-500">
                You have unsaved changes. Are you sure you want to leave this
                page?
              </p>
            </div>
            <DialogFooter className="mt-6 flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelLeave}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmLeave}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
              >
                Discard Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shipping Address Modal */}
        <Dialog open={isShippingModalOpen} onOpenChange={setIsShippingModalOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[70vh] overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100">
              <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Select Shipping Address
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-6 overflow-y-auto max-h-[calc(70vh-120px)]">
              {/* Existing Addresses */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <h3 className="text-sm font-semibold text-gray-700 px-3 whitespace-nowrap">
                    Saved Shipping Addresses
                  </h3>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <div className="space-y-3">
                  {shippingAddresses.length > 0 ? (
                    <div className="grid gap-3">
                      {shippingAddresses.map((address, index) => {
                        const isSelected = selectedAddress?.uuid === address.uuid || address.is_default;
                        return (
                          <div
                            key={address.uuid || index}
                            className={`group relative border rounded-lg p-3 cursor-pointer transition-all duration-200 ${isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            onClick={() => setSelectedAddress(address)}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${isSelected
                                  ? "bg-blue-100"
                                  : "bg-gray-100 group-hover:bg-gray-200"
                                  }`}
                              >
                                {address.address_type === "home" ? (
                                  <HomeIcon
                                    className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-600"}`}
                                  />
                                ) : address.address_type === "work" ? (
                                  <BriefcaseIcon
                                    className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-600"}`}
                                  />
                                ) : (
                                  <MapPinIcon
                                    className={`h-4 w-4 ${isSelected ? "text-red-600" : "text-red-500"}`}
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-900 capitalize flex items-center gap-2">
                                    {address.address_type}
                                    {address.is_default && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Default
                                      </span>
                                    )}
                                  </span>

                                  {/* Action Button */}
                                  <div className="relative" ref={address.uuid === activeDropdownUuid ? dropdownRef : null}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const uuid = address.uuid;

                                        if (!uuid) {
                                          console.error('Address UUID is missing:', address);
                                          return;
                                        }

                                        if (activeDropdownUuid === uuid) {
                                          setActiveDropdownUuid(null);
                                          setButtonPosition(null);
                                        } else {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setButtonPosition({
                                            top: rect.top,
                                            left: rect.right + 8
                                          });
                                          setActiveDropdownUuid(uuid);
                                        }
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100"
                                      aria-label="Address actions"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {activeDropdownUuid === address.uuid && (
                                      <div
                                        className="absolute right-full mr-2 top-0 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[100] animate-in slide-in-from-right-2 fade-in-0 duration-200"
                                      >
                                        <div className="py-1" role="menu">
                                          {!address.is_default && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetDefaultAddress();
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                            >
                                              <MapPin className="w-4 h-4 text-green-500" />
                                              <span>Set as Default</span>
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditAddress();
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600 flex items-center gap-2 transition-colors duration-150"
                                          >
                                            <Edit className="w-4 h-4" />
                                            <span>Edit</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteAddress();
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors duration-150"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Delete</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-700 leading-relaxed">
                                    <span className="font-medium text-gray-500">Address:</span> {[
                                      address.address1,
                                      address.address2
                                    ]
                                      .filter(Boolean)
                                      .join(", ")},
                                    <span className="font-medium text-gray-500"> State:</span> {address.state},
                                    <span className="font-medium text-gray-500"> Country:</span> {address.country}
                                  </p>
                                  <p className="text-xs text-gray-700 leading-relaxed">
                                    <span className="font-medium text-gray-500">City:</span> {address.city},
                                    <span className="font-medium text-gray-500"> Pin:</span> {address.pin}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 px-3 bg-gray-50 rounded-lg">
                      <div className="fixed top-0 left-0 right-0 bg-white px-6 py-4 z-40 shadow-sm flex items-center justify-between">
                        <MapPinIcon className="h-5 w-5 text-red-400" />
                      </div>
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        No saved addresses found
                      </p>
                      <p className="text-xs text-gray-500">
                        No shipping addresses available for this customer
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <DialogFooter className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => setIsShippingModalOpen(false)}
                  className="h-9 px-3 rounded-md border-gray-300 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (selectedAddress && selectedCustomer) {
                      setIsAddressLoading(true);
                      try {
                        // Call the API to update the customer with the selected shipping address
                        const payload = {
                          shipping_addresses: shippingAddresses.map(addr => ({
                            uuid: addr.uuid,
                            address1: addr.address1,
                            address2: addr.address2 || null,
                            city: addr.city,
                            state: addr.state,
                            country: addr.country,
                            pin: addr.pin,
                            address_type: addr.address_type,
                            is_default: addr.is_default,
                          })),
                        };

                        await axios.put(
                          `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
                          payload
                        );

                        // Update the selected customer with the new shipping address
                        const updatedCustomer: Customer = {
                          ...selectedCustomer,
                          shipping_address1: selectedAddress.address1,
                          shipping_address2: selectedAddress.address2 || "",
                          shipping_city: selectedAddress.city,
                          shipping_state: selectedAddress.state,
                          shipping_country: selectedAddress.country,
                          shipping_pin: selectedAddress.pin,
                        };
                        setSelectedCustomer(updatedCustomer);

                        setIsShippingModalOpen(false);
                        toast.success("Address changed successfully");
                      } catch (error: any) {
                        let errorMessage = "Failed to save shipping address. Please try again.";

                        if (error.response?.data?.error) {
                          errorMessage = error.response.data.error || errorMessage;
                        }

                        toast.error(errorMessage);
                      } finally {
                        setIsAddressLoading(false);
                      }
                    } else {
                      toast.error("Please select a shipping address");
                    }
                  }}
                  disabled={!selectedAddress}
                  className="h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  Confirm Selection
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>


      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/50">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-gray-800">
              Items/Services
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2 h-9 px-4 border-dashed hover:bg-blue-50 hover:border-blue-300 transition-colors"
                onClick={() => setShowAddItemModal(true)}
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-16">
                  NO
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  ITEMS/SERVICES
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">
                  HSN/SAC
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-28">
                  QTY
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-36">
                  PRICE/ITEM (₹)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-28">
                  DISCOUNT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-20">
                  TAX
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">
                  AMOUNT (₹)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-20">
                  <svg
                    className="h-5 w-5 mx-auto text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotationItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-center space-y-3">
                        <div className="flex justify-center items-center gap-3">
                          <button
                            onClick={() => setShowAddItemModal(true)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            Add Item
                          </button>
                        </div>
                        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end">
                          <div className="flex items-center gap-16">
                            <span className="text-sm text-gray-600">
                              SUBTOTAL
                            </span>
                            <span className="text-sm font-medium">₹ 0</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 h-9 px-4"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                                />
                              </svg>
                              Scan Barcode
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                quotationItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-sm text-gray-900">
                        {item.item_name}
                      </div>
                      {/* <div className="text-xs text-gray-500 mt-0.5">
                          {item.item_code}
                        </div> */}
                      <div className="text-gray-400 hover:text-gray-600">
                        <textarea
                          value={item.description || ""}
                          onChange={(e) => {
                            setQuotationItems(
                              quotationItems.map((quotationItem) => {
                                if (quotationItem.id === item.id) {
                                  return { ...quotationItem, description: e.target.value };
                                }
                                return quotationItem;
                              })
                            );
                          }}
                          placeholder="item description..."
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {item.hsn_sac || "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative flex focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent border border-gray-300 rounded-md">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onKeyDown={(e) => {
                            if (["-", "+", "e", "E"].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-0 rounded-l-md focus:outline-none"
                        />
                        <span className="px-3 py-1.5 bg-gray-100 text-sm text-gray-700 rounded-r-md border-l border-gray-300">
                          {getMeasuringUnit(item.measuring_unit_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={item.price_per_item}
                          onKeyDown={(e) => {
                            if (["-", "+", "e", "E"].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value))}
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute left-2 top-1.5 text-xs text-gray-500">₹</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 items-start relative">

                        {/* Discount % input */}
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount ?? 0}
                            onKeyDown={(e) => {
                              if (["-", "+", "e", "E"].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleUpdateDiscount(
                                item.id,
                                value === "" ? 0 : Math.min(100, parseFloat(value))
                              );
                            }}
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center
                                      [appearance:textfield]
                                      [&::-webkit-outer-spin-button]:appearance-none
                                      [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-gray-500">%</span>
                        </div>

                        {/* Calculated Discount Amount */}
                        {item.discount > 0 && (
                          <span className="text-xs text-red-600">
                            ₹{" "}
                            {(
                              (item.quantity * item.price_per_item * item.discount) / 100
                            ).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 items-start">

                        {/* GST % select */}
                        <select
                          value={item.tax}
                          onChange={(e) =>
                            handleUpdateTax(
                              item.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">None</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>

                        {/* Calculated GST amount */}
                        {item.tax > 0 && (
                          <span className="text-xs text-gray-600">
                            ₹{" "}
                            {(
                              (item.quantity *
                                item.price_per_item *
                                (1 - item.discount / 100) *
                                item.tax) /
                              100
                            ).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>


                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                      ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {quotationItems.length > 0 && (
          <div className="border-t bg-gray-50">
            <div className="grid grid-cols-[2fr_0.3fr_0.3fr_0.3fr] px-6 py-3 text-sm font-semibold text-gray-900">

              {/* Label */}
              <div className="text-left py-2">
                SUBTOTAL
              </div>

              {/* Discount */}
              <div className="text-right py-2">
                ₹ {calculateDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>

              {/* Tax */}
              <div className="text-center py-2">
                ₹ {calculateTax().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>

              {/* Total */}
              <div className="text-left py-2">
                ₹ {calculateTotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>

            </div>
          </div>
        )}

        {/* Add this section right after the Items/Services table closes and before the closing of the main grid div */}

        <div className="lg:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-4">
            <div>
              {!showNotesField ? (
                <button
                  onClick={() => setShowNotesField(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Notes
                </button>
              ) : (
                <div className="space-y-2 bg-white border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">Notes</label>
                    <button
                      onClick={() => {
                        setShowNotesField(false);
                        setNotes("");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes here..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div>
              {!showTermsField ? (
                <button
                  onClick={() => setShowTermsField(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Terms and Conditions
                </button>
              ) : (
                <div className="space-y-2 bg-white border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Terms and Conditions
                    </label>
                    <button
                      onClick={() => {
                        setShowTermsField(false);
                        setTermsAndConditions("");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    placeholder="Enter terms and conditions..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add New Account
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {quotationItems.length > 0 && (
              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="space-y-2">
                  {!showAdditionalChargesField ? (
                    <button
                      onClick={() => setShowAdditionalChargesField(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Additional Charges
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Charge name"
                          value={newChargeName}
                          onChange={(e) => setNewChargeName(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="relative w-28">
                          <span className="absolute left-3 top-2.5 text-sm text-gray-500">₹</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={newChargeAmount || ""}
                            onChange={(e) => setNewChargeAmount(parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleAddAdditionalCharge}
                          disabled={!newChargeName.trim() || newChargeAmount <= 0}
                          className="h-9"
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAdditionalChargesField(false);
                            setNewChargeName("");
                            setNewChargeAmount(0);
                          }}
                          className="h-9 w-9 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {additionalCharges.map((charge, index) => (
                    <div key={index} className="flex justify-between items-center text-sm py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700">{charge.name}</span>
                        <button
                          onClick={() => handleRemoveAdditionalCharge(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-medium">₹ {charge.amount.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm py-2 border-t border-gray-200">
                  <span className="text-gray-700 font-medium">Taxable Amount</span>
                  <span className="font-semibold">
                    ₹ {(calculateSubtotal() - calculateDiscount()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm py-2">
                  <span className="text-gray-700">SGST@{tax / 2}</span>
                  <span className="font-medium">
                    ₹ {(((calculateSubtotal() - calculateDiscount()) * (tax / 2) / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm py-2">
                  <span className="text-gray-700">CGST@{tax / 2}</span>
                  <span className="font-medium">
                    ₹ {(((calculateSubtotal() - calculateDiscount()) * (tax / 2) / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {!showDiscountField ? (
                  <button
                    onClick={() => setShowDiscountField(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Discount
                  </button>
                ) : (
                  <div className="flex justify-between items-center py-2 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">Discount:</span>
                      <select
                        value={discount.type}
                        onChange={(e) =>
                          setDiscount({ ...discount, type: e.target.value as "percentage" | "amount" })
                        }
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="percentage">%</option>
                        <option value="amount">₹</option>
                      </select>
                      <input
                        type="number"
                        value={discount.value || ""}
                        onChange={(e) =>
                          setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })
                        }
                        className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                      />
                      <button
                        onClick={() => {
                          setShowDiscountField(false);
                          setDiscount({ type: "percentage", value: 0 });
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-sm font-medium text-red-600">
                      - ₹ {calculateOverallDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* <div className="flex items-center justify-between py-3 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoRoundOff"
                      checked={autoRoundOff}
                      onChange={(e) => setAutoRoundOff(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="autoRoundOff" className="text-sm text-gray-700">
                      Auto Round Off
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-blue-600 text-sm font-medium">+ Add</button>
                    <select className="px-2 py-1 text-sm border border-gray-300 rounded-md w-14">
                      <option>₹</option>
                    </select>
                    <input
                      type="number"
                      value={roundOffAmount}
                      onChange={(e) => setRoundOffAmount(parseFloat(e.target.value) || 0)}
                      disabled={autoRoundOff}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md text-right disabled:bg-gray-100"
                    />
                  </div>
                </div> */}

                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                  <span className="text-base font-bold text-gray-800">Total Amount</span>
                  <span className="text-xl font-bold text-gray-900">
                    ₹ {calculateFinalTotal().toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white border rounded-lg p-5">
              <div className="space-y-3">
                <p className="text-sm text-gray-600 text-right">Authorized signatory for <span className="font-semibold">XYZ</span></p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Signature
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AddItemPage
        open={showAddItemModal}
        onOpenChange={setShowAddItemModal}
        onAddItems={handleAddItems}
        onCreateNewItem={handleCreateNewItem}
      />
      <CreateItemModal
        open={showCreateItemModal}
        onOpenChange={setShowCreateItemModal}
        onSuccess={handleItemCreated}
        item={null}
      />

      <ShippingAddressModal
        open={addAddressModalOpen}
        onOpenChange={(open) => {
          setAddAddressModalOpen(open);
          if (!open) {
            setEditingAddress(undefined);
          }
        }}
        address={editingAddress}
        onSave={handleAddAddress}
        existingAddresses={shippingAddresses}
        title={editingAddress ? "Edit Shipping Address" : "Add Shipping Address"}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-white">
            <DialogTitle className="text-base font-semibold text-gray-900">
              Delete Shipping Address
            </DialogTitle>
          </div>

          {/* Content */}
          <div className="px-6 py-4 bg-white">
            <DialogDescription className="text-sm text-gray-700">
              Are you sure you want to delete this shipping address?
            </DialogDescription>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelDelete}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none transition-colors"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CreateQuotationPage;
