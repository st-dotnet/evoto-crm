import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, Share, CreditCard, Edit, X, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet";
import { getInvoiceById } from "../services/invoice.services";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SpinnerDotted } from "spinners-react";
import { useAuthContext } from "@/auth";
import { toAbsoluteUrl } from "@/utils/Assets";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Info } from "lucide-react";
import { recordPayment } from "../services/invoice.services";
import { createPaymentIn, generatePaymentNumber } from "../../payment-in/services/payment-in.service";
import { cn } from "@/lib/utils";
import { getCustomerById } from "@/pages/parties/services/customer.service";

interface InvoiceItem {
    uuid: string;
    item_id: string;
    product_name: string;
    description?: string | null;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    discount_amount: number;
    tax_percentage: number;
    tax_amount: number;
    total_price: number;
    measuring_unit_id?: number;
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
    billing_address?: any;
    shipping_address?: any;
}

interface InvoiceData {
    uuid: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    payment_status: string;
    customer: Customer;
    items: InvoiceItem[];
    subtotal: number;
    tax_total: number;
    discount_total: number;
    additional_charges_total: number;
    round_off: number;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
    notes?: string;
    terms_and_conditions?: string;
    payment_terms?: string;
    business?: any;
}

const InvoiceDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { currentUser } = useAuthContext();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // Payment Form State
    const [paymentForm, setPaymentForm] = useState({
        amountReceived: 0,
        discount: 0,
        date: new Date(),
        mode: "cash",
        notes: ""
    });
    const [amountError, setAmountError] = useState("");
    const [updatedBalance, setUpdatedBalance] = useState(0);

    const invoiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) {
            fetchInvoiceData();
        }
    }, [id]);

    const fetchInvoiceData = async () => {
        setIsLoading(true);
        try {
            const response = await getInvoiceById(id!);
            if (response.success && response.data) {
                const data = response.data;
                setInvoiceData(data);

                // Fetch customer details separately to get address information
                if (data.customer_id || data.customer?.uuid) {
                    const custId = data.customer_id || data.customer?.uuid;
                    try {
                        const customerRes = await getCustomerById(custId);
                        if (customerRes.success && customerRes.data) {
                            setInvoiceData(prev => prev ? ({
                                ...prev,
                                customer: {
                                    ...prev.customer,
                                    ...customerRes.data,
                                    billing_address: customerRes.data.billing_address || prev.customer?.billing_address,
                                    shipping_address: customerRes.data.shipping_address || prev.customer?.shipping_address,
                                }
                            }) : null);
                        }
                    } catch (custError) {
                        console.error("Error fetching customer details for invoice:", custError);
                    }
                }
            } else {
                toast.error(response.error || "Failed to load invoice");
                navigate("/invoices");
            }
        } catch (error) {
            console.error("Error fetching invoice:", error);
            toast.error("Failed to load invoice");
            navigate("/invoices");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!invoiceRef.current) return;

        const downloadToast = toast.loading("Generating PDF...");

        try {
            const element = invoiceRef.current;

            window.scrollTo(0, 0);

            const canvas = await html2canvas(element, {
                scale: 3, // Higher quality
                useCORS: true,
                backgroundColor: "#ffffff",
            });

            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF("p", "mm", "a4");

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const margin = 10; // Professional margin
            const usableWidth = pageWidth - margin * 2;

            const imgWidth = usableWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = margin;

            // First Page
            pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Extra Pages (Only if needed)
            while (heightLeft > 0) {
                position = heightLeft - imgHeight + margin;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Invoice-${invoiceData?.invoice_number || "Draft"}.pdf`);

            toast.success("PDF downloaded successfully", { id: downloadToast });

        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF", { id: downloadToast });
        }
    };

    const handlePrintPDF = () => {
        const originalTitle = document.title;
        document.title = " ";
        window.print();
        document.title = originalTitle;
    };

    const handleShare = async () => {
        if (!invoiceRef.current) return;
        const shareToast = toast.loading("Preparing for share...");
        try {
            const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to generate blob"));
            }, "image/png"));
            const file = new File([blob], `Invoice-${invoiceData?.invoice_number}.png`, { type: "image/png" });

            if (navigator.share) {
                await navigator.share({
                    files: [file],
                    title: `Invoice ${invoiceData?.invoice_number}`,
                    text: `Check out our invoice: ${invoiceData?.invoice_number}`
                });
                toast.success("Shared successfully", { id: shareToast });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Invoice-${invoiceData?.invoice_number}.png`;
                a.click();
                toast.success("Image saved (Direct sharing not supported)", { id: shareToast });
            }
        } catch (error) {
            toast.error("Failed to share", { id: shareToast });
        }
    };

    const handleRecordPayment = () => {
        if (!invoiceData) return;
        setPaymentForm({
            amountReceived: invoiceData.balance_due,
            discount: 0,
            date: new Date(),
            mode: "cash",
            notes: ""
        });
        setAmountError("");
        setIsRecordPaymentOpen(true);
    };

    const validateAmountReceived = (amount: number) => {
        if (!invoiceData) return;
        const maxAmount = invoiceData.balance_due;
        if (amount > maxAmount) {
            setAmountError(`Amount received cannot exceed pending amount of ${formatCurrency(maxAmount)}`);
        } else {
            setAmountError("");
        }
    };

    const handlePaymentHistory = () => {
        setIsPaymentHistoryOpen(true);
    };

    const handleActualRecordPayment = () => {
        setIsPaymentHistoryOpen(false);
        handleRecordPayment();
    };

    const handleSavePayment = async () => {
        if (!id || !invoiceData) return;

        setIsSavingPayment(true);
        try {
            const response = await recordPayment(
                id,
                paymentForm.amountReceived,
                paymentForm.mode,
                paymentForm.notes,
                paymentForm.discount
            );

            if (response.success) {
                // Update balance from response
                if (response.data?.balance_due !== undefined) {
                    setUpdatedBalance(response.data.balance_due);
                }
                toast.success("Payment recorded successfully");
                setIsRecordPaymentOpen(false);
                // Add small delay to ensure backend processes the payment
                setTimeout(() => {
                    fetchInvoiceData(); // Refresh data
                }, 500);
            } else {
                toast.error(response.error || "Failed to record payment");
            }
        } catch (error) {
            toast.error("An error occurred while recording payment");
        } finally {
            setIsSavingPayment(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `₹ ${amount.toFixed(2)}`;
    };

    const formatNumberInWords = (num: number) => {
        if (!Number.isFinite(num)) return "Zero Rupees";
        const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
        const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

        const twoDigits = (value: number) => {
            if (value === 0) return "";
            if (value < 10) return units[value];
            if (value < 20) return teens[value - 10];
            const ten = Math.floor(value / 10);
            const unit = value % 10;
            return unit ? `${tens[ten]} ${units[unit]}` : tens[ten];
        };

        const threeDigits = (value: number) => {
            if (value === 0) return "";
            const hundred = Math.floor(value / 100);
            const rest = value % 100;
            if (hundred === 0) return twoDigits(rest);
            if (rest === 0) return `${units[hundred]} Hundred`;
            return `${units[hundred]} Hundred ${twoDigits(rest)}`;
        };

        const toIndianWords = (value: number) => {
            if (value === 0) return "Zero";
            let remainder = value;
            const parts: string[] = [];

            const crore = Math.floor(remainder / 10000000);
            if (crore) { parts.push(`${threeDigits(crore)} Crore`); remainder %= 10000000; }
            const lakh = Math.floor(remainder / 100000);
            if (lakh) { parts.push(`${threeDigits(lakh)} Lakh`); remainder %= 100000; }
            const thousand = Math.floor(remainder / 1000);
            if (thousand) { parts.push(`${threeDigits(thousand)} Thousand`); remainder %= 1000; }
            const rest = remainder;
            if (rest) parts.push(threeDigits(rest));
            return parts.join(" ");
        };

        const totalPaise = Math.round(Math.abs(num) * 100);
        if (totalPaise === 0) return "Zero Rupees";
        const rupees = Math.floor(totalPaise / 100);
        const paise = totalPaise % 100;
        let result = `${toIndianWords(rupees)} Rupees`;
        if (paise) result += ` and ${toIndianWords(paise)} Paise`;
        return result;
    };

    const getAuthBusinessInfo = () => {
        // 1. Try to get business info from fetched invoice data
        const fetchedBusiness = invoiceData?.business;
        if (fetchedBusiness) {
            return {
                name: fetchedBusiness.company_name || fetchedBusiness.name || fetchedBusiness.company || "Evoto Technologies",
                email: fetchedBusiness.email || currentUser?.email,
                phone: fetchedBusiness.phone_number || fetchedBusiness.phone || fetchedBusiness.mobile || currentUser?.phone,
                address: fetchedBusiness.address || fetchedBusiness.billing_address || null
            };
        }

        // 2. Try to get from localStorage
        try {
            const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
            if (authData) {
                const parsedAuth = JSON.parse(authData);
                const business = parsedAuth.business || parsedAuth.business_profile || (parsedAuth.user?.businesses && parsedAuth.user.businesses[0]);
                if (business) {
                    return {
                        name: business.company_name || business.name || business.company || "Evoto Technologies",
                        email: business.email || currentUser?.email,
                        address: business.address || null,
                        phone: business.phone_number || business.phone || business.mobile || currentUser?.phone || "",
                    };
                }
            }
        } catch (e) { /* silent catch */ }

        // 3. Fallback to currentUser
        if (currentUser) {
            const userBusiness = (currentUser as any).businesses?.[0];
            if (userBusiness) {
                return {
                    name: userBusiness.name || userBusiness.company_name || "Evoto Technologies",
                    email: currentUser.email,
                    address: (currentUser as any).address || null,
                    phone: userBusiness.phone_number || userBusiness.phone || userBusiness.mobile || (currentUser as any).phone || (currentUser as any).mobile
                };
            }
        }

        return {
            name: "Evoto Technologies",
            email: currentUser?.email || "",
            address: null,
            phone: currentUser?.phone || "",
        };
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
        // if (line2) elements.push(<>
        //     <span className="font-semibold">Line 2:</span> {line2}
        // </>);

        const parts = [];
        if (address.city) parts.push(<span key="city"><span className="font-semibold">City:</span> {address.city}</span>);
        if (address.state) parts.push(<span key="state"><span className="font-semibold">State:</span> {address.state}</span>);
        if (address.country) parts.push(<span key="country"><span className="font-semibold">Country:</span> {address.country}</span>);
        const pin = address.pin || address.postal_code || address.zip;
        if (pin) parts.push(<span key="pin"><span className="font-semibold">PIN:</span> {pin}</span>);


        if (parts.length > 0) {
            const joinedParts = parts.reduce((acc: React.ReactNode[], curr, idx) => {
                if (idx === 0) return [curr];
                return [...acc, ", ", curr];
            }, []);
            elements.push(<>{joinedParts}</>);
        }
        return elements;
    };

    const getCustomerAddress = (customer: any, type: "billing" | "shipping") => {
        if (!customer) return null;
        let address =
            type === "shipping"
                ? customer.shipping_address || customer.shippingAddress || customer.shipping_addresses
                : customer.billing_address || customer.billingAddress;

        if (Array.isArray(address)) {
            address = address.find((addr: any) => addr?.is_default) || address[0];
        }

        if (!address) {
            const prefix = type === "shipping" ? "shipping_" : "";
            address = {
                address1: customer[`${prefix}address1`] || customer[`${prefix}address_line1`] || customer.address1 || customer.address_line1,
                address2: customer[`${prefix}address2`] || customer[`${prefix}address_line2`] || customer.address2 || customer.address_line2,
                city: customer[`${prefix}city`] || customer.city,
                state: customer[`${prefix}state`] || customer.state,
                country: customer[`${prefix}country`] || customer.country,
                pin: customer[`${prefix}pin`] || customer.pin,
            };
        }

        return address;
    };

    const getMeasuringUnit = (unitId?: number) => {
        const units: { [key: number]: string } = { 1: "PCS", 2: "KG", 3: "LTR", 4: "MTR" };
        return units[unitId || 1] || "PCS";
    };

    const getPaymentStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            paid: 'bg-green-100 text-green-800',
            partial: 'bg-yellow-100 text-yellow-800',
            unpaid: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[4px]">
                <div className="flex flex-col items-center gap-4">
                    <SpinnerDotted size={50} thickness={100} speed={100} color="#1B84FF" />
                    <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Fetching Invoice Details...</p>
                </div>
            </div>
        );
    }

    if (!invoiceData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Invoice not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 relative">
            <style>
                {`
          @media print {
            .sidebar, .header, .footer, .topbar, .no-print, [data-kt-app-sidebar-enabled="true"] .app-sidebar, [data-kt-app-header-enabled="true"] .app-header {
              display: none !important;
            }
            body {
              background-color: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .min-h-screen {
              min-height: auto !important;
              background: none !important;
              padding: 0 !important;
            }
            #invoice-print-area {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              max-width: 100% !important;
              width: 100% !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
            </style>
            {/* Sticky Header Actions */}
            <div className="bg-white px-6 py-4 border-t border-b border-gray-200 sticky top-0 z-10 no-print">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}><ArrowLeft className="h-4 w-4" /></Button>
                        <div>
                            <h1 className="text-xl font-semibold text-black">Invoice #{invoiceData.invoice_number}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize ${getPaymentStatusBadge(invoiceData.payment_status)}`}>
                                    {invoiceData.payment_status}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button>
                        <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2"><Printer className="h-4 w-4" />Print PDF</Button>
                        <Button variant="outline" size="sm" onClick={handleShare} className="gap-2"><Share className="h-4 w-4" />Share</Button>
                        {/* <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2"><Edit className="h-4 w-4" />Edit</Button> */}
                        <Button variant="outline" size="sm" onClick={handlePaymentHistory} className="gap-2"><Clock className="h-4 w-4" />Payment History</Button>
                        {invoiceData.balance_due > 0 && (
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleRecordPayment}>
                                <CreditCard className="h-4 w-4" />Record Payment
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Invoice Preview Area */}
            <div
                id="invoice-print-area"
                ref={invoiceRef}
                style={{ width: '794px', boxSizing: 'border-box' }}
                className="mx-auto mt-8 bg-white font-sans"
            >
                {/* ── Company Header ── */}
                <div className="flex justify-between items-start px-12 pt-10 pb-6">
                    {(() => {
                        const businessInfo = getAuthBusinessInfo();
                        return (
                            <div>
                                <p className="text-xl font-bold text-black">{businessInfo?.name || 'Evoto Technologies'}</p>
                                {businessInfo?.email && <p className="text-[11px] text-gray-500 mt-0.5">{businessInfo.email}</p>}
                                {businessInfo?.phone && <p className="text-[11px] text-gray-500 mt-0.5">{businessInfo.phone}</p>}
                                {businessInfo?.address && <p className="text-[11px] text-gray-500 mt-0.5">{businessInfo.address}</p>}
                            </div>
                        );
                    })()}
                    <img
                        src={toAbsoluteUrl('/media/app/Evoto-Logo.png')}
                        className="h-16 w-auto object-contain"
                        alt="Logo"
                    />
                </div>

                <div className="px-12 pb-12">

                    {/* ── Invoice Meta: No / Date / Due Date ── */}
                    <div className="grid grid-cols-3 border border-black mb-7">
                        <div className="px-3 py-1 border-r border-b border-black bg-gray-100">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Invoice No.</span>
                        </div>
                        <div className="px-3 py-1 border-r border-b border-black bg-gray-100 text-center">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Invoice Date</span>
                        </div>
                        <div className="px-3 py-1 border-b border-black bg-gray-100 text-right">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Due Date</span>
                        </div>
                        <div className="px-3 py-2 border-r border-black">
                            <span className="text-[13px] text-black">{invoiceData.invoice_number}</span>
                        </div>
                        <div className="px-3 py-2 border-r border-black text-center">
                            <span className="text-[13px] text-black">{new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="px-3 py-2 text-right">
                            <span className="text-[13px] text-black">{new Date(invoiceData.due_date).toLocaleDateString('en-IN')}</span>
                        </div>
                    </div>

                    {/* ── Bill To / Ship To ── */}
                    <div className="grid grid-cols-2 gap-6 mb-7">
                        {/* Bill To */}
                        <div>
                            <p className="text-[11px] font-bold uppercase text-black mb-0.5">BILL TO</p>
                            <div className="w-12 border-b border-black mb-2"></div>
                            <p className="text-sm font-bold text-black mb-1">
                                {invoiceData.customer ? `${invoiceData.customer.first_name || ''} ${invoiceData.customer.last_name || ''}`.trim() : 'N/A'}
                            </p>
                            {invoiceData.customer?.company_name && <p className="text-[11px] text-gray-500 mb-0.5">{invoiceData.customer.company_name}</p>}
                            {invoiceData.customer?.email && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Email:</span> {invoiceData.customer.email}</p>}
                            {invoiceData.customer?.mobile && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Mobile:</span> {invoiceData.customer.mobile}</p>}
                            {invoiceData.customer?.gst && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">GST:</span> {invoiceData.customer.gst}</p>}
                            {invoiceData.customer && formatAddressLines(getCustomerAddress(invoiceData.customer, 'billing'), 'billing').map((el, i) => (
                                <p key={i} className="text-[11px] text-black mb-0.5">{el}</p>
                            ))}
                        </div>
                        {/* Ship To */}
                        <div className="border-l border-gray-200 pl-6">
                            <p className="text-[11px] font-bold uppercase text-black mb-0.5">SHIP TO</p>
                            <div className="w-12 border-b border-black mb-2"></div>
                            <p className="text-sm font-bold text-black mb-1">
                                {invoiceData.customer ? `${invoiceData.customer.first_name || ''} ${invoiceData.customer.last_name || ''}`.trim() : 'N/A'}
                            </p>
                            {invoiceData.customer?.company_name && <p className="text-[11px] text-gray-500 mb-0.5">{invoiceData.customer.company_name}</p>}
                            {invoiceData.customer?.email && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Email:</span> {invoiceData.customer.email}</p>}
                            {invoiceData.customer?.mobile && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Mobile:</span> {invoiceData.customer.mobile}</p>}
                            {invoiceData.customer?.gst && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">GST:</span> {invoiceData.customer.gst}</p>}
                            {invoiceData.customer && formatAddressLines(getCustomerAddress(invoiceData.customer, 'shipping'), 'shipping').map((el, i) => (
                                <p key={i} className="text-[11px] text-black mb-0.5">{el}</p>
                            ))}
                        </div>
                    </div>

                    {/* ── Items Table ── */}
                    <table className="w-full border-collapse border border-black mb-8">
                        <thead>
                            <tr className="bg-gray-100 border-b-2 border-black">
                                <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-black border-r border-black w-[38%]">Item Description</th>
                                <th className="px-2.5 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-black border-r border-black">Qty</th>
                                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black border-r border-black whitespace-nowrap">Price / Item</th>
                                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black border-r border-black">Disc.</th>
                                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black border-r border-black">Tax</th>
                                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceData.items?.map((item, index) => (
                                <tr key={item.uuid} className="border-b border-gray-300">
                                    <td className="px-2.5 py-2 text-xs text-black border-r border-gray-300 align-top">
                                        <div className="flex items-start gap-1">
                                            <span className="font-medium text-xs text-black min-w-[18px]">{index + 1}.</span>
                                            <div>
                                                <p className="font-medium text-xs text-black leading-snug">{item.product_name}</p>
                                                {item.description && <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-2.5 py-2 text-center text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">
                                        {item.quantity} <span className="text-[9px]">{getMeasuringUnit(item.measuring_unit_id)}</span>
                                    </td>
                                    <td className="px-2.5 py-2 text-right text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">{formatCurrency(item.unit_price)}</td>
                                    <td className="px-2.5 py-2 text-right text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">
                                        <p className="m-0">-{formatCurrency(item.discount_amount)}</p>
                                        {item.discount_percentage > 0 && <p className="text-[9px] m-0">({item.discount_percentage}%)</p>}
                                    </td>
                                    <td className="px-2.5 py-2 text-right text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">
                                        <p className="m-0">{formatCurrency(item.tax_amount)}</p>
                                        {item.tax_percentage > 0 && <p className="text-[9px] m-0">({item.tax_percentage}%)</p>}
                                    </td>
                                    <td className="px-2.5 py-2 text-right text-xs text-black align-top whitespace-nowrap">{formatCurrency(item.total_price)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-black bg-gray-50 font-bold">
                                <td colSpan={2} className="px-2.5 py-2 text-right text-[9px] uppercase tracking-widest text-black border-r border-black">Subtotal</td>
                                <td className="px-2.5 py-2 text-right text-xs font-bold text-black border-r border-black whitespace-nowrap">
                                    {formatCurrency(invoiceData.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0))}
                                </td>
                                <td className="px-2.5 py-2 text-right text-xs font-bold text-black border-r border-black whitespace-nowrap">-{formatCurrency(invoiceData.discount_total)}</td>
                                <td className="px-2.5 py-2 text-right text-xs font-bold text-black border-r border-black whitespace-nowrap">{formatCurrency(invoiceData.tax_total)}</td>
                                <td className="px-2.5 py-2 text-right text-xs font-bold text-black whitespace-nowrap">{formatCurrency(invoiceData.total_amount)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* ── Bottom: Notes/Terms + Totals ── */}
                    <div className="grid grid-cols-2 gap-8">

                        {/* LEFT – Notes & Terms */}
                        <div className="space-y-4">
                            {invoiceData.notes && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-black mb-0.5">NOTES</p>
                                    <div className="w-10 border-b border-black mb-1.5"></div>
                                    <p className="text-[11px] text-black leading-relaxed whitespace-pre-wrap">{invoiceData.notes}</p>
                                </div>
                            )}
                            {invoiceData.terms_and_conditions && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-black mb-0.5">TERMS &amp; CONDITIONS</p>
                                    <div className="w-32 border-b border-black mb-1.5"></div>
                                    <div className="text-[10px] text-black space-y-0.5 leading-relaxed">
                                        {invoiceData.terms_and_conditions.split('\n').filter(t => t.trim()).map((term, i) => (
                                            <p key={i}>• {term}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT – Tax Summary + Grand Total + Signatory */}
                        <div>
                            <div className="space-y-0">
                                <div className="flex justify-between items-center py-1.5">
                                    <span className="text-[10px] uppercase text-black">Taxable Amount</span>
                                    <span className="text-xs font-bold text-black">{formatCurrency(invoiceData.subtotal - invoiceData.discount_total)}</span>
                                </div>
                                {invoiceData.tax_total > 0 && (
                                    <>
                                        <div className="flex justify-between items-center py-1.5">
                                            <span className="text-[10px] uppercase text-black">
                                                CGST ({invoiceData.subtotal - invoiceData.discount_total > 0
                                                    ? Math.round(((invoiceData.tax_total / (invoiceData.subtotal - invoiceData.discount_total)) * 100 / 2) * 100) / 100
                                                    : 0}%)
                                            </span>
                                            <span className="text-xs font-bold text-black">{formatCurrency(invoiceData.tax_total / 2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1.5 border-b border-black">
                                            <span className="text-[10px] uppercase text-black">
                                                {currentUser?.isUT ? 'UTGST' : 'SGST'} ({invoiceData.subtotal - invoiceData.discount_total > 0
                                                    ? Math.round(((invoiceData.tax_total / (invoiceData.subtotal - invoiceData.discount_total)) * 100 / 2) * 100) / 100
                                                    : 0}%)
                                            </span>
                                            <span className="text-xs font-bold text-black">{formatCurrency(invoiceData.tax_total / 2)}</span>
                                        </div>
                                    </>
                                )}
                                {invoiceData.additional_charges_total > 0 && (
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-[10px] uppercase text-black">Additional Charges</span>
                                        <span className="text-xs font-bold text-black">{formatCurrency(invoiceData.additional_charges_total)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-2.5 border-t border-black border-b-2 border-double">
                                    <span className="text-sm font-bold uppercase tracking-wider text-black">Grand Total</span>
                                    <span className="text-xl font-bold text-black">{formatCurrency(invoiceData.total_amount)}</span>
                                </div>
                                <div className="pt-1.5 text-right">
                                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Amount in Words</p>
                                    <p className="text-[11px] font-bold text-black leading-snug">{formatNumberInWords(invoiceData.total_amount)}</p>
                                </div>
                            </div>

                            {/* Authorized Signatory */}
                            <div className="mt-16 flex justify-end">
                                <div className="text-center">
                                    <div className="w-36 border-b border-black mb-1.5"></div>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-black">Authorized Signatory</p>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

                {/* Payment History Sidebar */}
                <Sheet open={isPaymentHistoryOpen} onOpenChange={setIsPaymentHistoryOpen}>
                    <SheetContent side="right" className="sm:max-w-md p-0 flex flex-col h-full border-l border-gray-200">
                        <SheetHeader className="p-6 border-b border-gray-100 flex flex-row items-center justify-between">
                            <SheetTitle className="text-xl font-bold text-gray-800">Payment History - Invoice #{invoiceData.invoice_number}</SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Section */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Invoice Amount</span>
                                    <span className="text-gray-900 font-bold">{formatCurrency(invoiceData.total_amount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pb-4 border-b border-gray-100">
                                    <span className="text-gray-500 font-medium tracking-tight">Initial Amount Received</span>
                                    <span className="text-gray-900 font-bold">{formatCurrency(0)}</span>
                                </div>
                            </div>

                            {/* Payments List */}
                            <div className="space-y-4">
                                {invoiceData.amount_paid > 0 ? (
                                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-bold text-blue-600">Payment in #{invoiceData.invoice_number}</h4>
                                            <span className="text-sm font-bold text-gray-900">{formatCurrency(invoiceData.amount_paid)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                                            <span>{new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}</span>
                                            <span className="capitalize">Cash</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-12 text-center">
                                        <div className="bg-gray-50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                                            <CreditCard className="h-6 w-6 text-gray-400" />
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium">No payments recorded yet</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar Footer */}
                        <div className="p-6 bg-gray-50 border-t border-gray-200 mt-auto space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-gray-600">Total Amount Received</span>
                                    <span className="text-gray-900 font-bold">{formatCurrency(invoiceData.amount_paid)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <span className="text-gray-600">Balance Amount</span>
                                    <span className="text-red-600">{formatCurrency(invoiceData.balance_due)}</span>
                                </div>
                            </div>

                            {invoiceData.balance_due > 0 && (
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-lg shadow-sm shadow-blue-100"
                                    onClick={handleActualRecordPayment}
                                >
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Record Payment In
                                </Button>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

                <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
                    <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
                        <DialogHeader className="px-6 py-4 border-b border-gray-200">
                            <DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-gray-600" />
                                Record Payment For Invoice #{invoiceData.invoice_number}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {/* Form Section */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Amount Received <span className="text-red-500">*</span>
                                                </label>
                                            </div>
                                            <Input
                                                type="number"
                                                value={paymentForm.amountReceived === null || paymentForm.amountReceived === 0 ? '' : paymentForm.amountReceived}
                                                onChange={(e) => {
                                                    const amount = parseFloat(e.target.value) || 0;
                                                    const maxAmount = invoiceData?.balance_due || 0;
                                                    const cappedAmount = Math.min(amount, maxAmount);
                                                    setPaymentForm({ ...paymentForm, amountReceived: cappedAmount });
                                                    validateAmountReceived(cappedAmount);
                                                }}
                                                className={`h-10 ${amountError ? 'border-red-5 00 focus:border-red-500 focus:ring-1 focus:ring-red-100' : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`}
                                                placeholder="0.00"
                                                step="0.01"
                                            />
                                            {amountError && (
                                                <p className="text-xs text-red-600 font-medium">{amountError}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1">
                                                <label className="text-sm font-medium text-gray-700">Payment Discount</label>
                                                <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                                            </div>
                                            <Input
                                                type="number"
                                                value={paymentForm.discount === null || paymentForm.discount === 0 ? '' : paymentForm.discount}
                                                onChange={(e) => setPaymentForm({ ...paymentForm, discount: parseFloat(e.target.value) || 0 })}
                                                className={`h-10 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`}
                                                placeholder="0.00"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Payment Date</label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full h-10 justify-start text-left font-normal border-gray-200 hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-100",
                                                            !paymentForm.date && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                                                        {paymentForm.date ? format(paymentForm.date, "dd MMM yyyy") : <span className="text-gray-500">Select date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={paymentForm.date}
                                                        onSelect={(date) => date && setPaymentForm({ ...paymentForm, date })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Payment Mode</label>
                                            <Select
                                                value={paymentForm.mode}
                                                onValueChange={(value) => setPaymentForm({ ...paymentForm, mode: value })}
                                            >
                                                <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100">
                                                    <SelectValue placeholder="Select mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="upi">UPI</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Notes</label>
                                        <Textarea
                                            placeholder="Add any remarks or payment notes..."
                                            className="min-h-[80px] border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none"
                                            value={paymentForm.notes}
                                            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Info & Calculation Section */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Invoice #{invoiceData.invoice_number}</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Customer Name</span>
                                                <span className="text-gray-900 font-medium">{invoiceData.customer?.first_name} {invoiceData.customer?.last_name}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Total Amount</span>
                                                <span className="text-gray-900 font-medium">{formatCurrency(invoiceData.total_amount)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Due Date</span>
                                                <span className="text-gray-900 font-medium">{new Date(invoiceData.due_date).toLocaleDateString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Payment Calculation</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-red-600 font-medium">Pending Amount</span>
                                                <span className="text-red-600 font-semibold">{formatCurrency(invoiceData.balance_due)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600">Amount Received</span>
                                                <span className="text-gray-900 font-medium">{formatCurrency(paymentForm.amountReceived)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600">Discount</span>
                                                <span className="text-gray-900 font-medium">-{formatCurrency(paymentForm.discount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                                <span className="text-sm font-semibold text-gray-800">New Balance</span>
                                                <span className="text-base font-bold text-blue-600">
                                                    {formatCurrency(Math.max(0, invoiceData.balance_due - paymentForm.amountReceived - paymentForm.discount))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                            <div className="text-sm text-gray-500">
                                <span className="font-medium">Note:</span> Fields marked with <span className="text-red-500">*</span> are required
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsRecordPaymentOpen(false)}
                                    className="bg-white border-gray-300 font-medium"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                    onClick={handleSavePayment}
                                    disabled={isSavingPayment || paymentForm.amountReceived <= 0 || amountError !== ""}
                                >
                                    {isSavingPayment ? (
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Saving...
                                        </div>
                                    ) : (
                                        <>
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            Record Payment
                                        </>
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default InvoiceDetailsPage;
