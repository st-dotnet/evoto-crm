import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Plus, Search, Barcode, Calendar, ChevronDown, Trash2, X, UserPlus, MapPin, Briefcase, Home, MapPinIcon, HomeIcon, BriefcaseIcon, MoreVertical, Edit } from 'lucide-react';
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

// Helper function to safely extract numeric value from potentially nested objects
const extractNumericValue = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    
    // Handle nested objects: tax_percentage, discount_percentage, etc.
    if (typeof val === 'object') {
        // Check for common property names
        const possibleKeys = ['tax_percentage', 'discount_percentage', 'percentage', 'value', 'amount'];
        for (const key of possibleKeys) {
            if (val[key] !== undefined) {
                // Recursively extract if the value found is also an object (handles double nesting)
                return extractNumericValue(val[key]);
            }
        }
    }
    return 0;
};

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
        total_amount: 0,
        additional_charges_total: 0,
        auto_round_off: false,
        mark_as_fully_paid: false,
        amount_received: 0,
        balance_due: 0,
        payment_date: '',
        payment_method: '',
        payment_reference: '',
        payment_notes: ''
    });

    const [isInvoicePaid, setIsInvoicePaid] = useState(false);
    const [itemsLoaded, setItemsLoaded] = useState(false);
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const editDataLoadedRef = useRef(false);

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
        // Use pre-calculated item amounts for consistency
        const totalAmount = updatedItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        
        // Calculate individual components for display purposes
        const subtotal = updatedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price_per_item), 0);
        const totalDiscount = updatedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price_per_item * item.discount / 100), 0);
        const totalTax = updatedItems.reduce((sum: number, item: any) => sum + ((item.quantity * item.price_per_item * (1 - item.discount / 100)) * item.tax / 100), 0);

        let roundOff = 0;
        let finalTotal = totalAmount;

        if (debitNoteData.auto_round_off) {
            const roundedTotal = Math.round(finalTotal);
            roundOff = roundedTotal - finalTotal;
            finalTotal = roundedTotal;
        }

        setDebitNoteData(prev => {
            return {
                ...prev,
                subtotal,
                total_discount: totalDiscount,
                total_tax: totalTax,
                round_off_amount: roundOff,
                totalAmount: finalTotal,
                total_amount: finalTotal
            };
        });
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
                    }
    };

    const handleMarkAsFullyPaid = async () => {
        if (!isEditMode || !id) {
            toast.error('This action is only available in edit mode');
            return;
        }

        setIsSaving(true);
        try {
            // Update the debit note status to 'credited'
            const response = await updateDebitNote(id, {
                ...debitNoteData,
                status: 'credited',
                amount_received: debitNoteData.totalAmount,
                balance_due: 0
            });

            if (response.success) {
                toast.success('Debit note marked as fully paid and status changed to credited');
                // Update local state
                setDebitNoteData(prev => ({
                    ...prev,
                    status: 'credited',
                    amount_received: prev.totalAmount,
                    balance_due: 0
                }));
            } else {
                // Handle specific validation errors
                if (response.error?.includes('already marked as fully paid')) {
                    toast.error('This debit note is already marked as fully paid');
                } else if (response.error?.includes('Amount received must equal total amount')) {
                    toast.error('Amount received must equal total amount to mark as fully paid');
                } else if (response.error?.includes('Cannot change status from')) {
                    toast.error('Cannot change status from credited (fully paid)');
                } else {
                    toast.error(response.error || 'Failed to update debit note status');
                }
            }
        } catch (error) {
                        toast.error('Failed to update debit note status');
        } finally {
            setIsSaving(false);
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
            // Determine status based on checkbox only
            let finalStatus = debitNoteData.mark_as_fully_paid ? "credited" : "unpaid";

            let response;
            if (isEditMode) {
                // For update, send simplified payload as expected by new backend
                const updatePayload = {
                    items: items.map(item => ({
                        item_id: item.item_id,
                        quantity: item.quantity,
                        unit_price: item.price_per_item, // Backend expects unit_price
                        tax: item.tax, // Backend needs tax percentage for calculations
                        description: item.description || null,
                        hsn_sac_code: item.hsn_sac || null, // Backend expects hsn_sac_code
                    })),
                    total_amount: debitNoteData.total_amount,
                    subtotal: debitNoteData.subtotal,
                    total_discount: debitNoteData.total_discount,
                    total_tax: debitNoteData.total_tax,
                    round_off_amount: debitNoteData.round_off_amount,
                    mark_as_fully_paid: debitNoteData.mark_as_fully_paid || false
                };
                
                response = await updateDebitNote(id!, updatePayload);
            } else {
                // For create, send full payload as expected by createDebitNote
                                const createPayload = {
                    debitNoteNo: debitNoteData.debitNoteNo,
                    debitNoteDate: debitNoteData.debitNoteDate,
                    linkToInvoice: debitNoteData.linkToInvoice,
                    vendorId: debitNoteData.vendorId,
                    status: finalStatus,
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
                    total_amount: debitNoteData.total_amount,
                    additional_charges: debitNoteData.additional_charges_total,
                    mark_as_fully_paid: debitNoteData.mark_as_fully_paid || false,
                };
                
                response = await createDebitNote(createPayload);
            }

            if (response.success) {
                // Show appropriate success message
                if (debitNoteData.mark_as_fully_paid) {
                    toast.success(isEditMode ? 'Debit note marked as fully paid and updated successfully' : 'Debit note marked as fully paid and created successfully');
                } else {
                    toast.success(isEditMode ? 'Debit note updated successfully' : 'Debit note created successfully');
                }
                
                // Refresh UI with backend response data for edit mode
                if (isEditMode) {
                                        
                    // Fetch the updated debit note data to get correct tax values
                    try {
                        const updatedDebitNoteResponse = await getDebitNoteById(id!);
                        if (updatedDebitNoteResponse.success && updatedDebitNoteResponse.data) {
                            // Update items with backend-calculated values
                            if (updatedDebitNoteResponse.data.items && Array.isArray(updatedDebitNoteResponse.data.items)) {
                                const updatedItems = updatedDebitNoteResponse.data.items.map((backendItem: any) => ({
                                    uuid: backendItem.uuid || crypto.randomUUID(),
                                    item_id: backendItem.item_id,
                                    item_name: backendItem.product_name || backendItem.item_name,
                                    hsn_sac: backendItem.hsn_sac_code,
                                    quantity: backendItem.quantity,
                                    originalQty: backendItem.quantity, // Update original quantity to match new quantity
                                    price_per_item: backendItem.unit_price,
                                    discount: backendItem.discount?.discount_percentage || backendItem.discount_percentage || 0,
                                    tax: backendItem.tax?.tax_percentage || backendItem.tax_percentage || 0,
                                    amount: backendItem.total_price,
                                    measuring_unit_id: backendItem.measuring_unit_id,
                                    description: backendItem.description,
                                    discount_type: 'percentage',
                                    tax_type: 'percentage',
                                    subtotal: backendItem.quantity * backendItem.unit_price,
                                    discount_amount: backendItem.discount_amount || 0,
                                    tax_amount: backendItem.tax_amount || (backendItem.quantity * backendItem.unit_price * (backendItem.tax?.tax_percentage || backendItem.tax_percentage || 0) / 100) || 0
                                }));
                                
                                setItems(updatedItems);
                                recalculateTotals(updatedItems);
                            }
                            
                            // Update debit note data with backend totals
                            if (updatedDebitNoteResponse.data.charges) {
                                setDebitNoteData(prev => ({
                                    ...prev,
                                    subtotal: updatedDebitNoteResponse.data.charges.subtotal || 0,
                                    total_discount: (updatedDebitNoteResponse.data.charges.item_discount || 0) + (updatedDebitNoteResponse.data.charges.overall_discount || 0),
                                    total_tax: updatedDebitNoteResponse.data.charges.tax_total || 0,
                                    round_off_amount: updatedDebitNoteResponse.data.charges.round_off || 0,
                                    totalAmount: updatedDebitNoteResponse.data.total_amount || 0,
                                    total_amount: updatedDebitNoteResponse.data.total_amount || 0,
                                    balance_due: updatedDebitNoteResponse.data.balance_due || 0,
                                    amount_received: updatedDebitNoteResponse.data.amount_paid || 0
                                }));
                            }
                        }
                    } catch (error) {
                    }
                }
                
                // Update local state if marked as fully paid
                if (debitNoteData.mark_as_fully_paid) {
                    setDebitNoteData(prev => ({
                        ...prev,
                        status: 'credited',
                        amount_received: prev.totalAmount,
                        balance_due: 0
                    }));
                }

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
                // Handle specific validation errors for mark as fully paid
                if (isEditMode && debitNoteData.mark_as_fully_paid) {
                    if (response.error?.includes('already marked as fully paid')) {
                        toast.error('This debit note is already marked as fully paid');
                        // Revert checkbox on error
                        setDebitNoteData(prev => ({ ...prev, mark_as_fully_paid: false }));
                    } else if (response.error?.includes('Amount received must equal total amount')) {
                        toast.error('Amount received must equal total amount to mark as fully paid');
                        // Revert checkbox on error
                        setDebitNoteData(prev => ({ ...prev, mark_as_fully_paid: false }));
                    } else if (response.error?.includes('Cannot change status from')) {
                        toast.error('Cannot change status from credited (fully paid)');
                        // Revert checkbox on error
                        setDebitNoteData(prev => ({ ...prev, mark_as_fully_paid: false }));
                    } else {
                        toast.error(response.error || 'Failed to save debit note');
                    }
                } else {
                    toast.error(response.error || 'Failed to save debit note');
                }
            }
        } catch (error) {
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

    const handleItemChange = (index: number, field: string, value: any) => {
                
        const updatedItems = [...items];
        const item = updatedItems[index];
        
        if (field === 'quantity') {
                        item.quantity = value;
        } else if (field === 'price_per_item') {
            item.price_per_item = value;
        } else if (field === 'tax') {
                        item.tax = value;
        } else if (field === 'discount') {
            item.discount = value;
        } else if (field === 'description') {
            item.description = value;
        } else if (field === 'hsn_sac') {
            item.hsn_sac = value;
        }
        
        // Recalculate amount for this item
        const subtotal = item.quantity * item.price_per_item;
        const discountAmount = (subtotal * item.discount) / 100;
        const taxableAmount = subtotal - discountAmount;
        const taxAmount = (taxableAmount * item.tax) / 100;
        item.amount = subtotal - discountAmount + taxAmount;
        
        // Update derived fields
        item.subtotal = subtotal;
        item.discount_amount = discountAmount;
        item.tax_amount = taxAmount;
        
        setItems(updatedItems);
        recalculateTotals(updatedItems);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        recalculateTotals(newItems);
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
                if (!isEditMode) { setShowInvoiceDropdown(true); }
            } else {
                setVendorInvoices([]);
                if (!isEditMode) { setShowInvoiceDropdown(true); }
            }
        } catch (error) {
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
            status: prev.status // Keep existing status, don't auto-set to credited
        }));
        setShowInvoiceDropdown(false);

        const invoiceId = invoice.uuid;
        if (!invoiceId) {
            toast.error('Invalid invoice data - missing ID');
            return;
        }

        try {
            // Check if debit note already exists for this invoice
            const debitNoteCheckResponse = await checkDebitNoteExistsForInvoice(invoiceId);
            if (debitNoteCheckResponse.success && debitNoteCheckResponse.data?.hasDebitNote === true) {
                setDebitNoteExistsForCurrentInvoice(false);
                toast.error('A debit note already exists for this invoice. Please select a different invoice.');
                return;
            } else {
                setDebitNoteExistsForCurrentInvoice(false);
            }

            const response = await getPurchaseInvoiceById(invoiceId);
            if (response.success && response.data?.items && response.data.items.length > 0) {
                const transformedItems = response.data.items.map((item: any) => {
                    const transformed = {
                        uuid: item.uuid || Date.now().toString() + Math.random(),
                        item_id: item.item_id,
                        item_name: item.product_name || item.item_name,
                        hsn_sac: item.hsn_sac_code,
                        quantity: item.quantity,
                        originalQty: item.quantity,
                        price_per_item: item.unit_price,
                        discount: extractNumericValue(item.discount),
                        tax: extractNumericValue(item.tax),
                        amount: item.quantity * item.unit_price * (1 - extractNumericValue(item.discount) / 100) * (1 + extractNumericValue(item.tax) / 100),
                        measuring_unit_id: item.measuring_unit_id,
                        description: item.description || null,
                    };
                    return transformed;
                });
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

    // Function to handle customer/vendor selection
    const handleCustomerSelect = (vendor: any) => {
        setSelectedParty(vendor);
        setSelectedCustomer(vendor);
        setIsPartyDialogOpen(false);
        
        // Update debit note data with selected party information
        setDebitNoteData(prev => ({
            ...prev,
            customer_uuid: vendor.uuid,
            customer_name: vendor.name,
        }));
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
                            status: prev.status || 'unpaid' // Keep existing status or default to unpaid
                        }));

                        const transformedItems = response.data.items.map((item: any) => ({
                            uuid: item.uuid || Date.now().toString() + Math.random(),
                            item_id: item.item_id,
                            item_name: item.product_name || item.item_name,
                            hsn_sac: item.hsn_sac_code,
                            quantity: item.quantity,
                            originalQty: item.quantity,
                            price_per_item: item.unit_price,
                            discount: extractNumericValue(item.discount),
                            tax: extractNumericValue(item.tax),
                            amount: item.quantity * item.unit_price * (1 - extractNumericValue(item.discount) / 100) * (1 + extractNumericValue(item.tax) / 100),
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

    // Simple edit mode loader - load debit note data when in edit mode (only once)
    useEffect(() => {
        if (isEditMode && id && !editDataLoadedRef.current) {
            editDataLoadedRef.current = true; // Set immediately to prevent re-runs
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

                        const debitNoteStatus = debitNote.status || debitNote.data?.debit_note?.status || 'unpaid';
                        setDebitNoteData(prev => ({
                            ...prev,
                            debitNoteNo: debitNote.debit_note_number || debitNote.data?.debit_note?.debit_note_number || '',
                            debitNoteDate: debitNote.debit_note_date || debitNote.data?.debit_note?.debit_note_date || new Date().toISOString().split('T')[0],
                            linkToInvoice: debitNote.data?.invoice_number || debitNote.data?.invoice_no || debitNote.data?.debit_note?.invoice_number || debitNote.data?.debit_note?.invoice_no || debitNote.invoice_number || debitNote.linked_invoice_id || debitNote.data?.debit_note?.linked_invoice_id || '',
                            linkToInvoiceId: finalInvoiceId || '',
                            status: debitNoteStatus,
                            notes: debitNote.notes || debitNote.data?.debit_note?.notes || '',
                            terms: debitNote.terms_and_conditions || debitNote.data?.debit_note?.terms_and_conditions || '',
                            mark_as_fully_paid: debitNote.mark_as_fully_paid !== undefined ? debitNote.mark_as_fully_paid : debitNoteStatus === 'credited',
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
                        
                        // Load debit note items - only if not already loaded to prevent overwriting user changes
                        const debitNoteItems = debitNote.debit_note_items || debitNote.items || debitNote.data?.debit_note?.debit_note_items || debitNote.data?.debit_note?.items || debitNote.data?.items || []; 
                        
                        if (debitNoteItems.length > 0 && !itemsLoaded) {
                            const transformedItems = debitNoteItems.map((item: any) => {                                
                                const quantity = item.quantity || 0;
                                const pricePerItem = item.unit_price || item.price_per_item || 0;
                                const discount = extractNumericValue(item.discount_percentage || item.discount);
                                const tax = extractNumericValue(item.tax_percentage || item.tax);
                                const discountType = item.discount_type || 'percentage';
                                const taxType = item.tax_type || 'percentage';
                                
                                
                                // Use backend-provided original_quantity field, fallback to original backend quantity
                                const originalQty = item.original_quantity || item.quantity || 0;
                                
                                const calculatedAmount = calculateItemAmount(quantity, pricePerItem, discount, tax, discountType, taxType);
                                
                                const transformed = {
                                    uuid: item.uuid || item.id,
                                    item_id: item.item_id,
                                    item_name: item.item_name,
                                    hsn_sac: item.hsn_sac_code || item.hsn_sac,
                                    quantity, // Keep user-set quantity
                                    originalQty: originalQty, // Use backend original_quantity as max allowed
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
                                return transformed;
                            });
                            setItems(transformedItems);
                            recalculateTotals(transformedItems);
                            setItemsLoaded(true); // Mark as loaded to prevent re-loading
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
            setInitialDataLoaded(true);
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
            <div className="bg-white border-b px-3 sm:px-4 py-2.5 sm:py-3 sticky top-0 z-40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/debit-note')}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[200px] sm:max-w-none">
                                {isViewMode ? 'View Debit Note' : isEditMode ? 'Edit Debit Note' : 'Create Debit Note'}
                            </h1>
                            {isInvoicePaid && (
                                <p className="text-[10px] text-red-600 font-medium sm:hidden">Invoice Paid - Read Only</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        {!isViewMode && (
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || isInvoicePaid || debitNoteExistsForCurrentInvoice}
                                className="w-full sm:w-auto min-w-[100px]"
                            >
                                {isSaving ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Saving...</span>
                                    </div>
                                ) : (
                                    <span>{isEditMode ? 'Update' : 'Create'}</span>
                                )}
                            </Button>
                        )}
                        {isViewMode && (
                            <Button
                                onClick={() => navigate(`/debit-note/edit/${id}`)}
                                className="w-full sm:w-auto min-w-[100px]"
                            >
                                Edit
                            </Button>
                        )}
                    </div>
                </div>
                {isInvoicePaid && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg hidden sm:block">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-red-800 font-medium">This invoice is already paid. Debit note editing is disabled.</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                {/* Top Section: Bill To, Ship To, and Debit Note Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="flex flex-col md:flex-row gap-4 sm:gap-5 lg:col-span-2">
                        <div className="flex-1 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Bill To <span className="text-red-500">*</span></h3>
                            {selectedParty ? (
                                <div className="border rounded-xl min-h-[140px] sm:min-h-[160px] p-3 sm:p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                                                {selectedParty.name}
                                            </h4>
                                            <div className="mt-2 text-xs sm:text-sm text-gray-600 space-y-1">
                                                <p className="line-clamp-2">
                                                    {selectedParty.vendor?.address1 || selectedParty.address1 || selectedParty.customerData?.address1}
                                                    {selectedParty.vendor?.address2 || selectedParty.address2 || selectedParty.customerData?.address2 ? `, ${selectedParty.vendor?.address2 || selectedParty.address2 || selectedParty.customerData?.address2}` : ''}
                                                </p>
                                                <p>
                                                    {[
                                                        selectedParty.vendor?.city || selectedParty.city || selectedParty.customerData?.city,
                                                        selectedParty.vendor?.state || selectedParty.state || selectedParty.customerData?.state,
                                                        selectedParty.vendor?.pin || selectedParty.pin || selectedParty.customerData?.pin
                                                    ].filter(Boolean).join(", ")}
                                                </p>
                                                <div className="pt-1 space-y-0.5">
                                                    {selectedParty.mobile && (
                                                        <p><span className="font-medium text-gray-500">Phone:</span> {selectedParty.mobile}</p>
                                                    )}
                                                    {(selectedParty.vendor?.gst || selectedParty.customerData?.gst) && (
                                                        <p><span className="font-medium text-gray-500">GST:</span> {selectedParty.vendor?.gst || selectedParty.customerData?.gst}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsPartyDialogOpen(true)}
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 shrink-0"
                                        >
                                            Change
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 hover:border-gray-300 transition-all cursor-pointer min-h-[160px]"
                                     onClick={() => setIsPartyDialogOpen(true)}>
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                        <UserPlus className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <span className="font-medium text-blue-600 text-sm">Select Vendor</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Ship To</h3>
                            <div className="border rounded-xl h-auto min-h-[140px] sm:min-h-[160px] p-3 sm:p-4 bg-white shadow-sm">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                                                {businessProfile.name}
                                            </h4>
                                            <span className="shrink-0 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md font-medium border border-blue-100">
                                                Self
                                            </span>
                                        </div>
                                        <div className="mt-2 text-xs sm:text-sm text-gray-600 space-y-1">
                                            <p className="line-clamp-2">{businessProfile.address1}</p>
                                            <p>
                                                {[businessProfile.city, businessProfile.state, businessProfile.pin].filter(Boolean).join(", ")}
                                            </p>
                                            <div className="pt-1 space-y-0.5">
                                                {businessProfile.phone && (
                                                    <p><span className="font-medium text-gray-500">Phone:</span> {businessProfile.phone}</p>
                                                )}
                                                {businessProfile.gst && (
                                                    <p><span className="font-medium text-gray-500">GST:</span> {businessProfile.gst}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Debit Note Details */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">Debit Note Details</h3>
                        <Card className="border-gray-200 shadow-sm overflow-hidden">
                            <CardContent className="p-3 sm:p-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Debit Note No</label>
                                        <Input
                                            value={debitNoteData.debitNoteNo}
                                            onChange={(e) => setDebitNoteData(prev => ({ ...prev, debitNoteNo: e.target.value }))}
                                            placeholder="auto"
                                            className="h-9 text-sm"
                                            disabled={isViewMode}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</label>
                                        <Input
                                            type="date"
                                            value={debitNoteData.debitNoteDate}
                                            onChange={(e) => setDebitNoteData(prev => ({ ...prev, debitNoteDate: e.target.value }))}
                                            className="h-9 text-sm"
                                            disabled={isViewMode}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Link to Invoice</label>
                                    <div className="relative">
                                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400">
                                            {isInvoiceDropdownLoading ? (
                                                <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Search className="h-4 w-4" />
                                            )}
                                        </div>
                                        <Input
                                            id="linkToInvoice"
                                            placeholder={selectedCustomer ? "Search invoices..." : "Select vendor first"}
                                            value={debitNoteData.linkToInvoice}
                                            onFocus={() => selectedCustomer && fetchPartyInvoices()}
                                            className="pl-9 h-9 text-sm"
                                            disabled={!selectedCustomer || isViewMode || isInvoicePaid || debitNoteData.linkToInvoice !== ''}
                                            readOnly={debitNoteData.linkToInvoice !== ''}
                                        />
                                        
                                        {debitNoteData.linkToInvoice && !isViewMode && (
                                            <button
                                                onClick={() => setShowUnlinkConfirmDialog(true)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}

                                        {showInvoiceDropdown && (
                                            <div className="invoice-dropdown absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                                {vendorInvoices.length > 0 ? (
                                                    <div className="p-1">
                                                        {vendorInvoices.map((invoice) => (
                                                            <div
                                                                key={invoice.uuid}
                                                                className="flex flex-col p-2.5 hover:bg-blue-50 cursor-pointer rounded-md transition-colors border-b border-gray-50 last:border-0"
                                                                onClick={() => handleInvoiceSelect(invoice)}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="font-semibold text-gray-900 text-sm">{invoice.invoice_number}</span>
                                                                    <span className="font-bold text-blue-600 text-sm">₹{invoice.total_amount?.toLocaleString()}</span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>{invoice.invoice_date}</span>
                                                                    <span className="ml-auto px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{invoice.payment_status}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-gray-500">
                                                        No active invoices found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {debitNoteExistsForCurrentInvoice && (
                                        <p className="text-[10px] text-red-500 mt-1 px-1">⚠️ Debit note already exists for this invoice</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Middle Section: Items/Services Table */}
                <Card className="overflow-hidden border-gray-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50/50 border-b">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600">Items/Services</CardTitle>
                            {items.length > 0 && debitNoteData.linkToInvoice !== '' && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md font-bold border border-amber-200 uppercase">
                                    Linked
                                </div>
                            )}
                        </div>
                        <Button
                            size="sm"
                            onClick={handleAddItem}
                            disabled={debitNoteData.linkToInvoice !== ''}
                            className="h-8 text-xs gap-1.5"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Item</span>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-200">
                                        <th className="text-left p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-12">#</th>
                                        <th className="text-left p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 min-w-[200px]">Item Details</th>
                                        <th className="text-left p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-32 text-center">HSN/SAC</th>
                                        <th className="text-center p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-32">Quantity</th>
                                        <th className="text-right p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-36">Price (₹)</th>
                                        <th className="text-center p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-32">Discount (%)</th>
                                        <th className="text-center p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-24">Tax (%)</th>
                                        <th className="text-right p-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-36">Total (₹)</th>
                                        <th className="p-4 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item, index) => (
                                        <tr key={item.uuid || index} className="group hover:bg-gray-50/80 transition-colors">
                                            <td className="p-4 text-sm text-gray-400 font-medium">{index + 1}</td>
                                            <td className="p-4">
                                                <div className="space-y-1.5">
                                                    <div className="text-sm font-semibold text-gray-900 line-clamp-1" title={item.item_name}>{item.item_name}</div>
                                                    <textarea
                                                        value={item.description || ""}
                                                        disabled={debitNoteData.linkToInvoice !== ''}
                                                        rows={1}
                                                        placeholder="Add description..."
                                                        className="w-full text-xs text-gray-500 bg-transparent border-none p-0 focus:ring-0 resize-none"
                                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Input
                                                    value={item.hsn_sac || ''}
                                                    onChange={(e) => handleItemChange(index, 'hsn_sac', e.target.value)}
                                                    className="h-8 text-xs text-center font-medium bg-transparent border-gray-200"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                            if (debitNoteData.linkToInvoice !== '' && item.originalQty !== undefined && val > item.originalQty) {
                                                                handleItemChange(index, 'quantity', item.originalQty);
                                                            } else {
                                                                handleItemChange(index, 'quantity', Math.max(0, val));
                                                            }
                                                        }}
                                                        className={`h-8 text-xs text-center font-bold ${debitNoteData.linkToInvoice !== '' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-transparent'}`}
                                                    />
                                                    {debitNoteData.linkToInvoice !== '' && item.originalQty !== undefined && (
                                                        <p className="text-[9px] text-amber-600 font-bold text-center">MAX: {item.originalQty}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">₹</span>
                                                    <Input
                                                        type="number"
                                                        value={item.price_per_item}
                                                        disabled={debitNoteData.linkToInvoice !== ''}
                                                        onChange={(e) => handleItemChange(index, 'price_per_item', parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right pl-5 font-medium bg-transparent"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Input
                                                    type="number"
                                                    value={item.discount}
                                                    disabled={debitNoteData.linkToInvoice !== ''}
                                                    onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                                                    className="h-8 text-xs text-center font-medium bg-transparent"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <select
                                                    value={item.tax}
                                                    disabled={debitNoteData.linkToInvoice !== ''}
                                                    className="w-full h-8 text-xs text-center font-medium bg-transparent border border-gray-200 rounded-md focus:ring-0"
                                                    onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                                                >
                                                    {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                                                </select>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="text-sm font-bold text-gray-900">₹{item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </td>
                                            <td className="p-4">
                                                <button onClick={() => handleRemoveItem(index)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {items.map((item, index) => (
                                <div key={item.uuid || index} className="p-4 space-y-4 bg-white">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Item {index + 1}</p>
                                            <h4 className="text-sm font-bold text-gray-900 truncate">{item.item_name}</h4>
                                        </div>
                                        <button onClick={() => handleRemoveItem(index)} className="p-1.5 text-red-500 bg-red-50 rounded-md">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Qty</label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                        if (debitNoteData.linkToInvoice !== '' && item.originalQty !== undefined && val > item.originalQty) {
                                                            handleItemChange(index, 'quantity', item.originalQty);
                                                        } else {
                                                            handleItemChange(index, 'quantity', Math.max(0, val));
                                                        }
                                                    }}
                                                    className={`h-9 text-sm font-bold ${debitNoteData.linkToInvoice !== '' ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}`}
                                                />
                                                {debitNoteData.linkToInvoice !== '' && (
                                                    <span className="absolute -top-4 right-0 text-[8px] font-bold text-amber-600 uppercase">Max: {item.originalQty}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Price (₹)</label>
                                            <Input
                                                type="number"
                                                value={item.price_per_item}
                                                disabled={debitNoteData.linkToInvoice !== ''}
                                                className="h-9 text-sm font-medium"
                                                onChange={(e) => handleItemChange(index, 'price_per_item', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disc (%)</label>
                                            <Input
                                                type="number"
                                                value={item.discount}
                                                disabled={debitNoteData.linkToInvoice !== ''}
                                                className="h-9 text-sm font-medium"
                                                onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tax (%)</label>
                                            <select
                                                value={item.tax}
                                                disabled={debitNoteData.linkToInvoice !== ''}
                                                className="w-full h-9 text-sm font-medium border border-gray-200 rounded-md bg-white"
                                                onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                                            >
                                                {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Subtotal</span>
                                        <span className="text-base font-black text-gray-900">₹{item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {items.length === 0 && (
                            <div className="py-12 flex flex-col items-center justify-center bg-gray-50/50">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <Barcode className="h-6 w-6 text-gray-400" />
                                </div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No Items Added</p>
                                <Button
                                    variant="link"
                                    onClick={handleAddItem}
                                    disabled={debitNoteData.linkToInvoice !== ''}
                                    className="mt-1 text-blue-600 font-bold"
                                >
                                    Add Your First Item
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Bottom Section: Notes, Summary, and Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Notes & Terms */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        <Card className="border-gray-200 shadow-sm">
                            <CardHeader className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50/50 border-b">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600">Notes & Terms</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-4 space-y-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="notes" className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Notes</label>
                                    <textarea
                                        id="notes"
                                        value={debitNoteData.notes || ''}
                                        onChange={(e) => setDebitNoteData(prev => ({ ...prev, notes: e.target.value }))}
                                        className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all min-h-[80px]"
                                        placeholder="Add any internal notes..."
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="terms" className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Terms & Conditions</label>
                                    <textarea
                                        id="terms"
                                        value={debitNoteData.terms_and_conditions || ''}
                                        onChange={(e) => setDebitNoteData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                                        className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all min-h-[80px]"
                                        placeholder="Standard terms apply..."
                                        disabled={isViewMode}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {!isViewMode && (
                            <Card className="border-gray-200 shadow-sm overflow-hidden">
                                <CardHeader className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50/50 border-b">
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600">Document Status</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 sm:p-4">
                                    <div className="flex flex-wrap gap-2">
                                        {['draft', 'sent', 'accepted', 'rejected'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => setDebitNoteData(prev => ({ ...prev, status }))}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                                    debitNoteData.status === status
                                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                                        : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Summary */}
                    <Card className="border-gray-200 shadow-lg bg-white overflow-hidden h-fit">
                        <CardHeader className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-900 text-white">
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Subtotal</span>
                                    <span className="font-bold text-gray-900">₹{debitNoteData.subtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Total Discount</span>
                                    <span className="font-bold text-red-600">-₹{debitNoteData.total_discount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Total Tax</span>
                                    <span className="font-bold text-green-600">+₹{debitNoteData.total_tax?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                
                                {debitNoteData.auto_round_off && (
                                    <div className="flex justify-between items-center text-xs border-t border-dashed pt-3">
                                        <span className="text-gray-400 font-bold uppercase tracking-tighter">Round Off</span>
                                        <span className={`font-bold ${debitNoteData.round_off_amount >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                                            {debitNoteData.round_off_amount >= 0 ? '+' : ''}₹{debitNoteData.round_off_amount?.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="autoRoundOff" className="text-xs font-bold text-gray-600 uppercase cursor-pointer">Auto Round Off</label>
                                    <Checkbox
                                        id="autoRoundOff"
                                        checked={debitNoteData.auto_round_off}
                                        onCheckedChange={(checked: boolean) => setDebitNoteData(prev => ({ ...prev, auto_round_off: checked }))}
                                        className="h-5 w-5 border-gray-300"
                                    />
                                </div>
                                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                                    <div className="flex flex-col">
                                        <label htmlFor="markAsFullyPaid" className="text-xs font-bold text-gray-900 uppercase cursor-pointer">Mark as Fully Paid</label>
                                        <p className="text-[9px] text-gray-400 font-medium leading-none mt-1 italic">Status will change to 'Credited'</p>
                                    </div>
                                    <Checkbox
                                        id="markAsFullyPaid"
                                        checked={debitNoteData.mark_as_fully_paid}
                                        onCheckedChange={(checked: boolean) => setDebitNoteData(prev => ({ ...prev, mark_as_fully_paid: checked }))}
                                        disabled={isSaving}
                                        className="h-5 w-5 border-gray-300"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-gray-900 flex justify-between items-end">
                                <span className="text-[10px] sm:text-xs font-black text-gray-900 uppercase tracking-widest mb-1">Grand Total</span>
                                <div className="flex flex-col items-end">
                                    <span className="text-xl sm:text-2xl font-black text-gray-900 leading-none">
                                        ₹{debitNoteData.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                    <p className="text-[8px] sm:text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-tighter">Amount in INR</p>
                                </div>
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
                                                                    {vendor.name.split(" ").map((n: string, i: number) => n[0]).join("").toUpperCase()}
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
                                        setDebitNoteData(prev => ({
                                            ...prev,
                                            linkToInvoice: '',
                                            linkToInvoiceId: '',
                                            vendorId: '',
                                            status: 'unpaid'
                                        }));
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
