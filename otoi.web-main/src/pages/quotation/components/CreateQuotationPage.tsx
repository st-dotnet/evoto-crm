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
  id?: string;
  type: "home" | "work" | "other";
  address1: string;
  address2?: string;
  city: string;
  state: string;
  country: string;
  pin: string;
  is_default?: boolean;
  created_at?: string;
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState<boolean>(false);
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null);
  const [newShippingAddress, setNewShippingAddress] = useState<Omit<ShippingAddress, "id" | "is_default" | "created_at">>({
    type: "home",
    address1: "",
    address2: "",
    city: "",
    state: "",
    country: "",
    pin: "",
  });

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
      let addresses: ShippingAddress[] = [];
      if (
        response.data.shipping_addresses &&
        Array.isArray(response.data.shipping_addresses)
      ) {
        addresses = response.data.shipping_addresses.map(
          (addr: any, index: number) => ({
            ...addr,
            id: addr.id || `api-${index}-${Date.now()}`,
          }),
        );
      } else {
        if (response.data.shipping_address1 || response.data.shipping_city) {
          addresses = [
            {
              id: `default-${Date.now()}`,
              type: "home",
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
      console.error("Error fetching customer:", error);
      toast.error("Failed to fetch customer details");
    } finally {
      setIsLoading(false);
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
                      {!selectedCustomer.shipping_address1 &&
                        !selectedCustomer.shipping_city ? (
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {selectedCustomer.first_name}{" "}
                            {selectedCustomer.last_name}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Same as Billing Address
                          </p>
                          <div className="mt-2 text-sm text-gray-600 space-y-1">
                            {selectedCustomer.address1 && (
                              <p>{selectedCustomer.address1}</p>
                            )}
                            {selectedCustomer.address2 && (
                              <p>{selectedCustomer.address2}</p>
                            )}
                            <p>
                              {[
                                selectedCustomer.city,
                                selectedCustomer.state,
                                selectedCustomer.pin,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {selectedCustomer.country && (
                              <p>{selectedCustomer.country}</p>
                            )}
                          </div>
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
                                {selectedCustomer.shipping_address1 && (
                                  <p className="text-gray-600">
                                    <span className="font-medium">
                                      Shipping Address 1:
                                    </span>{" "}
                                    {selectedCustomer.shipping_address1}
                                  </p>
                                )}
                                {selectedCustomer.shipping_address2 && (
                                  <p className="text-gray-600">
                                    <span className="font-medium">
                                      Shipping Address 2:
                                    </span>{" "}
                                    {selectedCustomer.shipping_address2}
                                  </p>
                                )}
                                <div className="mt-2 text-sm text-gray-600 space-y-1">
                                  <p>
                                    {selectedCustomer.shipping_city && (
                                      <span>
                                        <span className="font-medium">
                                          City:
                                        </span>{" "}
                                        {selectedCustomer.shipping_city},{" "}
                                      </span>
                                    )}
                                    {selectedCustomer.shipping_state && (
                                      <span>
                                        <span className="font-medium">
                                          State:
                                        </span>{" "}
                                        {selectedCustomer.shipping_state},{" "}
                                      </span>
                                    )}
                                    {selectedCustomer.shipping_pin && (
                                      <span>
                                        <span className="font-medium">
                                          PIN:
                                        </span>{" "}
                                        {selectedCustomer.shipping_pin}
                                      </span>
                                    )}
                                    {selectedCustomer.shipping_country && (
                                      <span>
                                        ,{" "}
                                        <span className="font-medium">
                                          Country:
                                        </span>{" "}
                                        {selectedCustomer.shipping_country}
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
                    {(selectedCustomer.shipping_address1 ||
                      selectedCustomer.shipping_city) && (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsShippingModalOpen(true)}
                            className="text-xs h-7"
                          >
                            <MapPin className="h-3.5 w-3.5 mr-1.5" />
                            Change Address
                          </Button>
                        </div>
                      )}
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

        <Dialog open={isPartyDialogOpen} onOpenChange={setIsPartyDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-lg border border-gray-200 shadow-lg">
            <DialogHeader className="bg-white px-6 py-4 border-b">
              <DialogTitle className="text-lg font-semibold text-gray-800">
                Create Parties
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-5">
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

        <Dialog
          open={isShippingModalOpen}
          onOpenChange={setIsShippingModalOpen}
        >
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden">
            <DialogHeader className="px-8 pt-8 pb-4 border-b border-gray-100">
              <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Select Shipping Address
              </DialogTitle>
            </DialogHeader>
            <div className="px-8 py-6 space-y-8 overflow-y-auto max-h-[calc(85vh-140px)]">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
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
                        const isSelected =
                          selectedAddress?.id === address.id ||
                          (selectedAddress && !selectedAddress.id && index === 0);
                        return (
                          <div
                            key={address.id || index}
                            className={`group relative border rounded-xl p-4 cursor-pointer transition-all duration-200 ${isSelected
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm"
                              : "border-gray-200 hover:border-gray-300 hover:shadow-sm hover:bg-gray-50"
                              }`}
                            onClick={() => setSelectedAddress(address)}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isSelected
                                  ? "bg-blue-100"
                                  : "bg-gray-100 group-hover:bg-gray-200"
                                  }`}
                              >
                                {address.type === "home" ? (
                                  <HomeIcon
                                    className={`h-5 w-5 ${isSelected
                                      ? "text-blue-600"
                                      : "text-gray-600"
                                      }`}
                                  />
                                ) : address.type === "work" ? (
                                  <BriefcaseIcon
                                    className={`h-5 w-5 ${isSelected
                                      ? "text-blue-600"
                                      : "text-gray-600"
                                      }`}
                                  />
                                ) : (
                                  <MapPinIcon
                                    className={`h-5 w-5 ${isSelected
                                      ? "text-blue-600"
                                      : "text-gray-600"
                                      }`}
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-gray-900 capitalize flex items-center gap-2">
                                    {address.type}
                                    {address.is_default && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Default
                                      </span>
                                    )}
                                  </span>
                                  {isSelected && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                                      <svg
                                        className="w-3 h-3 mr-1"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {[
                                    address.address1,
                                    address.address2,
                                    address.city,
                                    address.state,
                                    address.pin,
                                    address.country,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <MapPinIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        No saved addresses found
                      </p>
                      <p className="text-xs text-gray-500">
                        Add your first shipping address below
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">
                    ADD NEW ADDRESS
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Address Type
                    </label>
                    <div className="flex gap-3 mt-1">
                      {[
                        { label: "Home", value: "home", color: "blue" },
                        { label: "Work", value: "work", color: "purple" },
                        { label: "Other", value: "other", color: "gray" },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className={`relative inline-flex items-center px-4 py-2 rounded-lg border transition-colors cursor-pointer shadow-sm ${newShippingAddress.type === opt.value
                            ? "border-gray-400 bg-gray-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                            }`}
                          style={{ minWidth: 90, justifyContent: "center" }}
                        >
                          <input
                            type="radio"
                            name="addressType"
                            value={opt.value}
                            checked={
                              newShippingAddress.type === opt.value
                            }
                            onChange={() =>
                              setNewShippingAddress({
                                ...newShippingAddress,
                                type: opt.value as "home" | "work" | "other",
                              })
                            }
                            className="sr-only"
                          />
                          {opt.value === "home" && (
                            <svg
                              className="mr-2 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M3 10.5V21a1 1 0 001 1h5v-6h4v6h5a1 1 0 001-1V10.5M12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5L12 3z"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                          {opt.value === "work" && (
                            <svg
                              className="mr-2 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <rect x="2" y="7" width="20" height="13" rx="2" />
                              <path d="M16 3v4M8 3v4" />
                            </svg>
                          )}
                          {opt.value === "other" && (
                            <svg
                              className="mr-2 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 8v4l3 3" />
                            </svg>
                          )}
                          <span className="font-medium text-sm">
                            {opt.label}
                          </span>
                          {newShippingAddress.type === opt.value && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500"></span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Shipping Address 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors"
                      value={newShippingAddress.address1}
                      onChange={(e) =>
                        setNewShippingAddress({
                          ...newShippingAddress,
                          address1: e.target.value,
                        })
                      }
                      placeholder="Street address"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Shipping Address 2
                    </label>
                    <input
                      type="text"
                      className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors"
                      value={newShippingAddress.address2}
                      onChange={(e) =>
                        setNewShippingAddress({
                          ...newShippingAddress,
                          address2: e.target.value,
                        })
                      }
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Country<span className="text-red-500">*</span>
                    </label>
                    <select
                      {...shippingFormik.getFieldProps("country")}
                      onChange={(e) => {
                        shippingFormik.setFieldValue("country", e.target.value);
                        shippingFormik.setFieldValue("state", "");
                        shippingFormik.setFieldValue("city", "");
                      }}
                      className="input"
                    >
                      <option value="">--Select Country--</option>
                      {Country.getAllCountries().map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {shippingFormik.touched.country &&
                      shippingFormik.errors.country && (
                        <span role="alert" className="text-xs text-red-500">
                          {shippingFormik.errors.country}
                        </span>
                      )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      State<span className="text-red-500">*</span>
                    </label>
                    <select
                      {...shippingFormik.getFieldProps("state")}
                      onChange={(e) => {
                        shippingFormik.setFieldValue("state", e.target.value);
                        shippingFormik.setFieldValue("city", "");
                      }}
                      disabled={!shippingFormik.values.country}
                      className="input"
                    >
                      <option value="">--Select State--</option>
                      {shippingFormik.values.country &&
                        State.getStatesOfCountry(
                          shippingFormik.values.country,
                        ).map((s) => (
                          <option key={s.isoCode} value={s.isoCode}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    {shippingFormik.touched.state &&
                      shippingFormik.errors.state && (
                        <span role="alert" className="text-xs text-red-500">
                          {shippingFormik.errors.state}
                        </span>
                      )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      City<span className="text-red-500">*</span>
                    </label>
                    <select
                      {...shippingFormik.getFieldProps("city")}
                      disabled={!shippingFormik.values.state}
                      className="input"
                    >
                      <option value="">--Select City--</option>
                      {shippingFormik.values.country &&
                        shippingFormik.values.state &&
                        City.getCitiesOfState(
                          shippingFormik.values.country,
                          shippingFormik.values.state,
                        ).map((city) => (
                          <option key={city.name} value={city.name}>
                            {city.name}
                          </option>
                        ))}
                    </select>
                    {shippingFormik.touched.city &&
                      shippingFormik.errors.city && (
                        <span role="alert" className="text-xs text-red-500">
                          {shippingFormik.errors.city}
                        </span>
                      )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Pin Code <span style={{ color: "red" }}>*</span>
                    </label>
                    <input {...shippingFormik.getFieldProps("pin")} className="input" />
                    {shippingFormik.touched.pin &&
                      shippingFormik.errors.pin && (
                        <span role="alert" className="text-xs text-red-500">
                          {shippingFormik.errors.pin}
                        </span>
                      )}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsShippingModalOpen(false)}
                    className="h-10 px-4 rounded-md border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (
                        newShippingAddress.address1 &&
                        newShippingAddress.city &&
                        newShippingAddress.state &&
                        newShippingAddress.pin &&
                        newShippingAddress.country
                      ) {
                        const newAddress: ShippingAddress = {
                          ...newShippingAddress,
                          id: `new-${Date.now()}`,
                          is_default: shippingAddresses.length === 0,
                          created_at: new Date().toISOString(),
                        };
                        const updatedAddresses = [
                          ...shippingAddresses,
                          newAddress,
                        ];
                        setShippingAddresses(updatedAddresses);
                        setSelectedAddress(newAddress);
                        if (selectedCustomer) {
                          setSelectedCustomer({
                            ...selectedCustomer,
                            shipping_address1: newAddress.address1,
                            shipping_address2: newAddress.address2 || "",
                            shipping_city: newAddress.city,
                            shipping_state: newAddress.state,
                            shipping_country: newAddress.country,
                            shipping_pin: newAddress.pin,
                          });
                        }
                        setNewShippingAddress({
                          type: "home",
                          address1: "",
                          address2: "",
                          city: "",
                          state: "",
                          country: "",
                          pin: "",
                        });
                        if (updatedAddresses.length >= 3) {
                          setIsShippingModalOpen(false);
                        }
                      } else {
                        toast.error("Please fill in all required address fields");
                      }
                    }}
                    className="h-10 px-4 rounded-md bg-blue-600 hover:bg-blue-700"
                  >
                    Save Address
                  </Button>
                </div>
              </div>
            </div>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-24">
                    QTY
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">
                    PRICE/ITEM (₹)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-24">
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
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.item_code}
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
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            onKeyDown={(e) => {
                              if (["-", "+", "e", "E"].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleUpdateDiscount(item.id, value === "" ? 0 : parseFloat(value));

                            }}

                            className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-gray-500">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={item.tax}
                          onChange={(e) =>
                            handleUpdateTax(
                              item.id, 
                              parseFloat(e.target.value) || 0,
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
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                        ₹{item.amount.toLocaleString("en-IN")}
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
          {/* {quotationItems.length > 0 && (
            <div className="px-6 py-4 border-t bg-gray-50/30">
              <div className="flex justify-end">
                <div className="w-96 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">SUBTOTAL</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">₹</span>
                      <span className="font-semibold text-gray-900">
                        {calculateSubtotal().toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">DISCOUNT</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">₹</span>
                      <span className="font-semibold text-red-600">
                        {calculateDiscount().toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm pb-3 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">TAX</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">₹</span>
                      <span className="font-semibold text-gray-900">
                        {calculateTax().toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="text-base font-semibold text-gray-800">TOTAL</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">₹</span>
                      <span className="text-base font-bold text-gray-900">
                        {calculateTotal().toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )} */}
           {/* Add this section right after the Items/Services table closes and before the closing of the main grid div */}

        <div className="lg:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
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
                    ₹ {(calculateSubtotal() - calculateDiscount()).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm py-2">
                  <span className="text-gray-700">SGST@{tax/2}</span>
                  <span className="font-medium">
                    ₹ {(((calculateSubtotal() - calculateDiscount()) * (tax/2) / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm py-2">
                  <span className="text-gray-700">CGST@{tax/2}</span>
                  <span className="font-medium">
                    ₹ {(((calculateSubtotal() - calculateDiscount()) * (tax/2) / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* <div className="flex items-center justify-between py-3 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <label htmlFor="taxRate" className="text-sm text-gray-700">
                      GST Rate:
                    </label>
                    <select
                      id="taxRate"
                      value={tax}
                      onChange={(e) => handleGlobalTaxChange(parseFloat(e.target.value))}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div> */}

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
                      - ₹ {calculateOverallDiscount().toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-3 border-t border-gray-200">
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
                </div>

                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                  <span className="text-base font-bold text-gray-800">Total Amount</span>
                  <span className="text-xl font-bold text-gray-900">
                    ₹ {calculateFinalTotal().toLocaleString("en-IN")}
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
    </div>
  );
};

export default CreateQuotationPage;
