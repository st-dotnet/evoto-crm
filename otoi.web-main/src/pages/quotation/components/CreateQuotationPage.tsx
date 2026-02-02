import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ModalCustomer } from "@/pages/parties/blocks/customers/ModalCustomer";
import axios from "axios";
import { toast } from "sonner";
import AddItemPage from "./AdditemPage";
import CreateItemModal from "../../items/CreateItemModal";
import { DialogDescription } from "@radix-ui/react-dialog";
import { Value } from "@radix-ui/react-select";
import { ShippingAddressModal } from "@/pages/parties/blocks/customers/ShippingAddressModal";

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
  [key: string]: any;
}

interface ShippingAddress {
  uuid?: string;
  address_type: "home" | "work" | "other";
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  country: string;
  pin: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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
  item_code: string;
  hsn_sac?: string;
  quantity: number;
  price_per_item: number;
  discount: number;
  tax: number;
  amount: number;
  measuring_unit_id?: number;
}

interface InventoryItem {
  item_id: string;
  item_name: string;
  item_code: string;
  opening_stock: number;
  sales_price: number;
  purchase_price: number | null;
  type: string;
  category: string;
  hsn_code?: string | null;
  gst_tax_rate?: number;
  measuring_unit_id?: number;
}

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
  const today = new Date().toISOString().split("T")[0];
  const [isLoading, setIsLoading] = useState(false);

  // Formik for shipping address
  const shippingFormik = useFormik({
    initialValues: shippingAddressInitialValues,
    validationSchema: shippingAddressValidationSchema,
    onSubmit: (values) => {
      // console.log("Shipping address submitted:", values);
    },
  });

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
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(false);

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


  const shippingFormik = useFormik({
    initialValues: shippingAddressInitialValues,
    validationSchema: shippingAddressValidationSchema,
    onSubmit: (values) => {
      console.log("Shipping address submitted:", values);
    },
  });

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
      // console.error("Error fetching customer:", error);
      toast.error("Failed to fetch customer details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAddress = async (newAddress: ShippingAddress) => {
    if (!selectedCustomer?.uuid) {
      toast.error("No customer selected");
      return;
    }

    setIsAddressLoading(true);
    try {
      // Prepare the payload with the new shipping address
      const payload = {
        shipping_addresses: [...shippingAddresses, newAddress].map(addr => ({
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

      // Call the API to update the customer with the new address
      await axios.put(
        `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
        payload
      );

      // Update local state after successful API call
      const updatedAddresses = [...shippingAddresses, newAddress];
      setShippingAddresses(updatedAddresses);
      
      // Update the customer data with the new address
      const updatedCustomer = {
        ...selectedCustomer,
        shipping_addresses: updatedAddresses,
      };
      setSelectedCustomer(updatedCustomer);
      
      // If this is the first address or set as default, select it
      if (updatedAddresses.length === 1 || newAddress.is_default) {
        setSelectedAddress(newAddress);
      }
      
      toast.success("Address saved successfully.");
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
    const newItems: QuotationItem[] = items.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      item_id: item.item_id,
      item_name: item.item_name,
      item_code: item.item_code,
      hsn_sac: item.hsn_code || "",
      quantity: 1,
      price_per_item: item.sales_price,
      discount: 0,
      tax: item.gst_tax_rate || 0,
      amount: item.sales_price,
      measuring_unit_id: item.measuring_unit_id,
    }));
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
          const amount =
            newQuantity *
            item.price_per_item *
            (1 - item.discount / 100) *
            (1 + item.tax / 100);
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
          const amount =
            item.quantity *
            item.price_per_item *
            (1 - newDiscount / 100) *
            (1 + item.tax / 100);
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
          const amount =
            item.quantity *
            newPrice *
            (1 - item.discount / 100) *
            (1 + item.tax / 100);
          return { ...item, price_per_item: newPrice, amount };
        }
        return item;
      }),
    );
  };

  const handleUpdateTax = (itemId: string, newTax: number) => {
    setTax(newTax);
    setQuotationItems(
      quotationItems.map((item) => {
        if (item.id === itemId) {
          const amount =
            item.quantity *
            item.price_per_item *
            (1 - item.discount / 100) *
            (1 + newTax / 100);
          return { ...item, tax: newTax, amount };
        }
        return item;
      }),
    );
  };

  // Update all items' tax rates when global GST rate changes
  const handleGlobalTaxChange = (newTaxRate: number) => {
    
    setQuotationItems(
      quotationItems.map((item) => {
        const amount =
          item.quantity *
          item.price_per_item *
          (1 - item.discount / 100) *
          (1 + newTaxRate / 100);
        return { ...item, tax: newTaxRate, amount };
      }),
    );
  };

  const calculateSubtotal = () => {
    return quotationItems.reduce(
      (sum, item) => sum + item.quantity * item.price_per_item,
      0,
    );
  };

  const calculateDiscount = () => {
    return quotationItems.reduce(
      (sum, item) =>
        sum + (item.quantity * item.price_per_item * item.discount) / 100,
      0,
    );
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
    return quotationItems.reduce(
      (sum, item) =>
        sum +
        (item.quantity *
          item.price_per_item *
          (1 - item.discount / 100) *
          item.tax) /
        100,
      0,
    );
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">Create Quotation</h1>
        </div>
        <Button
          type="button"
          className="bg-[#1B84FF] hover:bg-[#0F6FE0] text-white gap-2 px-4 py-2 rounded-lg"
          onClick={() => {
            const submissionData = {
              ...formData,
              status: "win",
            };
          }}
        >
          <Save className="h-4 w-4" />
          Save Quotation
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
                <div className="border rounded-xl min-h-[180px] p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
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
          <div className="space-y-3">
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
                          className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedParty?.id === party.id ? "bg-gray-100" : ""
                          }`}
                          onClick={() => handleSelectParty(party)}
                        >
                          <div className="flex items-center">
                            <div
                              className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${
                                selectedParty?.id === party.id
                                  ? "bg-green-100"
                                  : "bg-gray-100"
                              }`}
                            >
                              <span
                                className={`font-medium text-sm ${
                                  selectedParty?.id === party.id
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

        <ModalCustomer
          open={isCustomerModalOpen}
          onOpenChange={setIsCustomerModalOpen}
          customer={null}
          defaultStatus="4"
          title="Create Party"
          hideStatusField={true}
          onSuccess={() => {
            setIsCustomerModalOpen(false);
            fetchParties();
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
                      const isSelected = selectedAddress?.uuid && address.uuid 
                        ? selectedAddress.uuid === address.uuid
                        : selectedAddress === address;
                      return (
                        <div
                          key={address.uuid || index}
                          className={`group relative border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedAddress(address)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                                isSelected
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
                  <div className="text-center py-8 px-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="mx-auto w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
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
                      console.error("Error saving shipping address:", error);
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

      {/* Add Address Modal */}
      <ShippingAddressModal
        open={addAddressModalOpen}
        onOpenChange={setAddAddressModalOpen}
        onSave={handleAddAddress}
        existingAddresses={shippingAddresses}
        title="Add Shipping Address"
      />

    </div>
  );
};

export default CreateQuotationPage;
