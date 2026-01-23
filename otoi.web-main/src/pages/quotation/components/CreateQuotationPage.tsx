import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Save, X, UserPlus, Search, MapPin, MapPinIcon, HomeIcon, BriefcaseIcon } from "lucide-react";
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
import { DialogDescription } from "@radix-ui/react-dialog";

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
  [key: string]: any; // For any additional fields
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

/* Date Utilities */
const addDays = (date: string | number | Date, days: number) => {
  if (!date) return "";
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

// Format address parts into a readable string
const formatAddress = (customer: any): string[] => {
  if (!customer) return [];

  const parts = [];

  // Add address lines
  if (customer.address1) parts.push(customer.address1);
  if (customer.address2) parts.push(customer.address2);

  // Format city, state, and pin code with proper commas
  const cityStatePostal = [customer.city, customer.state, customer.pin]
    .filter(Boolean)
    .join(", ");

  if (cityStatePostal) parts.push(cityStatePostal);

  // Add country if it exists
  if (customer.country) {
    parts.push(customer.country);
  }

  return parts;
};

const diffDays = (
  start: string | number | Date,
  end: string | number | Date,
) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(
    Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)),
    0,
  );
};

const CreateQuotationPage = () => {
  const navigate = useNavigate();

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
  const today = new Date().toISOString().split("T")[0];
  const [isLoading, setIsLoading] = useState(false);

  // Formik for shipping address
  const shippingFormik = useFormik({
    initialValues: shippingAddressInitialValues,
    validationSchema: shippingAddressValidationSchema,
    onSubmit: (values) => {
      console.log("Shipping address submitted:", values);
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
  const [newPartyName, setNewPartyName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isShippingModalOpen, setIsShippingModalOpen] =
    useState<boolean>(false);
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(
    [],
  );
  const [selectedAddress, setSelectedAddress] =
    useState<ShippingAddress | null>(null);
  const [newShippingAddress, setNewShippingAddress] = useState<
    Omit<ShippingAddress, "id" | "is_default" | "created_at">
  >({
    type: "home",
    address1: "",
    address2: "",
    city: "",
    state: "",
    country: "",
    pin: "",
  });

  /* Fetch Parties (Customers with status "4" - Win) */
  const fetchParties = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/customers/?items_per_page=1000`,
      );
      const customers = response.data.data;

      // Filter customers with status "4" (Win)
      const winCustomers = customers.filter(
        (customer: Customer) => customer.status === "4",
      );

      const partiesList = winCustomers.map((customer: Customer) => ({
        id: customer.uuid,
        uuid: customer.uuid,
        name: `${customer.first_name} ${customer.last_name}`.trim(),
        balance: 0,
        mobile: customer.mobile,
        customerData: customer, // Store the full customer data for address population
      }));

      setParties(partiesList);
    } catch {
      // console.error("Error fetching parties:", error);
      toast.error("Failed to fetch parties");
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  /* Auto-calculate validity date */
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

  /* Handlers */
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
        validityDate: prev.quotationDate
          ? addDays(prev.quotationDate, days)
          : "",
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* Party Handlers */
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

  /* Fetch Customer Data */
  const fetchCustomerData = async (customerUUID: string) => {
    if (!customerUUID) return;
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/customers/${customerUUID}`,
      );
      console.log("Customer API Response:", response.data);

      // Process shipping addresses from the API response
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
        // If no shipping addresses array, create one from flat fields if they exist
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

      // Set the most recent address as selected if available
      if (addresses.length > 0) {
        const defaultAddress =
          addresses.find((addr) => addr.is_default) || addresses[0];
        setSelectedAddress(defaultAddress);
      } else {
        setSelectedAddress(null);
      }

      // Create a customer data object with proper shipping address fields
      const customerData = {
        ...response.data,
        // Map shipping address fields, defaulting to billing address if shipping fields are not present
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

      console.log("Processed customer data with shipping:", customerData);
      setSelectedCustomer(customerData);
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast.error("Failed to fetch customer details");
    } finally {
      setIsLoading(false);
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
            // console.log('Submitting quotation:', submissionData);
          }}
        >
          <Save className="h-4 w-4" />
          Save Quotation
        </Button>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pb-4">
        {/* Bill / Ship */}
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

            {/* Ship To */}
            {/* Ship To Section */}
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

        {/* Quotation Details */}
        <div className="lg:col-span-1 bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Quotation Details
          </h3>
          <div className="space-y-3">
            {/* Quotation No */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Quotation No.</label>
              <Input
                name="quotationNo"
                value={formData.quotationNo}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            {/* Quotation Date */}
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
            {/* Valid For */}
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
            {/* Validity Date */}
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
        onSuccess={() => {
          setIsCustomerModalOpen(false);
          fetchParties();
        }}
      />

      {/* Confirmation Dialog */}
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
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-gray-100">
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Select Shipping Address
            </DialogTitle>
          </DialogHeader>

          <div className="px-8 py-6 space-y-8 overflow-y-auto max-h-[calc(85vh-140px)]">
            {/* Existing Addresses */}
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
                                  className={`h-5 w-5 ${isSelected ? "text-blue-600" : "text-gray-600"}`}
                                />
                              ) : address.type === "work" ? (
                                <BriefcaseIcon
                                  className={`h-5 w-5 ${isSelected ? "text-blue-600" : "text-gray-600"}`}
                                />
                              ) : (
                                <MapPinIcon
                                  className={`h-5 w-5 ${isSelected ? "text-blue-600" : "text-gray-600"}`}
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

            {/* Divider */}
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

            {/* New Address Form */}
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
                      { label: "Other", value: "other", color: "gray" }
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`relative inline-flex items-center px-4 py-2 rounded-lg border transition-colors cursor-pointer shadow-sm
                          ${newShippingAddress.type === opt.value
                            ? "border-gray-400 bg-gray-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"}
                        `}
                        style={{ minWidth: 90, justifyContent: 'center' }}
                      >
                        <input
                          type="radio"
                          name="addressType"
                          value={opt.value}
                          checked={newShippingAddress.type === opt.value}
                          onChange={() => setNewShippingAddress({ ...newShippingAddress, type: opt.value as "home" | "work" | "other" })}
                          className="sr-only"
                        />
                        {opt.value === "home" && (
                          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M3 10.5V21a1 1 0 001 1h5v-6h4v6h5a1 1 0 001-1V10.5M12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5L12 3z" strokeLinejoin="round" strokeLinecap="round" />
                          </svg>
                        )}
                        {opt.value === "work" && (
                          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="2" y="7" width="20" height="13" rx="2" />
                            <path d="M16 3v4M8 3v4" />
                          </svg>
                        )}
                        {opt.value === "other" && (
                          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4l3 3" />
                          </svg>
                        )}
                        <span className="font-medium text-sm">{opt.label}</span>
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
                  {shippingFormik.touched.country && shippingFormik.errors.country && (
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
                      State.getStatesOfCountry(shippingFormik.values.country).map((s) => (
                        <option key={s.isoCode} value={s.isoCode}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  {shippingFormik.touched.state && shippingFormik.errors.state && (
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
                        shippingFormik.values.state
                      ).map((city) => (
                        <option key={city.name} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                  </select>
                  {shippingFormik.touched.city && shippingFormik.errors.city && (
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
                  {shippingFormik.touched.pin && shippingFormik.errors.pin && (
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

                      // Update the selected customer with the new address
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

                      // Reset the form
                      setNewShippingAddress({
                        type: "home",
                        address1: "",
                        address2: "",
                        city: "",
                        state: "",
                        country: "",
                        pin: "",
                      });

                      // Close the modal if we have 3 addresses (max)
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
  );
};

export default CreateQuotationPage;
