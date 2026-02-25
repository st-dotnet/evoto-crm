
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
import { createInvoice, getInvoiceById, updateInvoice } from "../services/invoice.services";
import AddItemPage from "../../quotation/components/AdditemPage";
import CreateItemModal from "../../items/CreateItemModal";
import { ShippingAddressModal } from "@/pages/parties/blocks/customers/ShippingAddressModal";
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
    country?: string;
    postal_code?: string;
}

interface FormData {
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    status: string;
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

interface InvoiceItem {
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
    descriptionError?: string;
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

const diffDays = (
    start: string | number | Date,
    end: string | number | Date,
) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)), 0);
};

const CreateInvoicePage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const isEditMode = !!id;
    const isFromQuotation = location.state?.fromQuotation;
    const today = new Date().toISOString().split("T")[0];
    // Form state
    const [isLoading, setIsLoading] = useState(false);
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [isPartiesLoading, setIsPartiesLoading] = useState(false);
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
    const [formData, setFormData] = useState<FormData>({
        invoiceNo: "",
        invoiceDate: today,
        dueDate: addDays(today, 30),
        status: "draft", // Default status
    });

    // Payment States
    const [amountReceived, setAmountReceived] = useState(0);
    const [paymentMode, setPaymentMode] = useState("Cash");
    const [transactionReference, setTransactionReference] = useState("");
    const [isFullyPaid, setIsFullyPaid] = useState(false);

    const [isPartyDialogOpen, setIsPartyDialogOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [parties, setParties] = useState<Party[]>([]);
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [isCreatingParty, setIsCreatingParty] = useState(false);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showCreateItemModal, setShowCreateItemModal] = useState(false);
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
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
    const [tax, setTax] = useState(18);

    // Add these calculation helper functions before the return statement:

    const calculateSubtotal = () => {
        return invoiceItems.reduce((sum, item) => {
            const amount = Math.round(item.quantity * item.price_per_item * 100) / 100;
            return sum + amount;
        }, 0);
    };

    const calculateDiscount = () => {
        const total = invoiceItems.reduce(
            (sum, item) =>
                sum + (item.quantity * item.price_per_item * item.discount) / 100,
            0
        );

        return Math.round(total * 100) / 100;
    };

    const calculateExplanationDiscount = () => {
        // Just for calculating item-level discount sum
        return calculateDiscount();
    }

    const calculateOverallDiscount = () => {
        // Calculates the global discount applied
        const subtotal = calculateSubtotal();
        if (discount.type === "percentage") {
            return (subtotal * discount.value) / 100;
        } else {
            return discount.value;
        }
    };

    const calculateTax = () => {
        const totalTax = invoiceItems.reduce((sum, item) => {
            const taxableAmount =
                item.quantity * item.price_per_item * (1 - item.discount / 100);

            return sum + (taxableAmount * item.tax) / 100;
        }, 0);

        return Math.round(totalTax * 100) / 100;
    };

    const calculateTotalBeforeRoundOff = () => {
        const subtotal = calculateSubtotal();
        const discountAmount = calculateDiscount(); // Item level
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
        } finally {
            setIsPartiesLoading(false);
        }
    };

    useEffect(() => {
        fetchParties();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
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

    const handleFetchInvoice = async (invoiceId: string) => {
        setIsLoading(true);
        try {
            const response = await getInvoiceById(invoiceId);

            if (response.success && response.data) {
                const data = response.data;
                const invoiceDate = data.invoice_date ? data.invoice_date.split('T')[0] : today;
                const dueDate = data.due_date ? data.due_date.split('T')[0] : "";

                setFormData({
                    invoiceNo: data.invoice_number,
                    invoiceDate,
                    dueDate,
                    // Backend returns 'payment_status', not 'status'
                    status: data.payment_status || data.status || "draft",
                });

                // Ensure paid amount is set
                setAmountReceived(Number(data.amount_paid) || 0);

                // Parse payment details from payment_terms
                if (data.payment_terms && data.payment_terms.startsWith("Payment Method: ")) {
                    const pTerms = data.payment_terms;
                    const parts = pTerms.replace("Payment Method: ", "").split(", Ref: ");
                    if (parts.length > 0) setPaymentMode(parts[0]);
                    if (parts.length > 1) setTransactionReference(parts[1]);
                }

                if (data.customer_id) {
                    fetchCustomerData(data.customer_id);
                }

                if (data.items) {
                    const mappedItems = data.items.map((item: any) => {
                        // Logic to map item details same as quotation
                        let discountValue = item.discount_percentage || 0;
                        let taxValue = item.tax_percentage || 0;

                        return {
                            id: item.uuid || item.id,
                            item_id: item.item_id,
                            item_name: item.product_name || item.item_name || item.description || "Item",
                            description: item.description || item.item_description || "",
                            quantity: Number(item.quantity) || 1,
                            price_per_item: Number(item.unit_price) || 0,
                            discount: Number(discountValue) || 0,
                            tax: Number(taxValue) || 0,
                            amount: Number(item.total_price) || 0,
                            measuring_unit_id: Number(item.measuring_unit_id) || 1,
                        };
                    });

                    setInvoiceItems(mappedItems);

                    if (mappedItems.length > 0) {
                        const firstTax = mappedItems[0].tax || 0;
                        setTax(Number(firstTax) || 0);
                    }
                }

                const resolvedNotes = data.notes || "";
                const resolvedTerms = data.terms_and_conditions || "";
                setNotes(resolvedNotes);
                setTermsAndConditions(resolvedTerms);
                setShowNotesField(!!resolvedNotes);
                setShowTermsField(!!resolvedTerms);
            } else {
                toast.error("Failed to load invoice details");
                navigate('/invoices/list');
            }
        } catch (error) {
            toast.error("Failed to load invoice details");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
      

        if (isEditMode && id && !isFromQuotation) {
            handleFetchInvoice(id);
        } else {
        }
    }, [id, isEditMode, isFromQuotation]);

    // Handle quotation data from navigation state
    useEffect(() => {
        const quotationState = location.state as any;

        // If coming from quotation, prioritize quotation data over edit mode
        if (quotationState?.fromQuotation && quotationState?.quotationData) {

            // Pre-fill form with quotation data
            const qData = quotationState.quotationData;

            // Set customer
            if (qData.selectedCustomer) {
                setSelectedCustomer(qData.selectedCustomer);
                setAutoSelectCustomerUUID(qData.selectedCustomer.uuid);
            }

            // Set invoice items from quotation items
            if (qData.quotationItems && qData.quotationItems.length > 0) {
                const transformedItems = qData.quotationItems.map((item: any) => ({
                    id: item.id,
                    item_id: item.item_id,
                    item_name: item.item_name,
                    hsn_sac: item.hsn_sac || '',
                    quantity: item.quantity,
                    price_per_item: item.price_per_item,
                    discount: item.discount,
                    tax: item.tax,
                    amount: item.amount,
                    measuring_unit_id: item.measuring_unit_id || 1,
                    description: item.description || null,
                }));
                setInvoiceItems(transformedItems);
            }

            // Set dates (use current date for invoice, keep quotation validity for due date)
            setFormData(prev => ({
                ...prev,
                invoiceDate: today,
                dueDate: qData.validityDate || today,
                invoiceNo: '', // Will be auto-generated
                status: 'draft'
            }));

            // Set notes and terms if they exist
            if (qData.notes) {
                setNotes(qData.notes);
            }
            if (qData.terms) {
                setTermsAndConditions(qData.terms);
            }

            toast.success('Invoice pre-filled from quotation data');
        } else if (isEditMode && id && !isFromQuotation) {
            // Only fetch invoice data if not coming from quotation
            handleFetchInvoice(id);
        } else {
        }
    }, [location.state, today, isEditMode, id, isFromQuotation]);

    const handleAddAddress = async (newAddress: ShippingAddress) => {
        if (!selectedCustomer?.uuid) {
            toast.error("No customer selected");
            return;
        }

        setIsAddressLoading(true);
        try {
            const isEditing = editingAddress && editingAddress.uuid;
            let updatedAddresses: ShippingAddress[];

            if (isEditing) {
                updatedAddresses = shippingAddresses.map(addr =>
                    addr.uuid === editingAddress.uuid ? newAddress : addr
                );
            } else {
                validateAddressType(newAddress, shippingAddresses);
                updatedAddresses = [...shippingAddresses, newAddress];
            }

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

            await axios.put(
                `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
                payload
            );

            setShippingAddresses(updatedAddresses);

            const updatedCustomer = {
                ...selectedCustomer,
                shipping_addresses: updatedAddresses,
            };
            setSelectedCustomer(updatedCustomer);

            if (updatedAddresses.length === 1 || newAddress.is_default) {
                setSelectedAddress(newAddress);
            } else if (isEditing && selectedAddress?.uuid === editingAddress.uuid) {
                setSelectedAddress(newAddress);
            }

            toast.success(isEditing ? "Address updated successfully." : "Address saved successfully.");
            setEditingAddress(undefined);
        } catch (error: any) {
            console.error("Error saving address:", error);
            toast.error("Failed to save address. Please try again.");
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

    const handleSetDefaultAddress = async () => {
        const targetUuid = activeDropdownUuid;
        if (!targetUuid || !selectedCustomer?.uuid) {
            toast.error("No address or customer selected");
            return;
        }

        setIsAddressLoading(true);
        try {
            const updatedAddresses = shippingAddresses.map((addr) => ({
                ...addr,
                is_default: addr.uuid === targetUuid,
            }));

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

            await axios.put(
                `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
                payload
            );

            setShippingAddresses(updatedAddresses);

            const defaultAddress = shippingAddresses.find(addr => addr.uuid === targetUuid);
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

    const handleConfirmDelete = async () => {
        if (!addressToOperate?.uuid || !selectedCustomer?.uuid) {
            toast.error("No address or customer selected");
            return;
        }

        setIsAddressLoading(true);
        try {
            const updatedAddresses = shippingAddresses.filter(
                (addr) => addr.uuid !== addressToOperate.uuid
            );

            if (addressToOperate.is_default && updatedAddresses.length > 0) {
                updatedAddresses[0].is_default = true;
            }

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

            await axios.put(
                `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
                payload
            );

            setShippingAddresses(updatedAddresses);

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
            toast.error("Failed to delete address.");
        } finally {
            setIsAddressLoading(false);
        }
    };

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
        const newItems: InvoiceItem[] = items.map((item, index) => {
            const quantity = item.quantity || 1;
            const discount = 0;
            const tax = item.gst_tax_rate || 18;
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
        setInvoiceItems([...invoiceItems, ...newItems]);
        toast.success(`${items.length} item(s) added to invoice`);
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
        setInvoiceItems(invoiceItems.filter((item) => item.id !== itemId));
        toast.success("Item removed from invoice");
    };

    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        setInvoiceItems(
            invoiceItems.map((item) => {
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
        setInvoiceItems(
            invoiceItems.map((item) => {
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
        setInvoiceItems(
            invoiceItems.map((item) => {
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
        setInvoiceItems(
            invoiceItems.map((item) => {
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

    // Payment Handlers
    useEffect(() => {
        if (isFullyPaid) {
            setAmountReceived(Math.round(calculateFinalTotal()));
        }
    }, [isFullyPaid, invoiceItems, tax, additionalCharges, discount]);

    const handleSaveInvoice = async () => {
        setIsSaving(true);
        try {
            // Calculate totals
            const subtotal = calculateSubtotal();
            const totalDiscount = calculateDiscount();
            const totalTax = calculateTax();
            const totalAmount = calculateFinalTotal();

            // Prepare submission data
            const submissionData = {
                ...formData,
                selectedCustomer,
                invoiceItems,
                notes,
                terms: termsAndConditions,
                subtotal,
                total_discount: totalDiscount,
                total_tax: totalTax,
                total_amount: totalAmount,
                amount_paid: amountReceived,
                additional_charges: additionalCharges.reduce((sum, c) => sum + c.amount, 0),
                round_off: roundOffAmount,
                // Add payment method to notes if applicable
                payment_terms: `Payment Method: ${paymentMode}${transactionReference ? `, Ref: ${transactionReference}` : ''}`,
                created_at: new Date().toISOString(),
            };

            let response;
            if (isEditMode && id) {
                response = await updateInvoice(id, submissionData);
            } else {
                response = await createInvoice(submissionData);
            }

            if (response.success) {
                toast.success(isEditMode ? "Invoice updated successfully!" : "Invoice saved successfully!");
                const invoiceId = id || response.data?.invoice_uuid || response.data?.uuid || response.data?.id;

                // Mark quotation as converted if this invoice was created from a quotation
                const quotationState = location.state as any;
                if (quotationState?.fromQuotation && quotationState?.quotationId && !isEditMode) {
                    try {
                        // Import quotation service to update quotation status
                        const { updateQuotation } = await import("../../quotation/services/quotation.services");
                        await updateQuotation(quotationState.quotationId, {
                            status: 'converted'
                        });
                        toast.success("Quotation marked as converted");
                    } catch (error) {
                        console.error("Failed to mark quotation as converted:", error);
                        // Don't show error to user as invoice was saved successfully
                    }
                }

                if (invoiceId) {
                    navigate(`/invoices/${invoiceId}`);
                } else {
                    navigate("/invoices/list");
                }
                return response.data;
            } else {
                toast.error(response.error || "Failed to save invoice");
                return null;
            }
        } catch (error) {
            toast.error("Failed to save invoice");
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const getCustomerAddress = (customer: any, type: "billing" | "shipping") => {
        if (!customer) return null;
        let address =
            type === "shipping"
                ? customer.shipping_address || customer.shippingAddress || customer.shipping_addresses
                : customer.billing_address || customer.billingAddress;

        if (Array.isArray(address)) {
            address = address.find((addr) => addr?.is_default) || address[0];
        }

        // Fallback if no specific address object exists
        if (!address) {
            const prefix = type === "shipping" ? "shipping_" : "";
            address = {
                address1: customer[`${prefix}address1`] || customer[`${prefix}address_line1`] || customer.address1 || customer.address_line1,
                address2: customer[`${prefix}address2`] || customer[`${prefix}address_line2`] || customer.address2 || customer.address_line2,
                city: customer[`${prefix}city`] || customer.city,
                state: customer[`${prefix}state`] || customer.state,
                pin: customer[`${prefix}pin`] || customer.pin,
                country: customer[`${prefix}country`] || customer.country
            };
        }

        return address;
    };

    const formatAddressLines = (address: any, type: "billing" | "shipping") => {
        if (!address) return [];
        if (typeof address === "string") return [address];
        const elements: React.ReactNode[] = [];
        const line1 = address.address1 || address.address_line1 || address.line1 || address.street1;
        const line2 = address.address2 || address.address_line2 || address.line2 || address.street2;

        const prefix = type === "billing" ? "Billing Address" : "Shipping Address";

        if (line1) elements.push(<>
            <span className="font-semibold">{prefix}:</span> {line1}
        </>);
        if (line2) elements.push(<>
            <span className="font-semibold">Line 2:</span> {line2}
        </>);

        const parts = [];
        if (address.city) parts.push(<span key="city"><span className="font-semibold">City:</span> {address.city}</span>);
        if (address.state) parts.push(<span key="state"><span className="font-semibold">State:</span> {address.state}</span>);
        const pin = address.pin || address.postal_code || address.zip;
        if (pin) parts.push(<span key="pin"><span className="font-semibold">PIN:</span> {pin}</span>);
        if (address.country) parts.push(<span key="country"><span className="font-semibold">Country:</span> {address.country}</span>);

        if (parts.length > 0) {
            const joinedParts = parts.reduce((acc: React.ReactNode[], curr, idx) => {
                if (idx === 0) return [curr];
                return [...acc, ", ", curr];
            }, []);
            elements.push(<>{joinedParts}</>);
        }
        return elements;
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
            <div className="sticky top-[70px] z-10 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
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
                        {isEditMode ? "Edit Invoice" : "Create Invoice"}
                    </h1>
                </div>
                <Button
                    type="button"
                    className="bg-[#1B84FF] hover:bg-[#0F6FE0] text-white gap-2 px-4 py-2 rounded-lg"
                    disabled={isSaving}
                    onClick={async () => {
                        if (!selectedCustomer) {
                            toast.error("Please select a Party");
                            return;
                        }

                        if (invoiceItems.length === 0) {
                            toast.error("Please add at least one item");
                            return;
                        }

                        if (isEditMode) {
                            await handleSaveInvoice();
                            return;
                        }

                        // Prepare invoice data

                        const invoiceData = {
                            ...formData,
                            selectedCustomer,
                            invoiceItems: invoiceItems.map(item => ({
                                id: item.id,
                                item_id: item.item_id,
                                item_name: item.item_name,
                                description: item.description,
                                quantity: item.quantity,
                                price_per_item: item.price_per_item,
                                discount: item.discount,
                                tax: item.tax,
                                amount: item.amount,
                                measuring_unit_id: item.measuring_unit_id
                            })),
                            notes,
                            terms: termsAndConditions,
                        };

                        // Save invoice
                        const savedInvoice = await handleSaveInvoice();
                    }}
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Invoice"}
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
                                                    {formatAddressLines(getCustomerAddress(selectedCustomer, "billing"), "billing").map((line, index) => (
                                                        <p key={index} className="text-gray-600">{line}</p>
                                                    ))}
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
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Ship To</h3>
                            {selectedCustomer ? (
                                <div className="border rounded-xl h-[180px] p-4 bg-white overflow-hidden">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                {selectedCustomer.first_name} {selectedCustomer.last_name}
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
                                                    {formatAddressLines(getCustomerAddress(selectedCustomer, "shipping"), "shipping").map((line, index) => (
                                                        <p key={index} className="text-gray-600">{line}</p>
                                                    ))}
                                                </div>
                                            </div>
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
                        Invoice Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-600">Invoice No.</label>
                            <Input
                                name="invoiceNo"
                                value={formData.invoiceNo}
                                onChange={handleChange}
                                placeholder="Auto"
                                className="h-8 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-600">Invoice Date</label>
                            <Input
                                type="date"
                                name="invoiceDate"
                                value={formData.invoiceDate}
                                onChange={handleChange}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-xs text-gray-600">Due Date</label>
                            <Input
                                type="date"
                                name="dueDate"
                                value={formData.dueDate}
                                onChange={handleChange}
                                min={formData.invoiceDate}
                                className="h-8 text-sm w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Party Dialog & Modals would go here (omitted for brevity, same as Quotation) */}
                <Dialog open={isPartyDialogOpen} onOpenChange={setIsPartyDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        {/* Party List Content */}
                        <div className="p-4">
                            <Input
                                placeholder="Search parties..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="mb-4"
                            />
                            <div className="h-64 overflow-y-auto">
                                {filteredParties.map(party => (
                                    <div key={party.id} onClick={() => handleSelectParty(party)} className="p-2 hover:bg-gray-100 cursor-pointer border-b">
                                        {party.name}
                                    </div>
                                ))}
                            </div>
                            <Button onClick={() => setIsCustomerModalOpen(true)} className="w-full mt-2">Create New Party</Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <ModalCustomer
                    open={isCustomerModalOpen}
                    onOpenChange={setIsCustomerModalOpen}
                    title="Create Party"
                    onSuccess={(customer) => {
                        if (customer && customer.uuid) {
                            const party = {
                                id: customer.uuid,
                                uuid: customer.uuid,
                                name: `${customer.first_name} ${customer.last_name}`,
                                balance: 0,
                                mobile: customer.mobile
                            } as Party;
                            setParties(prev => [party, ...prev]);
                            handleSelectParty(party);
                        }
                    }}
                    customer={null}
                />
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                {/* Items Table - reusing structure */}
                <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between">
                    <h3 className="text-base font-semibold text-gray-800">Items</h3>
                    <Button size="sm" onClick={() => setShowAddItemModal(true)}>+ Add Item</Button>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-16">
                                    No.
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[250px]">
                                    Item/Service Details
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-28">
                                    HSN/SAC
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-32">
                                    Quantity
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-36">
                                    PRICE/ITEM (₹)
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-32">
                                    Discount
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-28">
                                    Tax
                                </th>
                                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-36">
                                    AMOUNT (₹)
                                </th>
                                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {invoiceItems.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-20">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="text-center">
                                                <h4 className="text-sm font-medium text-gray-900 mb-1">No items added yet</h4>
                                                <p className="text-xs text-gray-500 mb-4">Get started by adding your first item to the quotation</p>
                                                <button
                                                    onClick={() => setShowAddItemModal(true)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Add Your First Item
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                invoiceItems.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-gray-50/70 transition-colors group"
                                    >
                                        {/* Serial Number */}
                                        <td className="px-4 py-4 text-sm font-medium text-gray-600 border-r border-gray-200">
                                            {index + 1}
                                        </td>

                                        {/* Item Details */}
                                        <td className="px-4 py-4 border-r border-gray-200">
                                            <div className="space-y-2">
                                                <div className="text-sm text-gray-900 truncate max-w-[250px]" title={item.item_name}>
                                                    {item.item_name}
                                                </div>
                                                <div className="relative">
                                                    <textarea
                                                        value={item.description || ""}
                                                        onChange={(e) => {
                                                            const text = e.target.value;
                                                            const charCount = text.length;

                                                            if (charCount <= 50) {
                                                                setInvoiceItems(
                                                                    invoiceItems.map((invoiceItem) => {
                                                                        if (invoiceItem.id === item.id) {
                                                                            return { ...invoiceItem, description: text, descriptionError: "" };
                                                                        }
                                                                        return invoiceItem;
                                                                    })
                                                                );
                                                            } else {
                                                                setInvoiceItems(
                                                                    invoiceItems.map((invoiceItem) => {
                                                                        if (invoiceItem.id === item.id) {
                                                                            return { ...invoiceItem, descriptionError: "Maximum limit 50 characters reached" };
                                                                        }
                                                                        return invoiceItem;
                                                                    })
                                                                );
                                                            }
                                                        }}
                                                        placeholder="Add item description..."
                                                        className="w-full px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-transparent focus:bg-white transition-colors"
                                                        rows={2}
                                                    />
                                                    {item.descriptionError && (
                                                        <div className="absolute -bottom-4 left-0 text-xs text-red-600 bg-white z-10">
                                                            {item.descriptionError}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* HSN/SAC */}
                                        <td className="px-4 py-4 text-sm text-gray-700 border-r border-gray-200">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-mono text-xs">
                                                {item.hsn_sac || "N/A"}
                                            </span>
                                        </td>

                                        {/* Quantity */}
                                        <td className="px-4 py-4 border-r border-gray-200">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-blue-200 focus-within:border-blue-200">
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
                                                        className="w-full px-2 py-2 text-sm text-center text-gray-900 border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="px-2.5 py-2 bg-gray-100 text-xs font-semibold text-gray-600 border-l border-gray-300">
                                                        {getMeasuringUnit(item.measuring_unit_id)}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 h-3"></div>
                                            </div>
                                        </td>

                                        {/* Price */}
                                        <td className="px-4 py-4 border-r border-gray-200">
                                            <div className="flex flex-col">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-xs font-medium text-gray-500">₹</span>
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
                                                        className="w-full pl-6 pr-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                                <div className="mt-0.5 h-3"></div>
                                            </div>
                                        </td>

                                        {/* Discount */}
                                        <td className="px-4 py-4 border-r border-gray-200">
                                            <div className="flex flex-col">
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
                                                        className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-500">%</span>
                                                </div>
                                                <div className="text-[10px] font-medium text-red-600 text-right leading-tight mt-0.5 h-3">
                                                    {item.discount > 0 ? `-₹${(item.quantity * item.price_per_item * item.discount / 100).toFixed(2)}` : ''}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Tax */}
                                        <td className="px-4 py-4 border-r border-gray-200">
                                            <div className="flex flex-col">
                                                <select
                                                    value={item.tax}
                                                    onChange={(e) =>
                                                        handleUpdateTax(
                                                            item.id,
                                                            parseFloat(e.target.value) || 0
                                                        )
                                                    }
                                                    className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 h-[38px]"
                                                >
                                                    <option value="">None</option>
                                                    <option value="5">5%</option>
                                                    <option value="12">12%</option>
                                                    <option value="18">18%</option>
                                                    <option value="28">28%</option>
                                                </select>
                                                <div className="text-[10px] font-medium text-green-600 text-right leading-tight mt-0.5 h-3">
                                                    {item.tax > 0 ? `+₹${((item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100).toFixed(2)}` : ''}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Amount */}
                                        <td className="px-4 py-4 text-right border-r border-gray-200">
                                            <div className="text-sm text-gray-900">
                                                ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>

                                        {/* Delete Action */}
                                        <td className="px-4 py-4 text-center">
                                            <button

                                                onClick={() => handleRemoveItem(item.id)}
                                                className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Remove item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                                <td colSpan={4} className="px-4 py-4 border-r border-gray-200"></td>
                                <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right border-r border-gray-200">
                                    Subtotal
                                </td>
                                <td className="px-4 py-4 text-right text-sm font-medium text-red-600 border-r border-gray-200">
                                    {calculateDiscount() > 0 && `-₹${calculateDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                </td>
                                <td className="px-4 py-4 text-right text-sm font-medium text-green-600 border-r border-gray-200">
                                    {calculateTax() > 0 && `+₹${calculateTax().toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900 text-right border-r border-gray-200">
                                    ₹{calculateFinalTotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

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
                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
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
                                        className="w-full border rounded-md p-2 text-sm"
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
                                <div className="p-3 ">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                        className="w-full border rounded-md p-2 text-sm"
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
                        {invoiceItems.length > 0 && (
                            <div className="bg-white border  p-5 space-y-3">
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
                                        ₹ {calculateFinalTotal().toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-700">Amount Received</label>
                                        <input
                                            type="checkbox"
                                            checked={isFullyPaid}
                                            onChange={e => setIsFullyPaid(e.target.checked)}
                                            className="rounded border-gray-300"
                                            id="paidFull"
                                        />
                                        <label htmlFor="paidFull" className="text-xs text-gray-500">Mark as fully paid</label>
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-3">
                                    <div className="relative w-40 ml-auto">
                                        <span className="absolute left-3 top-2 text-gray-500">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={amountReceived}
                                            onKeyDown={(e) => {
                                                if (["-", "+", "e", "E"].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChange={e => {
                                                setAmountReceived(parseFloat(e.target.value));
                                                if (parseFloat(e.target.value) !== Math.round(calculateFinalTotal())) setIsFullyPaid(false);
                                            }}
                                            className="w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
                                        />
                                    </div>
                                    <select
                                        value={paymentMode}
                                        onChange={e => setPaymentMode(e.target.value)}
                                        className="border rounded-md px-3 py-2 text-sm bg-gray-50 w-32"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Card">Card</option>
                                        <option value="Netbanking">Netbanking</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                    {/* <input
                                    type="text"
                                    placeholder="Ref / Transaction ID"
                                    value={transactionReference}
                                    onChange={e => setTransactionReference(e.target.value)}
                                    className="flex-1 px-3 py-2 border rounded-md text-sm min-w-[150px]"
                                /> */}
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="text-sm font-medium text-green-600">Balance Amount</span>
                                    <span className="text-lg font-bold text-green-600">
                                        ₹ {(calculateFinalTotal() - amountReceived).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="p-2 flex flex-col items-end">
                                    <p className="text-sm text-gray-600 text-right mb-2">Authorized signatory for <b>Evoto Technologies</b> <span className="font-semibold"></span></p>
                                    <div className="w-56 h-20 border-2 border-dashed border-blue-400 rounded-md flex items-center justify-center">
                                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-2">
                                            <Plus className="h-4 w-4" />
                                            Add Signature
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
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
                onOpenChange={setAddAddressModalOpen}
                address={editingAddress}
                onSave={handleAddAddress}
                existingAddresses={shippingAddresses}
                title={editingAddress ? "Edit Shipping Address" : "Add Shipping Address"}
            />

            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent className="sm:max-w-[400px] p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <DialogTitle className="text-lg font-semibold text-gray-900">Unsaved Changes</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mt-2">
                        You have unsaved changes. Are you sure you want to leave this page?
                    </DialogDescription>
                    <DialogFooter className="mt-6 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelLeave}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmLeave}
                            className="flex-1"
                        >
                            Leave Page
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CreateInvoicePage;
