import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Plus, Search, Barcode, ChevronDown, Trash2, X, UserPlus, MapPin, Briefcase, Home, MapPinIcon, HomeIcon, BriefcaseIcon, MoreVertical, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpinnerDotted } from 'spinners-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import AddItemPage from '../../quotation/components/AdditemPage';
import CreateItemModal from '../../items/CreateItemModal';
import { ShippingAddressModal } from '@/pages/parties/blocks/customers/ShippingAddressModal';
import type { ShippingAddress } from '@/pages/parties/blocks/customers/customer-models';
import { ModalVendor } from '@/pages/parties/blocks/vendors/ModalVendor';
import axios from 'axios';
import { toast } from 'sonner';
import { getCustomerNamesDropdown, getAllCustomersDropdown, getInvoicesForParty, createDebitNote, getDebitNoteById, updateDebitNote, getDebitNotes, getVendorById, getCustomerById, checkDebitNoteExistsForInvoice, updatePurchaseInvoiceStatus } from '../service/debitNote.service';
import { getPurchaseInvoiceById } from '../../purchases/services/purchaseInvoice.services';
import { getVendorsDropdown } from '../service/debitNote.service';

interface Party {
    id: string;
    uuid: string;
    name: string;
    balance?: number;
    mobile?: string;
    email?: string;
    customerData?: Customer;
    vendor?: {
        address1?: string;
        address2?: string;
        city?: string;
        state?: string;
        country?: string;
        pin?: string;
        email?: string;
        gst?: string;
    };
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    country?: string;
    pin?: string;
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

interface DebitNotePayment {
    uuid: string;
    payment_amount: number;
    payment_date: string;
    payment_method?: string;
    payment_reference?: string;
    payment_notes?: string;
    created_at?: string;
}

const CreateDebitNotePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const isEditMode = !!id && location.pathname.includes('/edit');
    const isViewMode = !!id && !location.pathname.includes('/edit');
    
    // Get invoice_id and vendor_id from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const invoiceId = urlParams.get('invoice_id');
    const vendorId = urlParams.get('vendor_id');
    
    // Business profile state
    const [businessProfile, setBusinessProfile] = useState({
        name: "Evoto Technologies",
        email: "",
        phone: "",
        address: "",
        address1: "",
        city: "",
        state: "",
        country: "",
        pin: "",
        gst: "",
    });

    const [items, setItems] = useState<any[]>([]);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showAddItemPage, setShowAddItemPage] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPartyDialogOpen, setIsPartyDialogOpen] = useState(false);
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isPartiesLoading, setIsPartiesLoading] = useState(false);
    const [isCreatingParty, setIsCreatingParty] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [parties, setParties] = useState<any[]>([]);
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [debitNoteShippingAddressId, setDebitNoteShippingAddressId] = useState<string | null>(null);
    const [newPartyName, setNewPartyName] = useState("");
    const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([]);
    const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState<boolean>(false);
    const [addAddressModalOpen, setAddAddressModalOpen] = useState<boolean>(false);
    const [editingAddress, setEditingAddress] = useState<ShippingAddress | undefined>();
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [activeDropdownUuid, setActiveDropdownUuid] = useState<string | null>(null);
    const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
    const [vendorInvoices, setVendorInvoices] = useState<any[]>([]);
    const [isInvoiceDropdownLoading, setIsInvoiceDropdownLoading] = useState(false);
    const [showUnlinkConfirmDialog, setShowUnlinkConfirmDialog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [debitNoteExistsForCurrentInvoice, setDebitNoteExistsForCurrentInvoice] = useState(false);
    const [debitNotePayments, setDebitNotePayments] = useState<DebitNotePayment[]>([]);
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);
    const [isPaymentHistoryLoading, setIsPaymentHistoryLoading] = useState(false);
    const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
    const [newPayment, setNewPayment] = useState({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        payment_reference: '',
        payment_notes: ''
    });
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [debitNoteData, setDebitNoteData] = useState({
        debitNoteNo: '',
        debitNoteDate: new Date().toISOString().split('T')[0],
        linkToInvoice: '',
        linkToInvoiceId: '', // Store the invoice UUID
        vendorId: '', // Store vendor ID from invoice
        status: 'unpaid',
        notes: '',
        terms_and_conditions: '',
        subtotal: 0,
        total_discount: 0,
        total_tax: 0,
        round_off_amount: 0,
        totalAmount: 0,
        additional_charges_total: 0,
        auto_round_off: false,
    });

    const [isInvoicePaid, setIsInvoicePaid] = useState(false);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;

            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setActiveDropdownUuid(null);
            }

            if (!target.closest('#linkToInvoice') && !target.closest('.invoice-dropdown')) {
                setShowInvoiceDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdownUuid]);

    const calculateItemAmount = (quantity: number, pricePerItem: number, discount: number, tax: number, discountType: 'percentage' | 'amount' = 'percentage', taxType: 'percentage' | 'amount' = 'percentage'): number => {
        let subtotal = quantity * pricePerItem;
        let discountAmount = 0;
        if (discountType === 'percentage') {
            discountAmount = subtotal * (discount / 100);
        } else {
            discountAmount = discount;
        }
        let amountAfterDiscount = subtotal - discountAmount;
        let taxAmount = 0;
        if (taxType === 'percentage') {
            taxAmount = amountAfterDiscount * (tax / 100);
        } else {
            taxAmount = tax;
        }
        return amountAfterDiscount + taxAmount;
    };

    const recalculateTotals = (updatedItems: any[]) => {
        const subtotal = updatedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price_per_item), 0);
        const totalDiscount = updatedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price_per_item * item.discount / 100), 0);
        const totalTax = updatedItems.reduce((sum: number, item: any) => sum + ((item.quantity * item.price_per_item * (1 - item.discount / 100)) * item.tax / 100), 0);

        let totalAmount = subtotal - totalDiscount + totalTax;
        let roundOff = 0;

        if (debitNoteData.auto_round_off) {
            const roundedTotal = Math.round(totalAmount);
            roundOff = roundedTotal - totalAmount;
            totalAmount = roundedTotal;
        }

        setDebitNoteData(prev => ({
            ...prev,
            subtotal,
            total_discount: totalDiscount,
            total_tax: totalTax,
            round_off_amount: roundOff,
            totalAmount
        }));
    };

    const calculateTotals = (itemsList: any[]) => {
        recalculateTotals(itemsList);
    };

    const checkIfInvoiceIsPaid = async (invoiceNumber: string) => {
        try {
            const response = await checkDebitNoteExistsForInvoice(invoiceNumber);
            if (response.success && response.data?.exists) {
                setIsInvoicePaid(true);
                toast.error('This invoice is already paid and cannot be linked to a debit note');
            }
        } catch (error) {
            console.error('Error checking invoice status:', error);
        }
    };

    const handleSave = async () => {
        if (!selectedParty) {
            toast.error('Please select a vendor');
            return;
        }

        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                debitNoteNo: debitNoteData.debitNoteNo,
                debitNoteDate: debitNoteData.debitNoteDate,
                linkToInvoice: debitNoteData.linkToInvoice,
                vendorId: debitNoteData.vendorId, // Include vendor ID from invoice
                status: debitNoteData.linkToInvoice !== '' ? 'credited' : 'unpaid',
                selectedCustomer: selectedCustomer,
                debitNoteItems: items.map(item => ({
                    id: item.id || crypto.randomUUID(),
                    item_id: item.item_id,
                    item_name: item.item_name,
                    description: item.description,
                    quantity: item.quantity,
                    price_per_item: item.price_per_item,
                    discount: item.discount,
                    tax: item.tax,
                    amount: item.amount,
                    measuring_unit_id: item.measuring_unit_id,
                    hsn_sac: item.hsn_sac,
                })),
                notes: debitNoteData.notes,
                terms: debitNoteData.terms_and_conditions,
                subtotal: debitNoteData.subtotal,
                total_discount: debitNoteData.total_discount,
                total_tax: debitNoteData.total_tax,
                round_off_amount: debitNoteData.round_off_amount,
                total_amount: debitNoteData.totalAmount,
                additional_charges: debitNoteData.additional_charges_total,
            };

            
            let response;
            if (isEditMode) {
                response = await updateDebitNote(id!, payload);
            } else {
                response = await createDebitNote(payload);
            }

            if (response.success) {
                toast.success(isEditMode ? 'Debit note updated successfully' : 'Debit note created successfully');
                
                // Update purchase invoice status when debit note is created and linked to an invoice
                if (!isEditMode && debitNoteData.linkToInvoice) {
                    try {
                        await updatePurchaseInvoiceStatus(debitNoteData.linkToInvoice, 'credited');
                    } catch (statusError) {
                        // Don't show error to user as debit note creation was successful
                    }
                }
                
                // Trigger a custom event to notify PurchaseInvoicePage to refresh
                window.dispatchEvent(new CustomEvent('debitNoteCreated', { 
                    detail: { invoiceId: debitNoteData.linkToInvoice } 
                }));
                
                navigate('/debit-note');
            } else {
                toast.error(response.error || 'Failed to save debit note');
            }
        } catch (error) {
            console.error('Error saving debit note:', error);
            toast.error('Failed to save debit note');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddItem = () => {
        setShowAddItemPage(true);
    };

    const handleAddItemModal = () => {
        setShowAddItemModal(true);
        setShowAddItemPage(false);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        recalculateTotals(newItems);
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const updatedItems = [...items];
        const item = { ...updatedItems[index], [field]: value };

        // Validate quantity doesn't exceed original invoice quantity
        if (field === 'quantity' && item.originalQty) {
            const newQuantity = parseFloat(value) || 0;
            if (newQuantity > item.originalQty) {
                toast.error(`Quantity cannot exceed original invoice quantity (${item.originalQty})`);
                return; // Don't update if quantity exceeds original
            }
            if (newQuantity < 0) {
                toast.error('Quantity cannot be negative');
                return;
            }
        }

        // Recalculate amount when quantity, price, discount, or tax changes
        if (['quantity', 'price_per_item', 'discount', 'tax'].includes(field)) {
            item.amount = item.quantity * item.price_per_item * (1 - item.discount / 100) * (1 + item.tax / 100);
        }

        updatedItems[index] = item;
        setItems(updatedItems);
        recalculateTotals(updatedItems);
    };

    const handleCustomerSelect = (vendor: Party) => {
        console.log('Selected vendor:', vendor);
        setSelectedParty(vendor);
        setSelectedCustomer(vendor.customerData || null);
        setIsPartyDialogOpen(false);
        // Don't fetch customer data for vendors - use vendor data directly
        // fetchCustomerData(vendor.uuid);
    };

    // Function to fetch vendor invoices
    const fetchPartyInvoices = async () => {
        if (!selectedCustomer) {
            setVendorInvoices([]);
            return;
        }
        setIsInvoiceDropdownLoading(true);
        try {
            const response = await getInvoicesForParty(selectedCustomer.uuid);
            
            
            if (response.success && response.data) {
                // Handle different possible response structures
                let invoices = [];
                if (Array.isArray(response.data)) {
                    invoices = response.data;
                } else if (response.data.data && Array.isArray(response.data.data)) {
                    invoices = response.data.data;
                } else if (response.data.invoices && Array.isArray(response.data.invoices)) {
                    invoices = response.data.invoices;
                }
                
                
                // Fetch existing debit notes to check which invoices are already linked
                const debitNotesResponse = await getDebitNotes({
                    vendor_id: selectedCustomer.uuid,
                    per_page: 1000
                });
                
                     
                const linkedInvoiceIds = new Set();
                if (debitNotesResponse.success && debitNotesResponse.data?.data?.debit_notes) {
                    debitNotesResponse.data.data.debit_notes.forEach((dn: any) => {
                        if (dn.invoice_id) {
                            linkedInvoiceIds.add(dn.invoice_id);
                        }
                    });
                } else if (debitNotesResponse.success && debitNotesResponse.data?.debit_notes) {
                    // Handle case where data structure is different
                    debitNotesResponse.data.debit_notes.forEach((dn: any) => {
                        if (dn.invoice_id) {
                            linkedInvoiceIds.add(dn.invoice_id);
                        }
                    });
                }
                
                // Filter out invoices that already have debit notes, but include the currently linked one in edit mode
                const availableInvoices = invoices.filter((invoice: any) => {
                    
                    // Try different possible vendor/customer field names
                    const belongsToSelectedCustomer = 
                        invoice.vendor_id === selectedCustomer.uuid ||
                        invoice.customer_id === selectedCustomer.uuid ||
                        invoice.party_id === selectedCustomer.uuid ||
                        invoice.vendor_uuid === selectedCustomer.uuid ||
                        invoice.customer_uuid === selectedCustomer.uuid;
                    
                    const notRefunded = invoice.payment_status !== 'refunded';
                    const notLinkedToDebitNote = !linkedInvoiceIds.has(invoice.uuid);
                    
                    // In edit mode, include the currently linked invoice even if it has a debit note
                    const isCurrentlyLinkedInvoice = isEditMode && debitNoteData.linkToInvoiceId === invoice.uuid;
                    
                    return belongsToSelectedCustomer && notRefunded && (notLinkedToDebitNote || isCurrentlyLinkedInvoice);
                });
                
                
                setVendorInvoices(availableInvoices);
                setShowInvoiceDropdown(true);
            } else {
                setVendorInvoices([]);
                setShowInvoiceDropdown(true);
            }
        } catch (error) {
            console.error('Error fetching party invoices:', error);
            setVendorInvoices([]);
            setShowInvoiceDropdown(false);
        } finally {
            setIsInvoiceDropdownLoading(false);
        }
    };

    // Function to handle invoice selection
    const handleInvoiceSelect = async (invoice: any) => {
        setDebitNoteData(prev => ({ 
            ...prev, 
            linkToInvoice: invoice.invoice_number,
            linkToInvoiceId: invoice.uuid, // Store the UUID for proper linking
            vendorId: invoice.vendor_id || '', // Store vendor ID from invoice
            status: 'credited' // Set status to credited when invoice is linked
        }));
        setShowInvoiceDropdown(false);

        const invoiceId = invoice.uuid;
        if (!invoiceId) {
            console.error('No valid invoice ID found in invoice object:', invoice);
            toast.error('Invalid invoice data - missing ID');
            return;
        }

        try {
            // Check if debit note already exists for this invoice
            const debitNoteCheckResponse = await checkDebitNoteExistsForInvoice(invoiceId);
            if (debitNoteCheckResponse.success && debitNoteCheckResponse.data?.hasDebitNote === true) {
                setDebitNoteExistsForCurrentInvoice(true);
                toast.error('A debit note already exists for this invoice. Please select a different invoice.');
                return;
            } else {
                setDebitNoteExistsForCurrentInvoice(false);
            }

            const response = await getPurchaseInvoiceById(invoiceId);
            if (response.success && response.data?.items && response.data.items.length > 0) {
                const transformedItems = response.data.items.map((item: any) => ({
                    uuid: item.uuid || Date.now().toString() + Math.random(),
                    item_id: item.item_id,
                    item_name: item.product_name || item.item_name,
                    hsn_sac: item.hsn_sac_code,
                    quantity: item.quantity,
                    originalQty: item.quantity,
                    price_per_item: item.unit_price,
                    discount: item.discount?.discount_percentage || 0,
                    tax: item.tax?.tax_percentage || 0,
                    amount: item.quantity * item.unit_price * (1 - (item.discount?.discount_percentage || 0) / 100) * (1 + (item.tax?.tax_percentage || 0) / 100),
                    measuring_unit_id: item.measuring_unit_id,
                    description: item.description || null,
                }));

                setItems(transformedItems);
                recalculateTotals(transformedItems);
                toast.success(`Items from invoice ${invoice.invoice_number} loaded successfully`);
            } else {
                toast.error('No items found in this invoice');
            }
        } catch (error) {
            console.error('Error fetching invoice details:', error);
            toast.error('Failed to load invoice items');
        }
    };

    // Filter vendors based on search query
    const filteredVendors = vendors.filter((v) => {
        const q = searchQuery.toLowerCase();
        const matches = v.name.toLowerCase().includes(q) || (v.mobile && v.mobile.toLowerCase().includes(q));
        return matches;
    });

    // Filter parties based on search query
    const filteredParties = parties.filter((p) => {
        const q = searchQuery.toLowerCase();
        const matches = p.name.toLowerCase().includes(q) || (p.mobile && p.mobile.toLowerCase().includes(q));
        return matches;
    });

    // Function to handle vendor creation success
    const handleVendorCreated = () => {
        setIsVendorModalOpen(false);
        // Refresh the vendors list
        fetchParties();
    };

    // Function to fetch vendors
    const fetchParties = async () => {
        setIsPartiesLoading(true);
        try {
            const response = await getVendorsDropdown();
            if (response.success && response.data) {
                const vendorsList = response.data.data.map((vendor: any) => ({
                    id: vendor.uuid,
                    uuid: vendor.uuid,
                    name: vendor.company_name || vendor.vendor_name || 'Unknown Vendor',
                    balance: 0,
                    mobile: vendor.mobile,
                    email: vendor.email,
                    address1: vendor.address1,
                    address2: vendor.address2,
                    city: vendor.city,
                    state: vendor.state,
                    country: vendor.country,
                    pin: vendor.pin,
                    gst: vendor.gst,
                    customerData: vendor,
                }));
                setVendors(vendorsList);
                setParties(vendorsList);
            } else {
                setVendors([]);
                setParties([]);
            }
        } catch (error) {
            console.error('Error fetching vendors:', error);
            toast.error("Failed to fetch vendors");
        } finally {
            setIsPartiesLoading(false);
        }
    };

    // Function to fetch customer data
    const fetchCustomerData = async (customerUUID: string) => {
        if (!customerUUID) return;
        setIsLoading(true);
        try {
            const response = await axios.get(
                `${import.meta.env.VITE_APP_API_URL}/customers/${customerUUID}`,
            );

            let addresses: ShippingAddress[] = [];
            if (response.data.shipping_addresses && Array.isArray(response.data.shipping_addresses)) {
                addresses = response.data.shipping_addresses.map((addr: any, index: number) => ({
                    ...addr,
                    uuid: addr.uuid || addr.id || `api-${index}-${Date.now()}`,
                    is_default: addr.is_default || false,
                }));
            }
            setShippingAddresses(addresses);
            if (addresses.length > 0) {
                const defaultAddress = addresses.find((addr) => addr.is_default) || addresses[0];
                setSelectedAddress(defaultAddress);
            } else {
                setSelectedAddress(null);
            }

            setSelectedCustomer(response.data);
            const party: Party = {
                id: response.data.uuid,
                uuid: response.data.uuid,
                name: response.data.company_name || `${response.data.first_name} ${response.data.last_name}`,
                balance: 0,
                mobile: response.data.mobile,
                customerData: response.data
            };
            setSelectedParty(party);
        } catch (error) {
            console.error('Error fetching customer data:', error);
            // Try fetching as vendor if customer fetch fails
            try {
                const vendorResponse = await axios.get(
                    `${import.meta.env.VITE_APP_API_URL}/vendors/${customerUUID}`,
                );
                const vendor = vendorResponse.data;
                setSelectedCustomer(vendor);
                const party: Party = {
                    id: vendor.uuid,
                    uuid: vendor.uuid,
                    name: vendor.company_name || vendor.vendor_name || 'Unknown Vendor',
                    balance: 0,
                    mobile: vendor.mobile,
                    customerData: vendor
                };
                setSelectedParty(party);
            } catch (vendorError) {
                console.error('Error fetching vendor data:', vendorError);
                toast.error("Failed to fetch customer or vendor details");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Function to fetch vendor data
    const fetchVendorData = async (vendorUUID: string) => {
        if (!vendorUUID) return;
        setIsLoading(true);
        try {
            const response = await getVendorById(vendorUUID);
            
            if (response.success && response.data) {
                // Create a party object from vendor data
                const vendorParty: Party = {
                    id: response.data.uuid,
                    uuid: response.data.uuid,
                    name: response.data.name || response.data.company_name,
                    balance: response.data.balance,
                    mobile: response.data.mobile,
                    email: response.data.email,
                    vendor: {
                        address1: response.data.address1,
                        address2: response.data.address2,
                        city: response.data.city,
                        state: response.data.state,
                        country: response.data.country,
                        pin: response.data.pin,
                        email: response.data.email,
                        gst: response.data.gst,
                    },
                    address1: response.data.address1,
                    address2: response.data.address2,
                    city: response.data.city,
                    state: response.data.state,
                    country: response.data.country,
                    pin: response.data.pin,
                };
                
                setSelectedParty(vendorParty);
            }
        } catch (error: any) {
            console.error('Error fetching vendor data:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch vendor data');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle edit address
    const handleEditAddress = () => {
        if (activeDropdownUuid) {
            const addressToEdit = shippingAddresses.find((addr) => addr.uuid === activeDropdownUuid);
            if (addressToEdit) {
                setEditingAddress(addressToEdit);
                setAddAddressModalOpen(true);
            }
        }
        setActiveDropdownUuid(null);
    };

    // Handle delete address
    const handleDeleteAddress = async () => {
        if (!activeDropdownUuid || !selectedCustomer?.uuid) {
            toast.error("No address or customer selected");
            return;
        }

        setIsAddressLoading(true);
        try {
            // Remove the address from local state
            const updatedAddresses = shippingAddresses.filter((addr) => addr.uuid !== activeDropdownUuid);
            
            // Update the customer's shipping addresses on the server
            const { updateCustomerShippingAddresses } = await import('@/pages/parties/services/customer.service');
            const response = await updateCustomerShippingAddresses(selectedCustomer.uuid, updatedAddresses);
            
            if (response.success) {
                setShippingAddresses(updatedAddresses);
                
                // If the deleted address was selected, clear the selection
                if (selectedAddress?.uuid === activeDropdownUuid) {
                    setSelectedAddress(updatedAddresses.length > 0 ? updatedAddresses[0] : null);
                }
                
                toast.success("Address deleted successfully");
            } else {
                toast.error(response.error || "Failed to delete address");
            }
        } catch (error: any) {
            console.error("Error deleting address:", error);
            toast.error("Failed to delete address");
        } finally {
            setIsAddressLoading(false);
            setActiveDropdownUuid(null);
        }
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
            const updatedAddresses = shippingAddresses.map((addr) => ({
                ...addr,
                is_default: addr.uuid === targetUuid,
            }));

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

            await axios.put(
                `${import.meta.env.VITE_APP_API_URL}/customers/${selectedCustomer.uuid}`,
                payload,
            );

            setShippingAddresses(updatedAddresses);
            const defaultAddress = shippingAddresses.find((addr) => addr.uuid === targetUuid);
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

    // Function to load customer data by ID
    const loadCustomerData = async (customerId: string) => {
        try {
            const response = await getCustomerById(customerId);
            
            if (response.success && response.data) {
                const customer = response.data;
                
                // Set selected customer
                setSelectedCustomer(customer);
                setSelectedParty({
                    id: customer.uuid,
                    uuid: customer.uuid,
                    name: customer.company_name || `${customer.first_name} ${customer.last_name}`,
                    balance: 0,
                    mobile: customer.mobile,
                    customerData: customer
                });
                
                // Load customer's invoices if needed
                if (debitNoteData.linkToInvoice) {
                    await fetchPartyInvoices();
                }
            } else {
                console.error('Failed to load customer data');
                toast.error('Failed to load customer data');
            }
        } catch (error) {
            console.error('Error loading customer data:', error);
            toast.error('Error loading customer data');
        }
    };

    // Fetch business profile
    const fetchBusinessProfile = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/user/profile`);
            const user = response.data.data || response.data;
            const business = user?.businesses?.[0] || user?.business_profile || user;

            setBusinessProfile({
                name: business?.company_name || business?.name || business?.business_name || user?.company_name || "Evoto Technologies",
                email: business?.email || user?.email,
                phone: business?.phone_number || business?.phone || business?.mobile || user?.phone || user?.mobile,
                address: [business?.address || user?.address, user?.city, user?.state, user?.country].filter(Boolean).join(", "),
                address1: business?.address || user?.address,
                city: user?.city,
                state: user?.state,
                country: user?.country,
                pin: user?.pin,
                gst: business?.gst || business?.gstin || user?.gst || user?.gstin,
            });
        } catch (error) {
            console.error("Failed to fetch full business profile via API", error);
        }
    };

    useEffect(() => {
        fetchBusinessProfile();
    }, []);

    useEffect(() => {
        fetchParties();
    }, []);

    useEffect(() => {
        if (isPartyDialogOpen) {
            fetchParties();
        }
    }, [isPartyDialogOpen]);

    useEffect(() => {
        setShowInvoiceDropdown(false);
        setVendorInvoices([]);
        if (!isEditMode && !invoiceId) { // Only clear if not loading from URL
            setDebitNoteData(prev => ({ ...prev, linkToInvoice: '', status: 'unpaid' }));
        }
    }, [selectedCustomer]);

    // Handle invoice_id parameter for creating debit note from purchase invoice
    useEffect(() => {
        if (invoiceId && !isEditMode) {
            // When creating debit note from invoice, fetch invoice details and auto-select
            const handleInvoiceFromParam = async () => {
                setIsLoading(true);
                try {
                    // First check if debit note already exists for this invoice
                    const debitNoteCheckResponse = await checkDebitNoteExistsForInvoice(invoiceId);
                    if (debitNoteCheckResponse.success && debitNoteCheckResponse.data?.hasDebitNote === true) {
                        setDebitNoteExistsForCurrentInvoice(true);
                        toast.error('A debit note already exists for this invoice. Please select a different invoice.');
                        return;
                    } else {
                        setDebitNoteExistsForCurrentInvoice(false);
                    }

                    const response = await getPurchaseInvoiceById(invoiceId);
                    if (response.success && response.data) {
                        const invoice = response.data;
                        
                        // Set vendor/customer from invoice or URL parameter
                        const invoiceVendorId = invoice.vendor_id || invoice.vendor?.uuid;
                        const finalVendorId = vendorId || invoiceVendorId;
                        
                        if (finalVendorId) {
                            // Find and select the vendor
                            const vendor = parties.find(party => party.uuid === finalVendorId);
                            if (vendor) {
                                setSelectedCustomer(vendor);
                                setSelectedParty(vendor);
                            }
                        }
                        
                        // Set invoice linking details
                        setDebitNoteData(prev => ({
                            ...prev,
                            linkToInvoice: invoice.invoice_number,
                            linkToInvoiceId: invoice.uuid || invoiceId,
                            status: 'credited'
                        }));
                        
                        const transformedItems = response.data.items.map((item: any) => ({
                            uuid: item.uuid || Date.now().toString() + Math.random(),
                            item_id: item.item_id,
                            item_name: item.product_name || item.item_name,
                            hsn_sac: item.hsn_sac_code,
                            quantity: item.quantity,
                            originalQty: item.quantity,
                            price_per_item: item.unit_price,
                            discount: item.discount?.discount_percentage || 0,
                            tax: item.tax?.tax_percentage || 0,
                            amount: item.quantity * item.unit_price * (1 - (item.discount?.discount_percentage || 0) / 100) * (1 + (item.tax?.tax_percentage || 0) / 100),
                            measuring_unit_id: item.measuring_unit_id,
                            description: item.description || null,
                        }));
                        setItems(transformedItems);
                        recalculateTotals(transformedItems);
                    }
                } catch (error) {
                    console.error('Error loading invoice for debit note:', error);
                    toast.error('Failed to load invoice details');
                } finally {
                    setIsLoading(false);
                }
            };
            
            handleInvoiceFromParam();
        }
    }, [invoiceId, isEditMode, parties, vendorId]);

    // Handle vendor_id parameter for creating debit note from purchase invoice without invoice_id
    useEffect(() => {
        if (vendorId && !invoiceId && !isEditMode && parties.length > 0) {
            // When creating debit note with just vendor_id, find and select the vendor
            const vendor = parties.find(party => party.uuid === vendorId);
            if (vendor) {
                setSelectedCustomer(vendor);
                setSelectedParty(vendor);
            }
        }
    }, [vendorId, invoiceId, isEditMode, parties]);

    // Simple edit mode loader - load debit note data when in edit mode
    useEffect(() => {
        if (isEditMode && id) {
            const loadEditData = async () => {
                try {
                    setIsLoading(true);
                    const response = await getDebitNoteById(id);
                    
                    if (response.success && response.data) {
                        const debitNote = response.data;
                        
                        const invoiceId = debitNote.invoice_id || debitNote.linked_invoice_id || debitNote.data?.debit_note?.invoice_id || debitNote.data?.debit_note?.linked_invoice_id;
                        let finalInvoiceId = invoiceId;
                        
                        if (invoiceId) {
                            try {
                                const invoiceResponse = await getPurchaseInvoiceById(invoiceId);
                                if (invoiceResponse.success && invoiceResponse.data) {
                                    if (!finalInvoiceId && invoiceResponse.data.uuid) {
                                        finalInvoiceId = invoiceResponse.data.uuid;
                                    }
                                }
                            } catch (error) {
                            }
                        }
                        
                        setDebitNoteData(prev => ({
                            ...prev,
                            debitNoteNo: debitNote.debit_note_number || debitNote.data?.debit_note?.debit_note_number || '',
                            debitNoteDate: debitNote.debit_note_date || debitNote.data?.debit_note?.debit_note_date || new Date().toISOString().split('T')[0],
                            linkToInvoice: debitNote.invoice_number || debitNote.linked_invoice_id || debitNote.data?.debit_note?.invoice_number || debitNote.data?.debit_note?.linked_invoice_id || '',
                            linkToInvoiceId: finalInvoiceId || '',
                            status: debitNote.status || debitNote.data?.debit_note?.status || 'unpaid',
                            notes: debitNote.notes || debitNote.data?.debit_note?.notes || '',
                            terms: debitNote.terms_and_conditions || debitNote.data?.debit_note?.terms_and_conditions || '',
                        }));
                        
                        // Load customer if available
                        const customerId = debitNote.customer_id || debitNote.data?.debit_note?.customer_id;
                        if (customerId) {
                            const customerResponse = await getCustomerById(customerId);
                            if (customerResponse.success && customerResponse.data) {
                                setSelectedCustomer(customerResponse.data);
                                                                
                                // Load customer shipping addresses
                                let addresses: ShippingAddress[] = [];
                                if (customerResponse.data.shipping_addresses && Array.isArray(customerResponse.data.shipping_addresses)) {
                                    addresses = customerResponse.data.shipping_addresses.map((addr: any, index: number) => ({
                                        ...addr,
                                        uuid: addr.uuid || addr.id || `api-${index}-${Date.now()}`,
                                        created_at: addr.created_at || new Date().toISOString(),
                                        updated_at: addr.updated_at || new Date().toISOString(),
                                    }));
                                }
                                setShippingAddresses(addresses);
                                if (addresses.length > 0) {
                                    const defaultAddress = addresses.find((addr) => addr.is_default) || addresses[0];
                                    setSelectedAddress(defaultAddress);
                                } else {
                                    setSelectedAddress(null);
                                }
                            }
                        }
                        
                        // Load vendor if available
                                                
                        // Try to get vendor ID from various possible locations
                        const vendorId = debitNote.vendor_id || debitNote.data?.debit_note?.vendor_id;
                        
                        if (vendorId) {
                                                        try {
                                const vendorResponse = await getVendorById(vendorId);
                                if (vendorResponse.success && vendorResponse.data) {
                                    setSelectedCustomer(vendorResponse.data);
                                    
                                    // Create and set party object for UI display
                                    const vendorParty: Party = {
                                        id: vendorResponse.data.uuid,
                                        uuid: vendorResponse.data.uuid,
                                        name: vendorResponse.data.vendor_name || vendorResponse.data.company_name || vendorResponse.data.name,
                                        balance: vendorResponse.data.balance,
                                        mobile: vendorResponse.data.mobile,
                                        email: vendorResponse.data.email,
                                        vendor: {
                                            address1: vendorResponse.data.address1,
                                            address2: vendorResponse.data.address2,
                                            city: vendorResponse.data.city,
                                            state: vendorResponse.data.state,
                                            country: vendorResponse.data.country,
                                            pin: vendorResponse.data.pin,
                                            email: vendorResponse.data.email,
                                            gst: vendorResponse.data.gst,
                                        },
                                        address1: vendorResponse.data.address1,
                                        address2: vendorResponse.data.address2,
                                        city: vendorResponse.data.city,
                                        state: vendorResponse.data.state,
                                        country: vendorResponse.data.country,
                                        pin: vendorResponse.data.pin,
                                    };
                                    setSelectedParty(vendorParty);

                                    
                                    // Load vendor shipping addresses
                                    let addresses: ShippingAddress[] = [];
                                    
                                    // First try shipping_addresses array
                                    if (vendorResponse.data.shipping_addresses && Array.isArray(vendorResponse.data.shipping_addresses)) {
                                        addresses = vendorResponse.data.shipping_addresses.map((addr: any, index: number) => ({
                                            ...addr,
                                            uuid: addr.uuid || addr.id || `vendor-${index}-${Date.now()}`,
                                            created_at: addr.created_at || new Date().toISOString(),
                                            updated_at: addr.updated_at || new Date().toISOString(),
                                        }));
                                    } 
                                    // Fallback: try vendor_address object
                                    else if (vendorResponse.data.vendor_address) {
                                        const vendorAddr = vendorResponse.data.vendor_address;
                                        addresses = [{
                                            uuid: vendorAddr.uuid || `vendor-0-${Date.now()}`,
                                            address1: vendorAddr.address1 || vendorAddr.address_line1 || vendorAddr.address,
                                            address2: vendorAddr.address2 || vendorAddr.address_line2 || '',
                                            city: vendorAddr.city || '',
                                            state: vendorAddr.state || '',
                                            country: vendorAddr.country || '',
                                            pin: vendorAddr.pin || vendorAddr.postal_code || '',
                                            address_type: vendorAddr.address_type || 'other',
                                            is_default: true,
                                            created_at: new Date().toISOString(),
                                            updated_at: new Date().toISOString(),
                                        }];
                                    }
                                    // Fallback: try direct address fields
                                    else if (vendorResponse.data.address1 || vendorResponse.data.address) {
                                        addresses = [{
                                            uuid: `vendor-0-${Date.now()}`,
                                            address1: vendorResponse.data.address1 || vendorResponse.data.address || '',
                                            address2: vendorResponse.data.address2 || '',
                                            city: vendorResponse.data.city || '',
                                            state: vendorResponse.data.state || '',
                                            country: vendorResponse.data.country || '',
                                            pin: vendorResponse.data.pin || vendorResponse.data.postal_code || '',
                                            address_type: 'work',
                                            is_default: true,
                                            created_at: new Date().toISOString(),
                                            updated_at: new Date().toISOString(),
                                        }];
                                    } else {
                                    }
                                    setShippingAddresses(addresses);
                                    if (addresses.length > 0) {
                                        const defaultAddress = addresses.find((addr) => addr.is_default) || addresses[0];
                                        setSelectedAddress(defaultAddress);
                                    } else {
                                        setSelectedAddress(null);
                                    }
                                }
                            } catch (error) {
                                console.error('Error loading vendor by ID:', error);
                            }
                        } else if (debitNote.vendor || debitNote.data?.vendor) {
                            const vendorData = debitNote.vendor || debitNote.data?.vendor;
                            setSelectedCustomer({
                                uuid: vendorData.uuid,
                                customer_id: vendorData.id,
                                first_name: vendorData.name || '',
                                last_name: '',
                                company_name: vendorData.name,
                                mobile: vendorData.mobile || '',
                                email: vendorData.email || null,
                                gst: vendorData.gst || '',
                                pin: vendorData.pin || '',
                                address1: vendorData.address1 || '',
                                address2: vendorData.address2 || '',
                                city: vendorData.city || '',
                                state: vendorData.state || '',
                                country: vendorData.country || '',
                                billing_address: vendorData.billing_address,
                                shipping_address: vendorData.shipping_address,
                                shipping_addresses: vendorData.shipping_addresses || [],
                                status: vendorData.status || 'active'
                            });
                            
                            // Load vendor shipping addresses
                            let addresses: ShippingAddress[] = [];
                            if (vendorData.shipping_addresses && Array.isArray(vendorData.shipping_addresses)) {
                                addresses = vendorData.shipping_addresses.map((addr: any, index: number) => ({
                                    ...addr,
                                    uuid: addr.uuid || addr.id || `vendor-${index}-${Date.now()}`,
                                    created_at: addr.created_at || new Date().toISOString(),
                                    updated_at: addr.updated_at || new Date().toISOString(),
                                }));
                            }
                            setShippingAddresses(addresses);
                            if (addresses.length > 0) {
                                const defaultAddress = addresses.find((addr) => addr.is_default) || addresses[0];
                                setSelectedAddress(defaultAddress);
                            } else {
                                setSelectedAddress(null);
                            }
                        } else {
                        }
                        
                        // Load debit note items
                        if (debitNote.data?.items && debitNote.data.items.length > 0) {
                            const transformedItems = debitNote.data.items.map((item: any) => {
                                
                                const quantity = item.quantity || 0;
                                const pricePerItem = item.unit_price || item.price_per_item || 0;
                                const discount = item.discount_percentage || item.discount?.discount_percentage || item.discount_amount || item.discount || 0;
                                const tax = item.tax_percentage || item.tax?.tax_percentage || item.tax_amount || item.tax || 0;
                                const discountType = item.discount_type || 'percentage';
                                const taxType = item.tax_type || 'percentage';
                                
                                
                                const calculatedAmount = calculateItemAmount(quantity, pricePerItem, discount, tax, discountType, taxType);
                                
                                
                                return {
                                    uuid: item.uuid || item.id,
                                    item_id: item.item_id,
                                    item_name: item.item_name,
                                    hsn_sac: item.hsn_sac_code || item.hsn_sac,
                                    quantity,
                                    originalQty: quantity,
                                    price_per_item: pricePerItem,
                                    discount,
                                    tax,
                                    amount: calculatedAmount,
                                    measuring_unit_id: item.measuring_unit_id,
                                    description: item.description || null,
                                    // Additional fields for calculations
                                    discount_type: discountType,
                                    tax_type: taxType,
                                    subtotal: quantity * pricePerItem,
                                    discount_amount: discountType === 'percentage' ? (quantity * pricePerItem * discount / 100) : discount,
                                    tax_amount: taxType === 'percentage' ? ((quantity * pricePerItem - (discountType === 'percentage' ? (quantity * pricePerItem * discount / 100) : discount)) * tax / 100) : tax,
                                };
                            });
                            setItems(transformedItems);
                            recalculateTotals(transformedItems);
                        } else {
                        }
                    }
                } catch (error) {
                    console.error('Error loading debit note:', error);
                    toast.error('Failed to load debit note');
                } finally {
                    setIsLoading(false);
                }
            };
            
            loadEditData();
        }
    }, [isEditMode, id]);

    // Fetch vendor invoices when customer is loaded in edit mode
    useEffect(() => {
        if (isEditMode && selectedCustomer) {
            fetchPartyInvoices();
        }
    }, [selectedCustomer, isEditMode]);

    return (
        <div className="min-h-screen bg-gray-50 relative">
            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
                    <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
                </div>
            )}
            {isAddressLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
                    <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/debit-note')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-xl font-semibold">
                            {isViewMode ? 'View Debit Note' : isEditMode ? 'Edit Debit Note' : 'Create Debit Note'}
                        </h1>
                        {isInvoicePaid && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-red-800 font-medium">This invoice is already paid. Debit note editing is disabled.</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isViewMode && (
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || isInvoicePaid || debitNoteExistsForCurrentInvoice}
                                className="min-w-[80px]"
                            >
                                {isSaving ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        {isEditMode ? 'Updating...' : 'Creating...'}
                                    </div>
                                ) : (
                                    isEditMode ? 'Update' : 'Create'
                                )}
                            </Button>
                        )}
                        {isViewMode && (
                            <Button
                                onClick={() => navigate(`/purchases/debit-note/${id}/edit`)}
                                className="min-w-[80px]"
                            >
                                Edit
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Top Section: Bill To, Ship To, and Debit Note Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:col-span-2">
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Bill To</h3>
                            {selectedParty ? (
                                <div className="border rounded-xl min-h-[180px] p-4 bg-white">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                {selectedParty.name}
                                            </h4>
                                            <div className="mt-2 text-sm text-gray-700 space-y-1">
                                                {/* Try multiple possible address field structures */}
                                                {(selectedParty.vendor?.address1 || selectedParty.address1 || selectedParty.customerData?.address1) && (
                                                    <p className="font-medium">
                                                        {selectedParty.vendor?.address1 || selectedParty.address1 || selectedParty.customerData?.address1}
                                                    </p>
                                                )}
                                                {(selectedParty.vendor?.address2 || selectedParty.address2 || selectedParty.customerData?.address2) && (
                                                    <p>{selectedParty.vendor?.address2 || selectedParty.address2 || selectedParty.customerData?.address2}</p>
                                                )}
                                                <div className="mt-2 space-y-1">
                                                    {selectedParty.mobile && (
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Phone:</span>{" "}
                                                            {selectedParty.mobile}
                                                        </p>
                                                    )}
                                                    {(selectedParty.vendor?.email || selectedParty.email || selectedParty.customerData?.email) && (
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Email:</span>{" "}
                                                            {selectedParty.vendor?.email || selectedParty.email || selectedParty.customerData?.email}
                                                        </p>
                                                    )}
                                                    {(selectedParty.vendor?.gst || selectedParty.customerData?.gst) && (
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">GST:</span>{" "}
                                                            {selectedParty.vendor?.gst || selectedParty.customerData?.gst}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="mt-2 space-y-1">
                                                    <p>
                                                        {(selectedParty.vendor?.city || selectedParty.city || selectedParty.customerData?.city) ? (
                                                            <span>
                                                                <span className="font-medium">City:</span>{" "}
                                                                {selectedParty.vendor?.city || selectedParty.city || selectedParty.customerData?.city},{" "}
                                                            </span>
                                                        ) : null}
                                                        {(selectedParty.vendor?.state || selectedParty.state || selectedParty.customerData?.state) ? (
                                                            <span>
                                                                <span className="font-medium">State:</span>{" "}
                                                                {selectedParty.vendor?.state || selectedParty.state || selectedParty.customerData?.state},{" "}
                                                            </span>
                                                        ) : null}
                                                        {(selectedParty.vendor?.pin || selectedParty.pin || selectedParty.customerData?.pin) ? (
                                                            <span>
                                                                <span className="font-medium">PIN:</span>{" "}
                                                                {selectedParty.vendor?.pin || selectedParty.pin || selectedParty.customerData?.pin}
                                                            </span>
                                                        ) : null}
                                                        {(selectedParty.vendor?.country || selectedParty.country || selectedParty.customerData?.country) ? (
                                                            <span>
                                                                ,{" "}
                                                                <span className="font-medium">Country:</span>{" "}
                                                                {selectedParty.vendor?.country || selectedParty.country || selectedParty.customerData?.country}
                                                            </span>
                                                        ) : null}
                                                    </p>
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
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex items-center justify-center">
                                    <button
                                        onClick={() => setIsPartyDialogOpen(true)}
                                        className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        <Plus className="h-5 w-5" />
                                        <span className="font-medium">Add Vendor</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Ship To</h3>
                            <div className="border rounded-xl h-[180px] p-4 bg-white overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <div className="h-[150px] overflow-hidden">
                                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                            {businessProfile.name}
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                Fixed Address
                                            </span>
                                        </h4>
                                        <div className="mt-2 text-sm text-gray-700 space-y-1">
                                            {businessProfile.address1 && (
                                                <p>{businessProfile.address1}</p>
                                            )}
                                            <div className="mt-2 space-y-1">
                                                {businessProfile.city && businessProfile.state && (
                                                    <p>
                                                        {businessProfile.city}, {businessProfile.state}
                                                    </p>
                                                )}
                                                {businessProfile.country && businessProfile.pin && (
                                                    <p>
                                                        {businessProfile.country} - {businessProfile.pin}
                                                    </p>
                                                )}
                                                {businessProfile.phone && (
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">Phone:</span>{" "}
                                                        {businessProfile.phone}
                                                    </p>
                                                )}
                                                {businessProfile.email && (
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">Email:</span>{" "}
                                                        {businessProfile.email}
                                                    </p>
                                                )}
                                                {businessProfile.gst && (
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">GST:</span>{" "}
                                                        {businessProfile.gst}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={true}
                                            className="text-xs h-7 opacity-50"
                                        >
                                            <MapPin className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                                            Fixed Address
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Debit Note Details */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">Debit Note Details</h3>
                        <div className="border rounded-xl min-h-[180px] p-4 bg-white">
                            <CardContent className="space-y-4 p-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="debitNoteNo" className="block text-sm font-medium mb-1">Debit Note No:</label>
                                        <Input
                                            id="debitNoteNo"
                                            value={debitNoteData.debitNoteNo}
                                            onChange={(e) => setDebitNoteData(prev => ({ ...prev, debitNoteNo: e.target.value }))}
                                            placeholder="auto-generated"
                                            disabled={isViewMode}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="debitNoteDate" className="block text-sm font-medium mb-1">Debit Note Date:</label>
                                        <Input
                                            id="debitNoteDate"
                                            type="date"
                                            value={debitNoteData.debitNoteDate}
                                            onChange={(e) => setDebitNoteData(prev => ({ ...prev, debitNoteDate: e.target.value }))}
                                            disabled={isViewMode}
                                        />
                                    </div>
                                </div>

                                {/* Invoice Link Field */}
                                <div>
                                    <label htmlFor="linkToInvoice" className="block text-sm font-medium mb-1">Link to Invoice:</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="linkToInvoice"
                                            placeholder={selectedCustomer ? "Click to search invoices" : "Select a vendor first"}
                                            value={debitNoteData.linkToInvoice}
                                            onChange={(e) => setDebitNoteData(prev => ({ ...prev, linkToInvoice: e.target.value }))}
                                            onFocus={() => selectedCustomer && fetchPartyInvoices()}
                                            className="pl-10"
                                            disabled={!selectedCustomer || isViewMode || isInvoicePaid}
                                            autoComplete="off"
                                        />
                                        {/* Loader indicator on the input field */}
                                        {isInvoiceDropdownLoading && (
                                            <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                            </div>
                                        )}
                                        {debitNoteData.linkToInvoice && !isViewMode && (
                                            <button
                                                onClick={() => {
                                                    setShowUnlinkConfirmDialog(true);
                                                }}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                title="Unlink invoice"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                        
                                        {/* Warning if debit note already exists for this invoice */}
                                        {debitNoteExistsForCurrentInvoice && (
                                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-red-600">⚠️</span>
                                                    <span className="text-sm text-red-700">
                                                        A debit note already exists for this invoice. Please select a different invoice.
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Invoice Dropdown */}
                                        {showInvoiceDropdown && (
                                            <div className="invoice-dropdown absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                                                {isInvoiceDropdownLoading ? (
                                                    <div className="p-3 text-center text-gray-500">
                                                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                        Loading invoices...
                                                    </div>
                                                ) : vendorInvoices.length > 0 ? (
                                                    <div className="p-2">
                                                        <div className="grid grid-cols-[1fr,2fr,1fr] text-xs font-semibold text-gray-600 border-b pb-1 mb-1">
                                                            <div>Date</div>
                                                            <div>Invoice No.</div>
                                                            <div className="text-right">Amount(₹)</div>
                                                        </div>
                                                        {vendorInvoices.map((invoice) => (
                                                            <div
                                                                key={invoice.id}
                                                                className="grid grid-cols-[1fr,2fr,1fr] p-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-xs"
                                                                onClick={() => handleInvoiceSelect(invoice)}
                                                            >
                                                                <div>{invoice.invoice_date}</div>
                                                                <div>{invoice.invoice_number}</div>
                                                                <div className="text-right">₹{invoice.total_amount?.toFixed(2) || '0.00'}</div>
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
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Items/Services</CardTitle>
                            {items.length > 0 && debitNoteData.linkToInvoice !== '' && (
                                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <span>From Invoice</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleAddItem}
                                disabled={debitNoteData.linkToInvoice !== ''}
                                title={items.length > 0 && debitNoteData.linkToInvoice !== '' ? "Items are loaded from invoice. Unlink invoice to add custom items." : "Add new item"}
                            >
                                <Plus className="h-4 w-4" />
                                <span>Add Item</span>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {debitNoteData.linkToInvoice && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-600">⚠️</span>
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">
                                            Linked to Invoice: {debitNoteData.linkToInvoice}
                                        </p>
                                        <p className="text-xs text-amber-700">
                                            Quantities are limited to original invoice amounts
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
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
                                        <th className="text-right p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-36">
                                            AMOUNT (₹)
                                        </th>
                                        <th className="text-center p-3.5 font-medium text-xs uppercase tracking-wider border-r border-gray-200 w-16">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={item.uuid || index} className="border-b hover:bg-gray-50">
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
                                                            disabled={debitNoteData.linkToInvoice !== ''}
                                                            className={`w-full resize-none border-none focus:ring-0 text-xs ${debitNoteData.linkToInvoice !== '' ? 'text-gray-500 bg-gray-100' : 'text-gray-900 bg-white'}`}
                                                            rows={2}
                                                            placeholder="Enter Description (optional)"
                                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 border-r border-gray-200">
                                                <Input
                                                    placeholder="HSN/SAC"
                                                    value={item.hsn_sac || ''}
                                                    disabled={true}
                                                    className="w-full bg-gray-100"
                                                />
                                            </td>
                                            <td className="px-4 py-4 border-r border-gray-200">
                                                <div className="flex flex-col">
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            value={item.quantity}
                                                            min="0"
                                                            step="1"
                                                            max={debitNoteData.linkToInvoice !== '' ? item.originalQty : undefined}
                                                            className={`w-full min-w-[50px] ${debitNoteData.linkToInvoice !== '' ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}
                                                            onChange={(e) => {
                                                                const inputValue = e.target.value;
                                                                if (inputValue === '' || inputValue === '0') {
                                                                    handleItemChange(index, 'quantity', 0);
                                                                    return;
                                                                }
                                                                const newQty = parseInt(inputValue);
                                                                if (isNaN(newQty) || newQty < 0) {
                                                                    handleItemChange(index, 'quantity', 0);
                                                                    return;
                                                                }
                                                                handleItemChange(index, 'quantity', newQty);
                                                            }}
                                                        />
                                                        {debitNoteData.linkToInvoice !== '' && item.originalQty !== undefined && (
                                                            <span className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                                <span>⚠️</span>
                                                                Max: {item.originalQty} (from invoice)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 border-r border-gray-200">
                                                <div className="flex flex-col">
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            value={item.price_per_item}
                                                            disabled={debitNoteData.linkToInvoice !== ''}
                                                            className={`w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${debitNoteData.linkToInvoice !== '' ? 'text-gray-900 bg-gray-100' : 'text-gray-900 bg-white'}`}
                                                            onChange={(e) => handleItemChange(index, 'price_per_item', parseFloat(e.target.value) || 0)}
                                                        />
                                                        <span className="absolute left-3 top-2.5 text-xs font-medium text-gray-500">₹</span>
                                                    </div>
                                                    <div className="mt-0.5 h-3"></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 border-r border-gray-200">
                                                <div className="flex flex-col">
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            value={item.discount}
                                                            disabled={debitNoteData.linkToInvoice !== ''}
                                                            className={`w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${debitNoteData.linkToInvoice !== '' ? 'text-gray-900 bg-gray-100' : 'text-gray-900 bg-white'}`}
                                                            onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                                                        />
                                                        <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-500">%</span>
                                                    </div>
                                                    <span className="text-[10px] font-medium text-red-600 text-right leading-tight mt-0.5 h-3">
                                                        {item.discount > 0
                                                            ? `-₹${((item.quantity * item.price_per_item * item.discount) / 100).toFixed(2)}`
                                                            : ""}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 border-r border-gray-200">
                                                <div className="flex flex-col">
                                                    <div className="relative">
                                                        <select
                                                            value={item.tax}
                                                            disabled={debitNoteData.linkToInvoice !== ''}
                                                            className={`w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 appearance-none bg-white ${debitNoteData.linkToInvoice !== '' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-900'}`}
                                                            onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                                                        >
                                                            <option value="0">0%</option>
                                                            <option value="5">5%</option>
                                                            <option value="12">12%</option>
                                                            <option value="18">18%</option>
                                                            <option value="28">28%</option>
                                                        </select>
                                                    </div>
                                                    <span className="text-[10px] font-medium text-green-600 text-right leading-tight mt-0.5 h-3">
                                                        {item.tax > 0
                                                            ? `+₹${((item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100).toFixed(2)}`
                                                            : ""}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right border-r border-gray-200">
                                                <div className="text-sm text-gray-900">
                                                    ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => handleRemoveItem(index)}
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
                                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-500 font-medium">No items added yet</p>
                                                        <p className="text-gray-400 text-sm">Add items to create your debit note</p>
                                                        <button
                                                            onClick={handleAddItem}
                                                            className={`mt-4 px-4 py-2 rounded-lg transition-colors ${items.length > 0 && debitNoteData.linkToInvoice !== ''
                                                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                                : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                            disabled={debitNoteData.linkToInvoice !== ''}
                                                            title={items.length > 0 && debitNoteData.linkToInvoice !== '' ? "Items are loaded from invoice. Unlink invoice to add custom items." : "Add your first item"}
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
                                        <td colSpan={4} className="p-4 border-r border-gray-200"></td>
                                        <td className="p-4 text-sm font-semibold text-gray-900 text-right border-r border-gray-200">
                                            Subtotal
                                        </td>
                                        <td className="p-4 text-right text-sm font-medium text-red-600 border-r border-gray-200">
                                            {debitNoteData.total_discount > 0 &&
                                                `-₹${debitNoteData.total_discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                        </td>
                                        <td className="p-4 text-right text-sm font-medium text-green-600 border-r border-gray-200">
                                            {debitNoteData.total_tax > 0 &&
                                                `+₹${debitNoteData.total_tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                        </td>
                                        <td className="p-4 text-sm text-gray-900 text-right border-r border-gray-200">
                                            ₹{debitNoteData.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Bottom Section: Notes, Summary, and Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Notes & Terms */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Notes & Terms and Conditions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label htmlFor="notes" className="block text-sm font-medium mb-2">Notes</label>
                                <textarea
                                    id="notes"
                                    value={debitNoteData.notes || ''}
                                    onChange={(e) => setDebitNoteData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={3}
                                    placeholder="Enter notes for this debit note..."
                                    disabled={isViewMode}
                                />
                            </div>
                            <div>
                                <label htmlFor="terms" className="block text-sm font-medium mb-2">Terms and Conditions</label>
                                <textarea
                                    id="terms"
                                    value={debitNoteData.terms_and_conditions || ''}
                                    onChange={(e) => setDebitNoteData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
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
                                <span className="text-sm">Subtotal</span>
                                <span className="font-medium">₹ {debitNoteData.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Discount</span>
                                    <span className="font-medium text-red-600">-₹ {debitNoteData.total_discount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Tax</span>
                                    <span className="font-medium text-green-600">+₹ {debitNoteData.total_tax.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="autoRoundOff"
                                        checked={debitNoteData.auto_round_off}
                                        onCheckedChange={(checked: boolean) => {
                                            setDebitNoteData(prev => ({ ...prev, auto_round_off: checked }));
                                        }}
                                    />
                                    <label htmlFor="autoRoundOff" className="text-sm font-medium">Auto Round Off</label>
                                </div>
                            </div>
                            {debitNoteData.auto_round_off && debitNoteData.round_off_amount !== 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Round Off</span>
                                    <span className={debitNoteData.round_off_amount > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {debitNoteData.round_off_amount > 0 ? '+' : ''}₹ {debitNoteData.round_off_amount.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-lg">Total Amount</span>
                                    <span className="font-semibold text-lg">₹ {debitNoteData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Status */}
                    {!isViewMode && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <select
                                    value={debitNoteData.status}
                                    onChange={(e) => setDebitNoteData(prev => ({ ...prev, status: e.target.value }))}
                                    className="w-full p-2 border rounded-md"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="sent">Sent</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Add Item Modal */}
                {showAddItemModal && (
                    <CreateItemModal
                        open={showAddItemModal}
                        onOpenChange={setShowAddItemModal}
                        onSuccess={() => {
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
                            const newItems = selectedItems.map(item => {
                                const quantity = Number(item.quantity) || 1;
                                return {
                                    uuid: item.uuid || Date.now().toString() + Math.random(),
                                    item_id: item.item_id,
                                    item_name: item.item_name || item.name,
                                    hsn_sac: item.hsn_sac,
                                    quantity: quantity,
                                    price_per_item: item.price_per_item || item.sales_price,
                                    discount: item.discount || 0,
                                    tax: debitNoteData.linkToInvoice !== '' ? (item.tax || 0) : 18,
                                    amount: quantity * (item.price_per_item || item.sales_price),
                                    measuring_unit_id: item.measuring_unit_id,
                                    description: item.description || null,
                                };
                            });
                            const merged = [...items, ...newItems];
                            setItems(merged);
                            recalculateTotals(merged);
                            setShowAddItemPage(false);
                        }}
                        onCreateNewItem={() => {
                            setShowAddItemPage(false);
                            setShowAddItemModal(true);
                        }}
                    />
                )}

                {/* Vendor Selection Dialog */}
                <Dialog open={isPartyDialogOpen} onOpenChange={setIsPartyDialogOpen}>
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-lg border border-gray-200 shadow-lg">
                        <DialogHeader className="bg-white px-6 py-4 border-b">
                            <DialogTitle className="text-lg font-semibold text-gray-800">
                                Choose Vendor
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-6 space-y-5">
                            {/* Search Bar */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <Input
                                    placeholder="Search vendors by name or mobile..."
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

                            {/* Vendor List */}
                            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                {isPartiesLoading ? (
                                    <div className="p-8 text-center">
                                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                            <SpinnerDotted size={20} />
                                        </div>
                                        <h3 className="mt-3 text-sm font-medium text-gray-900">Loading Vendors...</h3>
                                    </div>
                                ) : (
                                    <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                        {filteredVendors.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                                    <UserPlus className="h-5 w-5 text-gray-600" />
                                                </div>
                                                <h3 className="mt-3 text-sm font-medium text-gray-900">No vendors found</h3>
                                                <p className="mt-1 text-sm text-gray-500">Try adjusting your search query or create a new vendor.</p>
                                                <Button
                                                    onClick={() => {
                                                        setIsPartyDialogOpen(false);
                                                        setIsVendorModalOpen(true);
                                                    }}
                                                    className="mt-4"
                                                    variant="outline"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Create New Vendor
                                                </Button>
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-gray-100">
                                                {filteredVendors.map((vendor) => (
                                                    <li
                                                        key={vendor.uuid}
                                                        className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedParty?.id === vendor.id ? "bg-gray-100" : ""}`}
                                                        onClick={() => handleCustomerSelect(vendor)}
                                                    >
                                                        <div className="flex items-center">
                                                            <div className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${selectedParty?.id === vendor.id ? "bg-green-100" : "bg-gray-100"}`}>
                                                                <span className={`font-medium text-sm ${selectedParty?.id === vendor.id ? "text-green-700" : "text-gray-600"}`}>
                                                                    {vendor.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                                                                    {vendor.name}
                                                                </div>
                                                                {vendor.mobile && (
                                                                    <div className="text-sm text-gray-500 flex items-center mt-1">
                                                                        <span className="text-gray-400 mr-1.5">
                                                                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                                            </svg>
                                                                        </span>
                                                                        {vendor.mobile}
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
                            
                            {/* Create New Vendor Button */}
                            <div className="pt-2 border-t">
                                <Button
                                    onClick={() => {
                                        setIsPartyDialogOpen(false);
                                        setIsVendorModalOpen(true);
                                    }}
                                    className="w-full"
                                    variant="outline"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create New Vendor
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Unlink Invoice Confirmation Dialog */}
                <Dialog open={showUnlinkConfirmDialog} onOpenChange={setShowUnlinkConfirmDialog}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502z" />
                                    </svg>
                                </div>
                                Unlink Invoice
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-6">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-2.502V7.817c0-1.326-.896-2.502-2.502H4.817c-1.326 0-2.502.896-2.502 2.502v4.681c0 1.326.896 2.502 2.502 2.502z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-yellow-800 mb-1">
                                            <strong>Warning:</strong> This action cannot be undone
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Are you sure you want to unlink the invoice? This will remove all items loaded from the invoice and you'll need to add items manually.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3">
                                <Button variant="outline" onClick={() => setShowUnlinkConfirmDialog(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        setItems([]);
                                        setDebitNoteExistsForCurrentInvoice(false);
                                        setShowUnlinkConfirmDialog(false);
                                        toast.success('Invoice unlinked successfully');
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
                <Dialog open={isShippingModalOpen} onOpenChange={setIsShippingModalOpen}>
                    <DialogContent className="sm:max-w-[500px] max-h-[70vh] overflow-hidden">
                        <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100">
                            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-blue-600" />
                                Select Shipping Address
                            </DialogTitle>
                        </DialogHeader>

                        <div className="px-6 py-4 space-y-6 overflow-y-auto max-h-[calc(70vh-120px)]">
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
                                                const isSelected = selectedAddress?.uuid === address.uuid;
                                                return (
                                                    <div
                                                        key={address.uuid || index}
                                                        className={`group relative border rounded-lg p-3 cursor-pointer transition-all duration-200 ${isSelected
                                                            ? "border-blue-500 bg-blue-50"
                                                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                                                        onClick={() => setSelectedAddress(address)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? "bg-blue-100" : "bg-gray-100 group-hover:bg-gray-200"}`}>
                                                                {address.address_type === "home" ? (
                                                                    <HomeIcon className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                                                                ) : address.address_type === "work" ? (
                                                                    <BriefcaseIcon className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                                                                ) : (
                                                                    <MapPinIcon className={`h-4 w-4 ${isSelected ? "text-red-600" : "text-red-500"}`} />
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
                                                                    <div
                                                                        className="relative"
                                                                        ref={address.uuid === activeDropdownUuid ? dropdownRef : null}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const uuid = address.uuid;
                                                                                if (!uuid) return;
                                                                                if (activeDropdownUuid === uuid) {
                                                                                    setActiveDropdownUuid(null);
                                                                                    setButtonPosition(null);
                                                                                } else {
                                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                                    setButtonPosition({ top: rect.top, left: rect.right + 8 });
                                                                                    setActiveDropdownUuid(uuid);
                                                                                }
                                                                            }}
                                                                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100"
                                                                        >
                                                                            <MoreVertical className="w-4 h-4" />
                                                                        </button>
                                                                        {activeDropdownUuid === address.uuid && (
                                                                            <div className="absolute right-full mr-2 top-0 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[100]">
                                                                                <div className="py-1" role="menu">
                                                                                    {!address.is_default && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => { e.stopPropagation(); handleSetDefaultAddress(); }}
                                                                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                                                        >
                                                                                            <MapPin className="w-4 h-4 text-green-500" />
                                                                                            <span>Set as Default</span>
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => { e.stopPropagation(); handleEditAddress(); }}
                                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600 flex items-center gap-2"
                                                                                    >
                                                                                        <Edit className="w-4 h-4" />
                                                                                        <span>Edit</span>
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteAddress(); }}
                                                                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
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
                                                                        <span className="font-medium text-gray-500">Address:</span>{" "}
                                                                        {[address.address1, address.address2].filter(Boolean).join(", ")},
                                                                        <span className="font-medium text-gray-500"> State:</span>{" "}
                                                                        {address.state},
                                                                        <span className="font-medium text-gray-500"> Country:</span>{" "}
                                                                        {address.country}
                                                                    </p>
                                                                    <p className="text-xs text-gray-700 leading-relaxed">
                                                                        <span className="font-medium text-gray-500">City:</span>{" "}
                                                                        {address.city},
                                                                        <span className="font-medium text-gray-500"> Pin:</span>{" "}
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
                                            <MapPinIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-xs font-medium text-gray-600 mb-1">No saved addresses found</p>
                                            <p className="text-xs text-gray-500">No shipping addresses available for this customer</p>
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
                                                toast.error(error.response?.data?.error || "Failed to save shipping address. Please try again.");
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

                {/* Vendor Creation Modal */}
                <ModalVendor
                    open={isVendorModalOpen}
                    onOpenChange={(open) => {
                        setIsVendorModalOpen(open);
                        if (!open) {
                            // When modal is closed after successful creation, refresh vendors
                            fetchParties();
                        }
                    }}
                    vendor={null}
                />

            </div>
        </div>
    );
};

export default CreateDebitNotePage;