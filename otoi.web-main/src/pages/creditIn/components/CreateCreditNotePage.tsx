import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Settings,
  Plus,
  Search,
  Barcode,
  ChevronDown,
  Trash2,
  X,
  UserPlus,
  MapPin,
  Briefcase,
  Home,
  MapPinIcon,
  HomeIcon,
  BriefcaseIcon,
  MoreVertical,
  Edit,
  FileText,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpinnerDotted } from "spinners-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import AddItemPage from "../../quotation/components/AdditemPage";
import CreateItemModal from "../../items/CreateItemModal";
import { ModalCustomer } from "@/pages/parties/blocks/customers/ModalCustomer";
import { ShippingAddressModal } from "@/pages/parties/blocks/customers/ShippingAddressModal";
import type { ShippingAddress } from "@/pages/parties/blocks/customers/customer-models";
import axios from "axios";
import { toast } from "sonner";
import {
  getCustomerNamesDropdown,
  getAllCustomersDropdown,
  getInvoicesForParty,
  createCreditNote,
  getCreditNoteById,
  updateCreditNote,
  getCreditNotes,
  getCustomerById,
  checkCreditNoteExistsForInvoice,
} from "../service/creditIn.service";
import { getInvoiceById } from "../../invoice/services/invoice.service";

interface Party {
  id: string;
  uuid: string;
  name: string;
  balance: number;
  mobile: string;
  customerData?: Customer;
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
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  billing_address?: any;
  shipping_address?: any;
  shipping_addresses?: ShippingAddress[];
  status?: string;
}

const CreateCreditNotePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = !!id && location.pathname.includes("/edit");
  const isViewMode = !!id && !location.pathname.includes("/edit");

  // Get invoice_id from URL parameters
  const urlParams = new URLSearchParams(location.search);
  const invoiceId = urlParams.get("invoice_id");
  const [items, setItems] = useState<any[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddItemPage, setShowAddItemPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPartyDialogOpen, setIsPartyDialogOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPartiesLoading, setIsPartiesLoading] = useState(false);
  const [isCreatingParty, setIsCreatingParty] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [creditNoteShippingAddressId, setCreditNoteShippingAddressId] =
    useState<string | null>(null);
  const [newPartyName, setNewPartyName] = useState("");
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(
    [],
  );
  const [selectedAddress, setSelectedAddress] =
    useState<ShippingAddress | null>(null);
  const [isShippingModalOpen, setIsShippingModalOpen] =
    useState<boolean>(false);
  const [addAddressModalOpen, setAddAddressModalOpen] =
    useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<
    ShippingAddress | undefined
  >();
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [activeDropdownUuid, setActiveDropdownUuid] = useState<string | null>(
    null,
  );
  const [buttonPosition, setButtonPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [partyInvoices, setPartyInvoices] = useState<any[]>([]);
  const [isInvoiceDropdownLoading, setIsInvoiceDropdownLoading] =
    useState(false);
  const [showUnlinkConfirmDialog, setShowUnlinkConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [creditNoteData, setCreditNoteData] = useState({
    creditNoteNo: "",
    creditNoteDate: new Date().toISOString().split("T")[0],
    linkToInvoice: "",
    status: "draft",
    subtotal: 0,
    total_discount: 0,
    total_tax: 0,
    taxableAmount: 0,
    round_off_amount: 0,
    totalAmount: 0,
    amountReceived: 0,
    balanceAmount: 0,
    markAsFullyPaid: false,
    autoRoundOff: false,
    notes: "",
    terms_and_conditions: "",
  });

  useEffect(() => {
    fetchParties();
  }, []);

  // Listen for credit note deletion events to refresh invoice dropdown
  useEffect(() => {
    const handleCreditNoteDeleted = (event: CustomEvent) => {
      // If there's a selected customer, refresh their invoices
      if (selectedCustomer) {
        fetchPartyInvoices();
      }
    };

    window.addEventListener(
      "creditNoteDeleted",
      handleCreditNoteDeleted as EventListener,
    );

    return () => {
      window.removeEventListener(
        "creditNoteDeleted",
        handleCreditNoteDeleted as EventListener,
      );
    };
  }, [selectedCustomer]);

  useEffect(() => {
    if (isPartyDialogOpen) {
      fetchParties();
    }
  }, [isPartyDialogOpen]);

  useEffect(() => {
    // Reset invoice dropdown when customer changes (only in create mode)
    setShowInvoiceDropdown(false);
    setPartyInvoices([]);
    if (!isEditMode) {
      setCreditNoteData((prev) => ({ ...prev, linkToInvoice: "" }));
    }
    // Reset credit note shipping address ID when customer changes
    setCreditNoteShippingAddressId(null);
  }, [selectedCustomer]);

  // Set shipping address if we have a credit note shipping address ID and customer data
  useEffect(() => {
    if (
      creditNoteShippingAddressId &&
      selectedCustomer?.shipping_addresses?.length
    ) {
      const foundAddress = selectedCustomer.shipping_addresses.find(
        (addr) => addr.uuid === creditNoteShippingAddressId,
      );
      if (foundAddress) {
        setSelectedAddress(foundAddress);
      } else {
        setSelectedAddress(null);
      }
    }
  }, [selectedCustomer, creditNoteShippingAddressId]);

  // Handle invoice_id parameter for creating credit note from invoice
  useEffect(() => {
    if (invoiceId && !isEditMode) {
      // When creating credit note from invoice, fetch invoice details and auto-select
      const handleInvoiceFromParam = async () => {
        try {
          const response = await getInvoiceById(invoiceId);
          if (response.success && response.data) {
            const invoice = response.data;

            // Set customer
            if (invoice.customer_id) {
              await fetchCustomerData(invoice.customer_id);
            }

            // Auto-select the invoice
            handleInvoiceSelect(invoice);
          }
        } catch (error) {
          toast.error("Failed to load invoice details");
        }
      };

      handleInvoiceFromParam();
    }
  }, [invoiceId, isEditMode]);

  // Fetch credit note data if in view/edit mode
  useEffect(() => {
    if (isEditMode && id) {
      handleFetchCreditNote(id);
    }
  }, [id, isEditMode]);

  // Handle shipping address selection change - hits API to update customer
  const handleAddressSelectionChange = async (
    selectedAddress: ShippingAddress,
  ) => {
    if (!selectedCustomer?.uuid || !selectedAddress) {
      return;
    }

    try {
      // Update all addresses to set the selected one as default
      const updatedAddresses = shippingAddresses.map((addr) => ({
        ...addr,
        is_default: addr.uuid === selectedAddress.uuid,
      }));

      // Prepare the payload
      const payload = {
        shipping_addresses: updatedAddresses.map((addr) => ({
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
        payload,
      );

      // Update local state
      setShippingAddresses(updatedAddresses);
      setSelectedAddress(selectedAddress);

      // Update customer data
      const updatedCustomer = {
        ...selectedCustomer,
        shipping_addresses: updatedAddresses,
      };
      setSelectedCustomer(updatedCustomer);
    } catch (error: any) {
      toast.error("Failed to update shipping address");
    }
  };

  // Simple handleAddAddress function for ShippingAddressModal
  const handleAddAddress = async (newAddress: ShippingAddress) => {
    if (!selectedCustomer?.uuid) {
      toast.error("No customer selected");
      return;
    }

    try {
      // Prepare the payload with the updated shipping addresses
      const updatedAddresses = editingAddress
        ? shippingAddresses.map((addr) =>
          addr.uuid === editingAddress.uuid ? newAddress : addr,
        )
        : [...shippingAddresses, newAddress];

      const payload = {
        shipping_addresses: updatedAddresses.map((addr) => ({
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
        payload,
      );

      // Update local state
      setShippingAddresses(updatedAddresses);

      // Update customer data
      const updatedCustomer = {
        ...selectedCustomer,
        shipping_addresses: updatedAddresses,
      };
      setSelectedCustomer(updatedCustomer);

      // Select the new/updated address if it's default or first address
      if (updatedAddresses.length === 1 || newAddress.is_default) {
        setSelectedAddress(newAddress);
      } else if (
        editingAddress &&
        selectedAddress?.uuid === editingAddress.uuid
      ) {
        setSelectedAddress(newAddress);
      }

      toast.success(
        editingAddress
          ? "Address updated successfully."
          : "Address added successfully.",
      );
      setAddAddressModalOpen(false);
      setEditingAddress(undefined);
    } catch (error: any) {
      toast.error("Failed to save address. Please try again.");
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Handle address dropdown
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdownUuid(null);
      }

      // Handle invoice dropdown
      if (
        !target.closest("#linkToInvoice") &&
        !target.closest(".invoice-dropdown")
      ) {
        setShowInvoiceDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdownUuid]);

  // Function to fetch invoices for the selected party
  const fetchPartyInvoices = async () => {
    if (!selectedCustomer) {
      setPartyInvoices([]);
      return;
    }

    setIsInvoiceDropdownLoading(true);
    try {
      const response = await getInvoicesForParty(selectedCustomer.uuid);

      if (response.success && response.data?.data) {
        // Backend now handles excluding invoices linked to credit notes
        const availableInvoices = response.data.data.filter((invoice: any) => {
          const belongsToSelectedCustomer =
            invoice.vendor_id === selectedCustomer.uuid ||
            invoice.customer_id === selectedCustomer.uuid ||
            invoice.party_id === selectedCustomer.uuid ||
            invoice.vendor_uuid === selectedCustomer.uuid ||
            invoice.customer_uuid === selectedCustomer.uuid;

          return (
            belongsToSelectedCustomer && invoice.payment_status !== "refunded"
          );
        });
        setPartyInvoices(availableInvoices);
        setShowInvoiceDropdown(true);
      } else {
        setPartyInvoices([]);
        setShowInvoiceDropdown(true); // Show dropdown even when no invoices to display message
      }
    } catch (error) {
      setPartyInvoices([]);
      setShowInvoiceDropdown(false);
    } finally {
      setIsInvoiceDropdownLoading(false);
    }
  };

  // Function to fetch credit note data for view/edit modes
  const handleFetchCreditNote = async (creditNoteId: string) => {
    setIsLoading(true);
    try {
      const response = await getCreditNoteById(creditNoteId);
      if (response.success && response.data) {
        const data = response.data.data; // API returns nested data structure

        const linkToInvoiceValue =
          data.invoice_number || data.invoice_no || data.invoice_id || "";

        // Set form data - use proper backend fields directly, no fallback logic needed
        const newCreditNoteData = {
          creditNoteNo: data.credit_note_number || "",
          creditNoteDate:
            data.credit_note_date || new Date().toISOString().split("T")[0],
          linkToInvoice: linkToInvoiceValue,
          status: data.status || "draft",
          // Use backend fields directly - no more fallback to balance_amount
          subtotal: data.subtotal || 0,
          total_discount: data.discount_total || data.total_discount || 0,
          total_tax: data.tax_total || data.total_tax || 0,
          totalAmount: data.total_amount || 0,
          taxableAmount: data.charges?.taxable_amount || 0,
          round_off_amount: data.round_off || data.round_off_amount || 0,
          amountReceived: data.amount_received || 0,
          balanceAmount: data.balance_amount || 0,
          markAsFullyPaid: data.mark_as_fully_paid || false,
          autoRoundOff: data.auto_round_off || false,
          notes: data.notes || "",
          terms_and_conditions: data.terms_and_conditions || "",
        };

        setCreditNoteData(newCreditNoteData);

        // Set customer if available - fetch complete customer data with shipping addresses
        if (data.customer_id) {
          try {
            await fetchCustomerData(data.customer_id);

            // Set shipping address ID if available in credit note data
            if (data.shipping_address_id) {
              setCreditNoteShippingAddressId(data.shipping_address_id);
            }
          } catch (error) {
            // Fallback to minimal customer object
            const fallbackCustomer = {
              uuid: data.customer_id,
              first_name:
                data.customer_name?.split(" ")[0] || data.customer_name || "",
              last_name:
                data.customer_name?.split(" ").slice(1).join(" ") || "",
              company_name: data.customer_name || "",
              name: data.customer_name || "",
              mobile: "",
            };
            setSelectedCustomer(fallbackCustomer);
          }
        }

        // Set items if available
        // Set shipping address if available - this needs to be done after customer is set
        if (data.shipping_address_id) {
          // We'll handle this in a useEffect that watches for selectedCustomer changes
        }

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          // Only fetch original invoice quantities for linked credit notes
          let originalInvoiceQuantities: Record<string, number> = {};
          if (data.invoice_id) {
            try {
              const invoiceResponse = await getInvoiceById(data.invoice_id);
              if (invoiceResponse.success && invoiceResponse.data?.items) {
                invoiceResponse.data.items.forEach((invoiceItem: any) => {
                  originalInvoiceQuantities[invoiceItem.item_id] =
                    invoiceItem.quantity;
                });
              }
            } catch (invoiceError) {
              // Continue without original quantities if fetch fails
            }
          }

          const transformedItems = data.items.map((item: any) => {
            const originalQtyValue = data.invoice_id
              ? originalInvoiceQuantities[item.item_id] || item.quantity
              : undefined;
            const transformed = {
              id: item.uuid || item.id,
              item_id: item.item_id,
              item_name: item.item_name, // Backend returns item_name
              hsnSac: item.hsn_sac_code, // Unify field name to hsnSac
              quantity: item.quantity,
              originalQty: originalQtyValue, // Set for all linked credit notes
              price_per_item: item.unit_price,
              discount: item.discount?.discount_percentage || 0,
              tax: item.tax?.tax_percentage || 0,
              amount:
                item.quantity *
                item.unit_price *
                (1 - (item.discount?.discount_percentage || 0) / 100) *
                (1 + (item.tax?.tax_percentage || 0) / 100), // Calculate amount with tax
              description: item.description || "",
            };
            return transformed;
          });
          setItems(transformedItems);

          // Recalculate totals after setting items to ensure consistency
          recalculateTotals(transformedItems);
        } else {
          // No items - use backend data directly, no recalculation needed
          setItems([]); // Ensure items is empty array

          // Backend now provides all fields correctly, no need to recalculate
        }

        // If linked to invoice, fetch invoice details (only if needed for additional data)
        // Note: Invoice data is already fetched above in the process
      } else {
        toast.error(response.error || "Failed to fetch credit note");
        navigate("/sales/credit-note");
      }
    } catch (error: any) {
      toast.error("Failed to fetch credit note");
      navigate("/sales/credit-note");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to recalculate totals
  const recalculateTotals = (updatedItems: any[]) => {
    // If there are no items, preserve the existing balance amount
    if (updatedItems.length === 0) {
      // Don't recalculate to 0, keep existing values
      return;
    }

    const subtotal = updatedItems.reduce(
      (sum: number, item: any) => sum + item.quantity * item.price_per_item,
      0,
    );
    const totalDiscount = updatedItems.reduce(
      (sum: number, item: any) =>
        sum + (item.quantity * item.price_per_item * item.discount) / 100,
      0,
    );
    const totalTax = updatedItems.reduce(
      (sum: number, item: any) =>
        sum +
        (item.quantity *
          item.price_per_item *
          (1 - item.discount / 100) *
          item.tax) /
        100,
      0,
    );

    // Calculate total amount consistently from components, not from item.amount
    const netAmount = subtotal - totalDiscount + totalTax;
    let totalAmount = netAmount;

    // Apply round-off if enabled
    let roundOffAmount = 0;

    if (creditNoteData.autoRoundOff) {
      const roundedAmount = Math.round(totalAmount);
      roundOffAmount = roundedAmount - totalAmount;
      totalAmount = roundedAmount;
    }

    // Round all monetary values to 2 decimal places to fix precision issues
    const roundedSubtotal = Math.round(subtotal * 100) / 100;
    const roundedTotalDiscount = Math.round(totalDiscount * 100) / 100;
    const roundedTotalTax = Math.round(totalTax * 100) / 100;
    const roundedTotalAmount = Math.round(totalAmount * 100) / 100;
    const roundedRoundOffAmount = Math.round(roundOffAmount * 100) / 100;

    // Calculate balance amount
    const balanceAmount = roundedTotalAmount - (creditNoteData.amountReceived || 0);

    setCreditNoteData((prev) => {
      const newData = {
        ...prev,
        subtotal: roundedSubtotal,
        total_discount: roundedTotalDiscount,
        total_tax: roundedTotalTax,
        totalAmount: roundedTotalAmount,
        round_off_amount: roundedRoundOffAmount,
        balanceAmount: balanceAmount,
      };
      return newData;
    });
  };

  // Function to handle invoice selection
  const handleInvoiceSelect = async (invoice: any) => {
    // Only check for existing credit notes when creating, not editing
    if (!isEditMode) {
      try {
        const checkResponse = await checkCreditNoteExistsForInvoice(
          invoice.uuid,
        );
        if (checkResponse.success && checkResponse.data.hasCreditNote) {
          toast.error(
            `A credit note already exists for invoice ${invoice.invoice_number}. Only one credit note allowed per invoice. Please edit the existing credit note.`,
          );
          return;
        }
      } catch (error) {
        // Allow proceeding if check fails (fail-safe)
      }
    }

    setCreditNoteData((prev) => ({
      ...prev,
      linkToInvoice: invoice.invoice_number,
    }));
    setShowInvoiceDropdown(false);

    // Use uuid as the ID field
    const invoiceId = invoice.uuid;

    if (!invoiceId) {
      toast.error("Invalid invoice data - missing ID");
      return;
    }

    // Fetch invoice details to get items
    try {
      const response = await getInvoiceById(invoiceId);

      if (
        response.success &&
        response.data?.items &&
        response.data.items.length > 0
      ) {
        // Transform invoice items to credit note items format
        const transformedItems = response.data.items.map((item: any) => ({
          id: item.uuid || Date.now().toString() + Math.random(), // Use existing UUID or generate temporary ID
          item_id: item.item_id,
          item_name: item.product_name, // Use item_name consistently
          hsnSac: item.hsn_sac_code, // Use hsnSac consistently
          quantity: item.quantity, //  quantity
          originalQty: item.quantity, // Store original quantity for validation for all linked invoices
          price_per_item: item.unit_price, // UI expects price_per_item
          discount: item.discount?.discount_percentage || 0, // API returns discount_percentage directly
          tax: item.tax?.tax_percentage || 0, // API returns tax_percentage directly
          amount:
            item.quantity *
            item.unit_price *
            (1 - (item.discount?.discount_percentage || 0) / 100) *
            (1 + (item.tax?.tax_percentage || 0) / 100), // Calculate amount with tax
          measuring_unit_id: item.measuring_unit_id,
          description: item.description || null,
        }));

        setItems(transformedItems);

        setCreditNoteData((prev) => ({
          ...prev,
          linkToInvoice: invoice.invoice_number,
          linkToInvoiceId: invoice.uuid, // Store the actual invoice ID
        }));

        // Recalculate totals immediately to ensure correct calculation
        recalculateTotals(transformedItems);

        toast.success(
          `Items from invoice ${invoice.invoice_number} loaded successfully`,
        );
      } else {
        toast.error("No items found in this invoice");
      }
    } catch (error) {
      toast.error("Failed to load invoice items");
    }
  };

  const handleAddItem = () => {
    setShowAddItemPage(true);
  };

  const handleAddItemModal = () => {
    setShowAddItemModal(true);
    setShowAddItemPage(false);
  };

  const handleRemoveItem = (id: string) => {
    const newItems = items.filter((item) => item.id !== id);
    setItems(newItems);
    recalculateTotals(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    const currentItem = updatedItems[index];
    const item = { ...currentItem, [field]: value };

    // Validate quantity doesn't exceed original invoice quantity
    if (field === "quantity" && item.originalQty) {
      const newQuantity = parseFloat(value) || 0;
      if (newQuantity > item.originalQty) {
        toast.error(
          `Quantity cannot exceed original invoice quantity (${item.originalQty})`,
        );
        return; // Don't update if quantity exceeds original
      }
      if (newQuantity < 0) {
        toast.error("Quantity cannot be negative");
        return;
      }
    }

    // Recalculate amount when quantity, price, discount, or tax changes
    if (["quantity", "price_per_item", "discount", "tax"].includes(field)) {
      // Use the updated values from the item object, not the old values
      const quantity = parseFloat(item.quantity) || 0;
      const pricePerItem = parseFloat(item.price_per_item) || 0;
      const discount = parseFloat(item.discount) || 0;
      const tax = parseFloat(item.tax) || 0;

      item.amount = quantity * pricePerItem * (1 - discount / 100) * (1 + tax / 100);
    }

    updatedItems[index] = item;
    setItems(updatedItems);
    recalculateTotals(updatedItems);
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

  const handleCreateNewParty = () => {
    setIsPartyDialogOpen(false);
    setIsCustomerModalOpen(true);
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

      // Create customer data object (similar to CreateQuotationPage)
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

  // Handle edit address
  const handleEditAddress = () => {
    if (activeDropdownUuid) {
      const addressToEdit = shippingAddresses.find(
        (addr) => addr.uuid === activeDropdownUuid,
      );
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
        shipping_addresses: updatedAddresses.map((addr) => ({
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
        payload,
      );

      // Update local state
      setShippingAddresses(updatedAddresses);

      const defaultAddress = shippingAddresses.find(
        (addr) => addr.uuid === targetUuid,
      );
      if (defaultAddress) {
        setSelectedAddress({ ...defaultAddress, is_default: true });
      }

      toast.success("Default address updated successfully.");
    } catch (error) {
      toast.error("Failed to update default address.");
    } finally {
      setIsAddressLoading(false);
    }
  };

  // Handle delete address
  const handleDeleteAddress = () => {
    if (activeDropdownUuid) {
      const addressToDelete = shippingAddresses.find(
        (addr) => addr.uuid === activeDropdownUuid,
      );
      if (addressToDelete) {
        // For now, just show a toast - you can add confirmation dialog later
        toast.info("Delete functionality can be added later");
      }
    }
    setActiveDropdownUuid(null);
  };

  const fetchParties = async () => {
    setIsPartiesLoading(true);
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
    } finally {
      setIsPartiesLoading(false);
    }
  };

  const handleScanBarcode = () => {
    // Handle barcode scanning functionality
  };

  const handleAddSignature = () => {
    // Handle add signature functionality
  };

  const handleAddAdditionalCharges = () => {
    // Handle add additional charges
  };

  const handleAddDiscount = () => {
    // Handle add discount
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    // Only check for existing credit notes when creating, not editing
    if (!isEditMode && creditNoteData.linkToInvoice) {
      try {
        const checkResponse = await checkCreditNoteExistsForInvoice(
          creditNoteData.linkToInvoice,
        );
        if (checkResponse.success && checkResponse.data.hasCreditNote) {
          toast.error(
            `A credit note already exists for invoice ${creditNoteData.linkToInvoice}. Only one credit note allowed per invoice. Please edit the existing credit note.`,
          );
          setIsSaving(false);
          return;
        }
      } catch (error) {
        toast.error(
          "Unable to verify credit note status. Cannot proceed for safety.",
        );
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);

    try {
      // Transform items to match backend API expectations
      const transformedItems = items.map((item) => ({
        id: item.id || crypto.randomUUID(), // Generate ID if not present
        item_id: item.item_id,
        item_name: item.item_name || item.item || "", // Support both field names during transition
        quantity: item.quantity, // Use correct property name
        price_per_item: item.price_per_item || 0, // Use correct property name
        amount: item.amount, // Use 'amount' instead of 'total_price'
        discount: item.discount,
        tax: item.tax,
      }));

      // Determine status based on checkbox and invoice linking
      let finalStatus = creditNoteData.status || "draft";
      if (isEditMode && creditNoteData.markAsFullyPaid && creditNoteData.status !== 'refunded') {
        finalStatus = 'refunded';
      } else if (!isEditMode && creditNoteData.linkToInvoice) {
        finalStatus = 'refunded';
      } else if (!isEditMode) {
        finalStatus = 'unpaid';
      }

      const creditNotePayload = {
        creditNoteNo: creditNoteData.creditNoteNo,
        creditNoteDate: creditNoteData.creditNoteDate,
        linkToInvoice: creditNoteData.linkToInvoice,
        status: finalStatus,
        selectedCustomer: selectedCustomer,
        creditNoteItems: transformedItems,
        notes: creditNoteData.notes || "",
        terms: creditNoteData.terms_and_conditions || "",
        auto_round_off: creditNoteData.autoRoundOff || false,
        total_amount: creditNoteData.totalAmount || 0,
        subtotal: creditNoteData.subtotal || 0,
        total_discount: creditNoteData.total_discount || 0,
        total_tax: creditNoteData.total_tax || 0,
        taxable_amount: creditNoteData.taxableAmount || 0,
        round_off_amount: creditNoteData.round_off_amount || 0,
        // Add fully paid fields if checkbox is checked
        ...(isEditMode && creditNoteData.markAsFullyPaid && creditNoteData.status !== 'refunded' && {
          amount_received: creditNoteData.totalAmount,
          balance_amount: 0
        })
      };

      let response;
      if (isEditMode && id) {
        // Update existing credit note
        response = await updateCreditNote(id, creditNotePayload);
      } else {
        // Create new credit note
        response = await createCreditNote(creditNotePayload);
      }

      if (response.success) {
        // Show appropriate success message
        if (isEditMode && creditNoteData.markAsFullyPaid && creditNoteData.status !== 'refunded') {
          toast.success('Credit note marked as fully refunded and updated successfully');
        } else {
          const successMessage = isEditMode
            ? "Credit note updated successfully"
            : "Credit note created successfully";
          toast.success(successMessage);
        }

        // Update local state if marked as fully paid
        if (isEditMode && creditNoteData.markAsFullyPaid && creditNoteData.status !== 'refunded') {
          setCreditNoteData(prev => ({
            ...prev,
            status: 'refunded',
            amountReceived: prev.totalAmount,
            balanceAmount: 0
          }));
        }

        // Dispatch event to notify invoice list about credit note changes
        window.dispatchEvent(
          new CustomEvent("creditNoteUpdated", {
            detail: {
              creditNoteId: isEditMode ? id : response.data?.uuid,
              action: isEditMode ? "updated" : "created",
              invoiceId:
                response.data?.invoice_id || creditNoteData.linkToInvoice,
            },
          }),
        );

        navigate("/sales/credit-note");
      } else {
        // Handle specific validation errors for mark as fully paid
        if (isEditMode && creditNoteData.markAsFullyPaid) {
          if (response.error?.includes('already marked as fully refunded')) {
            toast.error('This credit note is already marked as fully refunded');
            // Revert checkbox on error
            setCreditNoteData(prev => ({ ...prev, markAsFullyPaid: false }));
          } else if (response.error?.includes('Amount received must equal total amount')) {
            toast.error('Amount received must equal total amount to mark as fully refunded');
            // Revert checkbox on error
            setCreditNoteData(prev => ({ ...prev, markAsFullyPaid: false }));
          } else if (response.error?.includes('Cannot change status from')) {
            toast.error('Cannot change status from refunded (fully paid)');
            // Revert checkbox on error
            setCreditNoteData(prev => ({ ...prev, markAsFullyPaid: false }));
          } else {
            toast.error(response.error || 'Failed to save credit note');
          }
        } else {
          const errorMessage = isEditMode
            ? "Failed to update credit note"
            : "Failed to create credit note";
          toast.error(response.error || errorMessage);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create credit note");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#3b82f6"
          />
        </div>
      )}
      {isAddressLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#3b82f6"
          />
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/sales/credit-note")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold">
              {isViewMode
                ? "View Credit Note"
                : isEditMode
                  ? "Edit Credit Note"
                  : "Create Credit Note"}
            </h1>
          </div>
          <div className="w-full sm:w-auto">
            {!isViewMode && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{isEditMode ? "Updating..." : "Creating..."}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center">
                    <FileText className="h-4 w-4" />
                    <span>{isEditMode ? "Update" : "Create"} Credit Note</span>
                  </div>
                )}
              </Button>
            )}
            {isViewMode && (
              <Button
                onClick={() => navigate(`/sales/credit-note/${id}/edit`)}
                className="w-full sm:min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Credit Note
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Top Section: Bill To, Ship To, and Credit Note Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:col-span-2">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-800">Bill To</h3>
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
                    >
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex items-center justify-center bg-gray-50/50">
                  <button
                    onClick={() => setIsPartyDialogOpen(true)}
                    className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 transition-all hover:scale-105"
                  >
                    <div className="p-2 border border-blue-200 rounded-lg bg-white shadow-sm">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="font-semibold">Add Party</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-800">Ship To</h3>
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
                            </div>
                          </div>
                          <div className="mt-1 space-y-1">
                            {selectedAddress.address1 && (
                              <p className="text-gray-600 text-sm">
                                <span className="font-medium">
                                  Shipping Address 1:
                                </span>{" "}
                                {selectedAddress.address1}
                              </p>
                            )}
                            {selectedAddress.address2 && (
                              <p className="text-gray-600 text-sm">
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
                                    <span className="font-medium">City:</span>{" "}
                                    {selectedAddress.city},{" "}
                                  </span>
                                )}
                                {selectedAddress.state && (
                                  <span>
                                    <span className="font-medium">State:</span>{" "}
                                    {selectedAddress.state},{" "}
                                  </span>
                                )}
                                {selectedAddress.pin && (
                                  <span>
                                    <span className="font-medium">PIN:</span>{" "}
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
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex items-center justify-center bg-gray-50/50">
                  <p className="text-sm font-medium text-gray-400">
                    Shipping address will appear here
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Credit Note Details */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-800">
              Credit Note Details
            </h3>
            <div className="border rounded-xl min-h-[180px] p-4 bg-white">
              <CardContent className="space-y-4 p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="creditNoteNo"
                      className="block text-sm font-medium mb-1"
                    >
                      Credit Note No:
                    </label>
                    <Input
                      id="creditNoteNo"
                      value={creditNoteData.creditNoteNo}
                      onChange={(e) =>
                        setCreditNoteData({
                          ...creditNoteData,
                          creditNoteNo: e.target.value,
                        })
                      }
                      placeholder="auto-generated"
                      disabled={isViewMode}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="creditNoteDate"
                      className="block text-sm font-medium mb-1"
                    >
                      Credit Note Date:
                    </label>
                    <Input
                      id="creditNoteDate"
                      type="date"
                      value={creditNoteData.creditNoteDate}
                      onChange={(e) =>
                        setCreditNoteData({
                          ...creditNoteData,
                          creditNoteDate: e.target.value,
                        })
                      }
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                {/* Invoice Link Field */}
                <div>
                  <label
                    htmlFor="linkToInvoice"
                    className="block text-sm font-medium mb-1"
                  >
                    Link to Invoice:
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="linkToInvoice"
                      placeholder={
                        selectedCustomer
                          ? "Click to search invoices"
                          : "Select a Invoice first"
                      }
                      value={creditNoteData.linkToInvoice}
                      onChange={(e) =>
                        setCreditNoteData({
                          ...creditNoteData,
                          linkToInvoice: e.target.value,
                        })
                      }
                      onFocus={() => selectedCustomer && fetchPartyInvoices()}
                      className="pl-10"
                      disabled={
                        !selectedCustomer || isViewMode
                      }
                      autoComplete="off"
                    />
                    {creditNoteData.linkToInvoice && !isViewMode && (
                      <button
                        onClick={() => {
                          // Allow unlink if invoice is linked (regardless of items loaded)
                          if (
                            creditNoteData.linkToInvoice !== "" &&
                            !isViewMode
                          ) {
                            setShowUnlinkConfirmDialog(true);
                          }
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Unlink invoice"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {/* Invoice Dropdown */}
                    {showInvoiceDropdown && (
                      <div className="invoice-dropdown absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                        {isInvoiceDropdownLoading ? (
                          <div className="p-3 text-center text-gray-500">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            Loading invoices...
                          </div>
                        ) : partyInvoices.length > 0 ? (
                          <div className="p-2">
                            <div className="grid grid-cols-[1fr,2fr,1fr] text-xs font-semibold text-gray-600 border-b pb-1 mb-1">
                              <div>Date</div>
                              <div>Invoice No.</div>
                              <div className="text-right">Amount(₹)</div>
                            </div>
                            {partyInvoices.map((invoice) => (
                              <div
                                key={invoice.id}
                                className="grid grid-cols-[1fr,2fr,1fr] p-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-xs"
                                onClick={() => handleInvoiceSelect(invoice)}
                              >
                                <div>{invoice.invoice_date}</div>
                                <div>{invoice.invoice_number}</div>
                                <div className="text-right">
                                  ₹{invoice.total_amount?.toFixed(2) || "0.00"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-center text-gray-500">
                            No invoice linked with that party
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </div>
          </div>
        </div>

        {/* Middle Section: Items/Services Table */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 bg-gray-50/50 py-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <CardTitle className="text-lg font-bold">Items/Services</CardTitle>
              {items.length > 0 && creditNoteData.linkToInvoice !== "" && (
                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>From Invoice</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end sm:justify-start">
              <Button
                size="sm"
                onClick={handleAddItem}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-95"
                disabled={creditNoteData.linkToInvoice !== ""}
                title={
                  items.length > 0 && creditNoteData.linkToInvoice !== ""
                    ? "Items are loaded from invoice. Unlink invoice to add custom items."
                    : "Add new item"
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                <span>Add Item</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop Table Container */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-16">
                      NO.
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-[250px]">
                      Item/Service Details
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-[250px]">
                      HSN/SAC
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-32">
                      Quantity
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-36">
                      PRICE/ITEM (₹)
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-32">
                      Discount
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-28">
                      Tax
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-36">
                      AMOUNT (₹)
                    </th>
                    <th className="text-left p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-16">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-4 align-middle">{index + 1}</td>
                      <td className="px-4 py-4 border-r border-gray-200">
                        <div className="space-y-2">
                          <div
                            className="text-sm text-gray-900 truncate max-w-[250px]"
                            title={item.item_name || item.item}
                            style={{ marginTop: "0.7rem" }}
                          >
                            {item.item_name || item.item}
                          </div>
                          <div className="relative gap-1">
                            <textarea
                              value={item.description || ""}
                              disabled={creditNoteData.linkToInvoice !== ""}
                              className={`w-full resize-none border-none focus:ring-0 text-xs ${creditNoteData.linkToInvoice !== ""
                                  ? "text-gray-500 bg-gray-100"
                                  : "text-gray-900 bg-white"
                                }`}
                              rows={2}
                              placeholder="Enter Description (optional)"
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[index].description = e.target.value;
                                setItems(newItems);
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200 align-middle">
                        <Input
                          placeholder="HSN/SAC"
                          value={item.hsnSac}
                          disabled={true}
                          className="w-full bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200 align-middle relative">
                        <Input
                          type="number"
                          value={item.quantity}
                          min="1"
                          step="1"
                          className={`w-full min-w-[50px] pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${creditNoteData.linkToInvoice !== ""
                              ? "bg-amber-50 border-amber-200"
                              : "bg-white"
                            }`}
                          onChange={(e) => {
                            const inputValue = e.target.value;

                            // Handle empty input (backspace case) - set to 1 to maintain minimum quantity
                            if (inputValue === "") {
                              handleItemChange(index, "quantity", 1);
                              return;
                            }

                            const newQty = parseInt(inputValue);

                            // Validate: quantity must be at least 1
                            if (isNaN(newQty) || newQty < 1) {
                              handleItemChange(index, "quantity", 1);
                              return;
                            }

                            // Check if quantity exceeds available stock for linked invoice items
                            if (
                              creditNoteData.linkToInvoice !== "" &&
                              newQty > (item.originalQty || 0)
                            ) {
                              // Automatically set to max quantity instead of showing error
                              handleItemChange(index, "quantity", item.originalQty);
                              return;
                            }

                            handleItemChange(index, "quantity", newQty);
                          }}
                        />
                        {creditNoteData.linkToInvoice !== "" &&
                          item.originalQty !== undefined && (
                            <div className="absolute bottom-1 left-0 right-0 text-center">
                              <span className="text-[10px] text-amber-600 whitespace-nowrap">
                                Max: {item.originalQty} (from invoice)
                              </span>
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200 align-middle relative">
                        <Input
                          type="number"
                          value={item.price_per_item}
                          disabled={creditNoteData.linkToInvoice !== ""}
                          className={`w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${creditNoteData.linkToInvoice !== ""
                              ? "text-gray-900 bg-gray-100"
                              : "text-gray-900 bg-white"
                            }`}
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value) || 0;
                            handleItemChange(index, "price_per_item", newPrice);
                          }}
                        />
                        <span className="absolute left-7 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">
                          ₹
                        </span>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200 align-middle relative">
                        <Input
                          type="number"
                          value={item.discount}
                          disabled={creditNoteData.linkToInvoice !== ""}
                          className={`w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${creditNoteData.linkToInvoice !== ""
                              ? "text-gray-900 bg-gray-100"
                              : "text-gray-900 bg-white"
                            }`}
                          onChange={(e) => {
                            const newDiscount = parseFloat(e.target.value) || 0;
                            handleItemChange(index, "discount", newDiscount);
                          }}
                        />
                        <span className="absolute left-7 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                          %
                        </span>
                        {item.discount > 0 && (
                          <div className="absolute -bottom-5 left-0 right-0 text-right">
                            <span className="text-[10px] font-medium text-red-600 leading-tight whitespace-nowrap">
                              -₹{((item.quantity * item.price_per_item * item.discount) / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200 align-middle relative">
                        <select
                          value={item.tax}
                          disabled={creditNoteData.linkToInvoice !== ""}
                          className={`w-full pl-3 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 appearance-none bg-white ${creditNoteData.linkToInvoice !== ""
                              ? "bg-gray-100 text-gray-900"
                              : "bg-white text-gray-900"
                            }`}
                          onChange={(e) => {
                            const newTax = parseFloat(e.target.value) || 0;
                            handleItemChange(index, "tax", newTax);
                          }}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                        {item.tax > 0 && (
                          <div className="absolute bottom-1 right-4 text-right">
                            <span className="text-[10px] font-medium text-green-600 leading-tight whitespace-nowrap">
                              +₹{((item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-left border-r border-gray-200">
                        <div className="text-sm text-gray-900">
                          ₹
                          {item.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 font-medium">
                              No items added yet
                            </p>
                            <p className="text-gray-400 text-sm">
                              Add items to create your credit note
                            </p>
                            <button
                              onClick={handleAddItem}
                              className={`mt-4 px-4 py-2 rounded-lg transition-colors ${items.length > 0 &&
                                  creditNoteData.linkToInvoice !== ""
                                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                              disabled={creditNoteData.linkToInvoice !== ""}
                              title={
                                items.length > 0 &&
                                  creditNoteData.linkToInvoice !== ""
                                  ? "Items are loaded from invoice. Unlink invoice to add custom items."
                                  : "Add your first item"
                              }
                            >
                              Add Your First Item
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td
                      colSpan={4}
                      className="p-4 border-r border-gray-200"
                    ></td>
                    <td className="p-4 text-sm font-semibold text-gray-900 text-right border-r border-gray-200">
                      Subtotal
                    </td>
                    <td className="p-4 text-right text-sm font-medium text-red-600 border-r border-gray-200">
                      {creditNoteData.total_discount > 0 &&
                        `-₹${creditNoteData.total_discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 text-right text-sm font-medium text-green-600 border-r border-gray-200">
                      {creditNoteData.total_tax > 0 &&
                        `+₹${creditNoteData.total_tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 text-sm text-gray-900 text-right border-r border-gray-200">
                      ₹
                      {creditNoteData.totalAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile View - Card based list */}
            <div className="md:hidden divide-y divide-gray-200 bg-gray-50/30">
              {items.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <FileText className="w-10 h-10 text-gray-400" />
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-2">
                    No items added yet
                  </h4>
                  <p className="text-sm text-gray-500 mb-8 max-w-[240px] mx-auto">
                    Get started by adding your first item to the credit note.
                  </p>
                  <Button
                    onClick={handleAddItem}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md active:scale-95 transition-transform"
                    disabled={creditNoteData.linkToInvoice !== ""}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ring-1 ring-black/5"
                    >
                      {/* Card Header */}
                      <div className="px-4 py-3.5 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                            Item Details
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-5">
                        {/* Name & HSN */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-bold text-gray-900 leading-tight mb-1 truncate" title={item.item_name || item.item}>
                              {item.item_name || item.item}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                HSN: {item.hsnSac || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description field */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Description</label>
                          <textarea
                            value={item.description || ""}
                            disabled={creditNoteData.linkToInvoice !== ""}
                            className={`w-full p-3 rounded-xl text-sm border-gray-100 transition-all focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none ${creditNoteData.linkToInvoice !== ""
                                ? "bg-gray-50 text-gray-500 cursor-not-allowed"
                                : "bg-gray-50/50 text-gray-800 hover:bg-white"
                              }`}
                            rows={2}
                            placeholder="Enter item description..."
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[index].description = e.target.value;
                              setItems(newItems);
                            }}
                          />
                        </div>

                        {/* Quantity & Price Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Quantity</label>
                            <div className="relative group">
                              <Input
                                type="number"
                                value={item.quantity}
                                className={`h-11 rounded-xl transition-all shadow-sm ${creditNoteData.linkToInvoice !== "" ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-white"
                                  }`}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  handleItemChange(index, "quantity", val);
                                }}
                              />
                              {creditNoteData.linkToInvoice !== "" && item.originalQty !== undefined && (
                                <div className="absolute -top-6 right-0">
                                  <span className="text-[10px] font-bold text-amber-600">Max: {item.originalQty}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Price/Item</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none">₹</span>
                              <Input
                                type="number"
                                value={item.price_per_item}
                                disabled={creditNoteData.linkToInvoice !== ""}
                                className="h-11 rounded-xl pl-7 pr-3 bg-white transition-all shadow-sm disabled:bg-gray-50 disabled:text-gray-500"
                                onChange={(e) => handleItemChange(index, "price_per_item", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Discount & Tax Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Discount (%)</label>
                            <div className="relative">
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 select-none">%</span>
                              <Input
                                type="number"
                                value={item.discount}
                                disabled={creditNoteData.linkToInvoice !== ""}
                                className="h-11 rounded-xl pr-7 bg-white transition-all shadow-sm disabled:bg-gray-50 disabled:text-gray-500"
                                onChange={(e) => handleItemChange(index, "discount", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            {item.discount > 0 && (
                              <p className="text-[10px] font-bold text-red-600 pl-1">-₹{((item.quantity * item.price_per_item * item.discount) / 100).toFixed(2)}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Tax (%)</label>
                            <div className="relative">
                              <select
                                value={item.tax}
                                disabled={creditNoteData.linkToInvoice !== ""}
                                className="w-full h-11 rounded-xl px-3 bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500 outline-none transition-all shadow-sm"
                                onChange={(e) => handleItemChange(index, "tax", parseFloat(e.target.value) || 0)}
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </div>
                            {item.tax > 0 && (
                              <p className="text-[10px] font-bold text-green-600 pl-1">+₹{((item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer - Total Amount */}
                      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center text-sm font-bold">
                        <span className="text-blue-700 uppercase tracking-tighter text-[10px]">Total Amount</span>
                        <span className="text-lg text-indigo-900 drop-shadow-sm">
                          ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Section: Notes, Summary, and Signature */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes & Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Notes & Terms and Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium mb-2"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={creditNoteData.notes || ""}
                  onChange={(e) =>
                    setCreditNoteData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter notes for this credit note..."
                  disabled={isViewMode}
                />
              </div>
              <div>
                <label
                  htmlFor="terms"
                  className="block text-sm font-medium mb-2"
                >
                  Terms and Conditions
                </label>
                <textarea
                  id="terms"
                  value={creditNoteData.terms_and_conditions || ""}
                  onChange={(e) =>
                    setCreditNoteData((prev) => ({
                      ...prev,
                      terms_and_conditions: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter terms and conditions..."
                  disabled={isViewMode}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Taxable Amount</span>
                <span className="font-medium">
                  ₹ {creditNoteData.taxableAmount.toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-4 space-y-3">
                <button
                  onClick={handleAddAdditionalCharges}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors w-full text-left"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Add Additional Charges</span>
                </button>
                <button
                  onClick={handleAddDiscount}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors w-full text-left"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Add Discount</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoRoundOff"
                    checked={creditNoteData.autoRoundOff}
                    onCheckedChange={(checked: boolean) => {
                      setCreditNoteData((prev) => ({
                        ...prev,
                        autoRoundOff: checked,
                      }));
                    }}
                  />
                  <label htmlFor="autoRoundOff" className="text-sm font-medium">
                    Auto Round Off
                  </label>
                </div>
              </div>
              {creditNoteData.autoRoundOff &&
                creditNoteData.round_off_amount !== 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Round Off</span>
                    <span
                      className={
                        creditNoteData.round_off_amount > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {creditNoteData.round_off_amount > 0 ? "+" : ""}₹{" "}
                      {creditNoteData.round_off_amount.toFixed(2)}
                    </span>
                  </div>
                )}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">Total Amount</span>
                  <span className="font-semibold text-lg">
                    ₹ {creditNoteData.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Amount Received</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      ₹ {creditNoteData.amountReceived.toFixed(2)}
                    </span>
                    <Button variant="outline" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="markAsFullyPaid"
                      checked={creditNoteData.markAsFullyPaid}
                      onCheckedChange={(checked) =>
                        setCreditNoteData({
                          ...creditNoteData,
                          markAsFullyPaid: Boolean(checked),
                        })
                      }
                    />
                    <label
                      htmlFor="markAsFullyPaid"
                      className="text-sm font-medium"
                    >
                      Mark as fully paid
                    </label>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Balance Amount</span>
                  <span className="font-medium">
                    ₹ {creditNoteData.balanceAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Authorized signatory for XYZ Logistics
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <button
                  onClick={handleAddSignature}
                  className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span className="font-medium">Add Signature</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Item Modal */}
        {showAddItemModal && (
          <CreateItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            onSuccess={() => {
              // Handle success
              setShowAddItemModal(false);
            }}
            item={null}
          />
        )}

        {/* Add Item Page Modal */}
        {showAddItemPage && (
          <AddItemPage
            open={showAddItemPage}
            onOpenChange={setShowAddItemPage}
            onAddItems={(selectedItems: any[]) => {
              const newItems = selectedItems.map((item) => {
                const quantity = Number(item.quantity) || 1;
                const price_per_item =
                  Number(item.sales_price) || item.price || 0;
                const discount = Number(item.discount_percentage) || 0;
                const tax = 18; // Default to 18%
                const amount =
                  quantity *
                  price_per_item *
                  (1 - discount / 100) *
                  (1 + tax / 100);

                return {
                  id: Date.now() + Math.random(),
                  item_id: item.item_id,
                  item_name: item.item_name || item.item,
                  hsnSac: item.hsn_code || item.hsn_sac_code || "",
                  quantity: quantity,
                  price_per_item: price_per_item,
                  discount: discount,
                  tax: tax,
                  amount: amount,
                  description: item.description || "",
                };
              });
              const updatedItems = [...items, ...newItems];
              setItems(updatedItems);
              recalculateTotals(updatedItems);
              setShowAddItemPage(false);
            }}
            onCreateNewItem={() => {
              setShowAddItemPage(false);
              setShowAddItemModal(true);
            }}
          />
        )}

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
                    {isPartiesLoading ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <SpinnerDotted size={20} />
                        </div>
                        <h3 className="mt-3 text-sm font-medium text-gray-900">
                          Loading Parties...
                        </h3>
                      </div>
                    ) : filteredParties.length === 0 ? (
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
                            className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedParty?.id === party.id
                                ? "bg-gray-100"
                                : ""
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
              const newParty = {
                id: newCustomer.uuid,
                uuid: newCustomer.uuid,
                name: `${newCustomer.first_name} ${newCustomer.last_name}`.trim(),
                balance: 0,
                mobile: newCustomer.mobile,
                customerData: newCustomer,
              };
              setParties([...parties, newParty]);
              setSelectedParty(newParty);
              setSelectedCustomer(newCustomer);
              fetchCustomerData(newCustomer.uuid);
            }
          }}
        />
        {/* Unlink Invoice Confirmation Dialog */}
        <Dialog
          open={showUnlinkConfirmDialog}
          onOpenChange={setShowUnlinkConfirmDialog}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817z"
                    />
                  </svg>
                </div>
                Unlink Invoice
              </DialogTitle>
            </DialogHeader>
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      <strong>Warning:</strong> This action cannot be undone
                    </p>
                    <p className="text-sm text-gray-600">
                      Are you sure you want to unlink the invoice? This will
                      remove all items loaded from the invoice and you'll need
                      to add items manually.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUnlinkConfirmDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setCreditNoteData((prev) => ({
                      ...prev,
                      linkToInvoice: "",
                    }));
                    // Clear items when invoice is unlinked
                    setItems([]);
                    recalculateTotals([]);
                    setShowUnlinkConfirmDialog(false);
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Unlink Invoice
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shipping Address Modal */}
        <Dialog
          open={isShippingModalOpen}
          onOpenChange={setIsShippingModalOpen}
        >
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
                        const isSelected =
                          selectedAddress?.uuid === address.uuid;
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
                                  <div
                                    className="relative"
                                    ref={
                                      address.uuid === activeDropdownUuid
                                        ? dropdownRef
                                        : null
                                    }
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const uuid = address.uuid;

                                        if (!uuid) {
                                          // Address UUID is missing
                                          return;
                                        }

                                        if (activeDropdownUuid === uuid) {
                                          setActiveDropdownUuid(null);
                                          setButtonPosition(null);
                                        } else {
                                          const rect =
                                            e.currentTarget.getBoundingClientRect();
                                          setButtonPosition({
                                            top: rect.top,
                                            left: rect.right + 8,
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
                                      <div className="absolute right-full mr-2 top-0 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[100] animate-in slide-in-from-right-2 fade-in-0 duration-200">
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
                                    <span className="font-medium text-gray-500">
                                      Address:
                                    </span>{" "}
                                    {[address.address1, address.address2]
                                      .filter(Boolean)
                                      .join(", ")}
                                    ,
                                    <span className="font-medium text-gray-500">
                                      {" "}
                                      State:
                                    </span>{" "}
                                    {address.state},
                                    <span className="font-medium text-gray-500">
                                      {" "}
                                      Country:
                                    </span>{" "}
                                    {address.country}
                                  </p>
                                  <p className="text-xs text-gray-700 leading-relaxed">
                                    <span className="font-medium text-gray-500">
                                      City:
                                    </span>{" "}
                                    {address.city},
                                    <span className="font-medium text-gray-500">
                                      {" "}
                                      Pin:
                                    </span>{" "}
                                    {address.pin}
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
                          shipping_addresses: shippingAddresses.map((addr) => ({
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
                          payload,
                        );

                        // Update the selected customer with the new shipping address
                        const updatedCustomer = {
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
                        const errorMessage =
                          error.response?.data?.error ||
                          "Failed to save shipping address. Please try again.";

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
    </div>
  );
};

export { CreateCreditNotePage };
