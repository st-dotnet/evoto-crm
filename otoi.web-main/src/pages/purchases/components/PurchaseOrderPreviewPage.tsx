import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, FileText, CreditCard, Share, Mail, Receipt } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeenIcon } from "@/components";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { getPurchaseOrderById } from "../services/purchaseOrder.services";
import { createPurchaseInvoiceFromPO } from "../services/purchaseInvoice.services";
import { useAuthContext } from "@/auth/useAuthContext";
import { SpinnerDotted } from "spinners-react";
import { toAbsoluteUrl } from "@/utils/Assets";
import { getShareData, sendShareEmail } from "@/services/share.service";
import { resolveImageUrl } from "@/utils/imageUtils";
import { getGlobalAssets } from "@/pages/global-config/services/businessConfig.service";

interface PurchaseOrderItem {
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

interface Vendor {
    uuid: string;
    vendor_name: string;
    company_name?: string;
    mobile: string;
    email?: string | null;
    gst?: string;
    pin?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    country?: string;
}

interface PurchaseOrderData {
    uuid?: string;
    poNo: string;
    poDate: string;
    deliveryDate: string;
    status: string;
    selectedVendor: Vendor | null;
    poItems: PurchaseOrderItem[];
    notes?: string;
    terms?: string;
    business?: any;
}

const PurchaseOrderPreviewPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { currentUser } = useAuthContext();
    const [isLoading, setIsLoading] = useState(false);
    const [fetchedData, setFetchedData] = useState<PurchaseOrderData | null>(null);
    const [businessProfile, setBusinessProfile] = useState<any>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [associatedInvoice, setAssociatedInvoice] = useState<any>(null);
    const poRef = useRef<HTMLDivElement>(null);
    const [isFetchingShareData, setIsFetchingShareData] = useState(false);
    const [brandingAssets, setBrandingAssets] = useState<{ logo_path?: string; esign_path?: string } | null>(null);

    const poData: PurchaseOrderData = fetchedData ||
        location.state?.poData || {
        poNo: "",
        poDate: "",
        deliveryDate: "",
        status: "",
        selectedVendor: null,
        poItems: [],
    };

    useEffect(() => {
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
                    gst: business?.gst || business?.gstin || user?.gst || user?.gstin,
                });
            } catch (error) {
                console.error("Failed to fetch full business profile via API", error);
            }
        };
        fetchBusinessProfile();
        fetchBrandingAssets();
    }, []);

    const fetchBrandingAssets = async () => {
        try {
            const response = await getGlobalAssets();
            if (response.success && response.data) {
                setBrandingAssets(response.data);
            }
        } catch (error) {
            console.error("Error fetching branding assets:", error);
        }
    };

    useEffect(() => {
        if (id && !location.state?.poData) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const response = await getPurchaseOrderById(id);
                    if (response.success && response.data) {
                        const data = response.data;

                        const transformedData: PurchaseOrderData = {
                            uuid: data.uuid,
                            poNo: data.po_number,
                            poDate: data.po_date,
                            deliveryDate: data.delivery_date,
                            status: data.status,
                            selectedVendor: data.vendor,
                            poItems: data.items.map((item: any) => {
                                let discount = 0;
                                if (typeof item.discount === 'object' && item.discount !== null) {
                                    discount = item.discount.discount_percentage || 0;
                                } else {
                                    discount = item.discount_percentage || item.discount || 0;
                                }

                                let tax = 0;
                                if (typeof item.tax === 'object' && item.tax !== null) {
                                    tax = item.tax.tax_percentage || 0;
                                } else {
                                    tax = item.tax_percentage || item.tax || 0;
                                }

                                return {
                                    id: item.uuid,
                                    item_id: item.item_id || item.uuid,
                                    item_name: item.product_name || item.description || "Item",
                                    description: item.description,
                                    quantity: item.quantity || 0,
                                    price_per_item: item.unit_price || 0,
                                    discount: discount,
                                    tax: tax,
                                    amount: item.total_price || 0,
                                    measuring_unit_id: item.measuring_unit_id || 1,
                                };
                            }),
                            notes: data.notes,
                            terms: data.terms_and_conditions,
                            business: data.business,
                        };
                        setFetchedData(transformedData);
                        if (data.invoice) {
                            setAssociatedInvoice(data.invoice);
                        }
                    }
                } catch (error) {
                    toast.error("Failed to load purchase order details");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [id, location.state]);

    const calculateTotals = () => {
        const items = poData.poItems || [];
        const subtotal = items.reduce(
            (sum, item) => sum + item.price_per_item * item.quantity,
            0,
        );
        const totalDiscount = items.reduce(
            (sum, item) =>
                sum + (item.price_per_item * item.quantity * item.discount) / 100,
            0,
        );
        const totalTax = items.reduce(
            (sum, item) =>
                sum +
                (item.price_per_item *
                    item.quantity *
                    (1 - item.discount / 100) *
                    item.tax) /
                100,
            0,
        );
        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

        const taxableAmount = subtotal - totalDiscount;
        const effectiveTaxRate =
            taxableAmount > 0 ? (totalTax / taxableAmount) * 100 : 0;

        return {
            subtotal,
            totalDiscount,
            totalTax,
            totalAmount,
            totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
            totalCGST: totalTax / 2,
            totalSGST: totalTax / 2,
            primaryTax: effectiveTaxRate,
        };
    };

    const totals = calculateTotals();

    const handleConvertToInvoice = async () => {
        const poId = poData?.uuid || id;
        if (!poId) {
            toast.error("Please save the purchase order first before converting to invoice.");
            return;
        }
        navigate('/purchases/purchase-invoices/new', {
            state: {
                poId: poId,
                poData: poData,
                fromPO: true
            }
        });
    };

    const handleShareWhatsApp = async () => {
        const poId = poData?.uuid || id;
        if (!poId) return;
        setIsFetchingShareData(true);
        const fetchToast = toast.loading("Preparing share options...");
        try {
            const response = await getShareData(poId, 'purchase_order');
            if (response.success && response.data) {
                const { message, contact } = response.data;
                const whatsappUrl = `https://wa.me/${contact?.mobile || ""}?text=${encodeURIComponent(message || "")}`;
                window.open(whatsappUrl, "_blank");
                toast.success("Opening WhatsApp...", { id: fetchToast });
            } else {
                throw new Error(response.error || "Failed to fetch share data");
            }
        } catch (error: any) {
            console.error("Share error:", error);
            toast.error(error.message || "Failed to prepare share link", { id: fetchToast });
        } finally {
            setIsFetchingShareData(false);
        }
    };

    const handleShareEmail = async () => {
        const poId = poData?.uuid || id;
        if (!poId) return;
        setIsFetchingShareData(true);
        const fetchToast = toast.loading("Sending email...");
        try {
            const response = await sendShareEmail(poId, 'purchase_order');
            if (response.success) {
                toast.success("Email sent successfully!", { id: fetchToast });
            } else {
                throw new Error(response.error || "Failed to send email");
            }
        } catch (error: any) {
            console.error("Email error:", error);
            toast.error(error.message || "Failed to send email", { id: fetchToast });
        } finally {
            setIsFetchingShareData(false);
        }
    };

    // ─── Download PDF ───────────────────────────────────────────────────────────
    const handleDownloadPDF = async () => {
        const poId = poData?.uuid || id;
        if (!poId) {
            toast.error("Please save the purchase order first before downloading as PDF.");
            return;
        }
        const downloadToast = toast.loading("Generating PDF...");
        try {
            const token = (() => {
                try {
                    const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
                    if (!authData) return null;
                    const parsedAuth = JSON.parse(authData);
                    return parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken || null;
                } catch (error) {
                    return null;
                }
            })();

            const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/purchase-orders/${poId}/pdf`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PurchaseOrder-${poData.poNo || "Draft"}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            toast.success("PDF downloaded successfully", { id: downloadToast });
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF", { id: downloadToast });
        }
    };

    // ─── Print PDF ───────────────────────────────────────────────────────────────
    const handlePrintPDF = () => {
        const originalTitle = document.title;
        document.title = `PurchaseOrder-${poData.poNo || "Draft"}`;
        window.print();
        document.title = originalTitle;
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
        if (businessProfile) return businessProfile;

        const fetchedBusiness = poData?.business;
        if (fetchedBusiness) {
            return {
                name: fetchedBusiness.company_name || fetchedBusiness.name || "Evoto Technologies",
                email: fetchedBusiness.email || currentUser?.email,
                phone: fetchedBusiness.phone_number || fetchedBusiness.phone || currentUser?.phone,
                address: fetchedBusiness.address || null,
            };
        }

        try {
            const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
            if (authData) {
                const parsedAuth = JSON.parse(authData);
                const user = parsedAuth.user;
                const business = parsedAuth.business || (user?.businesses && user.businesses[0]);

                if (business) {
                    return {
                        name: business.company_name || business.name || "Evoto Technologies",
                        email: business.email || currentUser?.email,
                        address: business.address || null,
                        phone: business.phone_number || business.phone || "N/A",
                    };
                }
            }
        } catch (e) {
            /* silent catch */
        }

        return {
            name: "Evoto Technologies",
            email: currentUser?.email || "",
            address: null,
            phone: "N/A",
        };
    };

    const formatAddressLines = (vendor: Vendor | null) => {
        if (!vendor) return [];
        const elements: React.ReactNode[] = [];
        if (vendor.address1) elements.push(<p key="a1">{vendor.address1}</p>);
        if (vendor.address2) elements.push(<p key="a2">{vendor.address2}</p>);
        const parts = [];
        if (vendor.city) parts.push(vendor.city);
        if (vendor.state) parts.push(vendor.state);
        if (vendor.country) parts.push(vendor.country);
        if (vendor.pin) parts.push(`PIN: ${vendor.pin}`);
        if (parts.length > 0) elements.push(<p key="parts">{parts.join(", ")}</p>);
        return elements;
    };

    const getMeasuringUnit = (unitId?: number) => {
        const units: { [key: number]: string } = {
            1: "PCS",
            2: "KG",
            3: "LTR",
            4: "MTR",
        };
        return units[unitId || 1] || "PCS";
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 relative">
            {isLoading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[4px]">
                    <div className="flex flex-col items-center gap-4">
                        <SpinnerDotted size={50} thickness={100} speed={100} color="#1B84FF" />
                        <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
                            Fetching Purchase Order Details...
                        </p>
                    </div>
                </div>
            )}

            <style>
                {`
                  @page {
                    size: A4;
                    margin: 0;
                  }
                  @media print {
                    .sidebar, .header, .footer, .topbar, .no-print,
                    [data-kt-app-sidebar-enabled="true"] .app-sidebar,
                    [data-kt-app-header-enabled="true"] .app-header {
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
                    #po-print-area {
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

            {/* ─── Toolbar ─────────────────────────────────────────────────────────── */}
            <div className="bg-white px-4 sm:px-6 py-4 border-t border-b border-gray-200 sticky top-0 z-10 no-print">
                <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-4 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/purchases/purchase-orders")} className="shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="overflow-hidden">
                            <h1 className="text-lg sm:text-xl font-semibold text-black truncate">
                                Purchase Order #{poData.poNo || "Draft"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {/* Download PDF */}
                        <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2 shrink-0">
                            <Download className="h-4 w-4" />
                            <span className="hidden xs:inline">Download PDF</span>
                        </Button>

                        {/* Print PDF */}
                        <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2 shrink-0">
                            <Printer className="h-4 w-4" />
                            <span className="hidden xs:inline">Print</span>
                        </Button>

                        {/* Share */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled={isFetchingShareData}>
                                    <Share className="h-4 w-4" />
                                    <span className="hidden xs:inline">Share</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer">
                                    <KeenIcon icon="whatsapp" className="text-black-800" /> WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleShareEmail} className="gap-2 cursor-pointer">
                                    <Mail className="h-4 w-4" /> Email
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Convert to Invoice */}
                        {(!associatedInvoice || poData?.status === 'open') && (
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shrink-0"
                                onClick={handleConvertToInvoice}
                                disabled={isConverting || !id}
                            >
                                <Receipt className="h-4 w-4" />
                                <span className="hidden sm:inline">{isConverting ? "Converting..." : "Convert to Invoice"}</span>
                                <span className="sm:hidden">Invoice</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Print Area ──────────────────────────────────────────────────────── */}
            <div id="po-print-area" ref={poRef} className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12 bg-white mt-4 sm:mt-8 shadow-sm">

                {/* Header: Business Info + Logo */}
                <div className="mb-8 flex justify-between items-start">
                    {(() => {
                        const businessInfo = getAuthBusinessInfo();
                        return (
                            <>
                                <div className="mt-8 w-2/3">
                                    <h1 className="text-xl sm:text-2xl font-semibold text-black leading-tight mb-4">
                                        {businessInfo?.name}
                                    </h1>
                                    <div className="mt-1 space-y-1">
                                        {businessInfo?.email && <p className="text-xs text-gray-600 font-medium">{businessInfo.email}</p>}
                                        {businessInfo?.phone && <p className="text-xs text-gray-600 font-medium">{businessInfo.phone}</p>}
                                        {businessInfo?.gst && <p className="text-xs text-gray-600 font-medium">GST: {businessInfo.gst}</p>}
                                        {businessInfo?.address && <p className="text-xs text-gray-600 font-medium">{businessInfo.address}</p>}
                                    </div>
                                </div>

                                {/* FIX: use brandingAssets logo, fallback to default */}
                                <div className="flex flex-col items-end w-1/3 mt-4">
                                    {brandingAssets?.logo_path ? (
                                        <img
                                            src={resolveImageUrl(`/static/uploads/business/${brandingAssets.logo_path}`)}
                                            className="h-24 sm:h-40 w-auto object-contain print:h-32"
                                            alt={businessInfo?.name || "Logo"}
                                        />
                                    ) : (
                                        <img
                                            src={toAbsoluteUrl("/media/app/Evoto-Logo.png")}
                                            className="h-24 sm:h-40 w-auto object-contain print:h-32"
                                            alt="Evoto Technologies"
                                        />
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* PO Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 mb-8 sm:mb-12 border border-black overflow-hidden rounded-md sm:rounded-none">
                    <div className="px-4 py-2 border-b sm:border-b-0 sm:border-r border-black bg-gray-50/50 sm:bg-gray-100">
                        <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 sm:text-black uppercase">Purchase Order No.</p>
                        <p className="text-sm sm:text-[14px] font-semibold sm:font-normal text-black mt-0.5">{poData.poNo}</p>
                    </div>
                    <div className="px-4 py-2 border-b sm:border-b-0 sm:border-r border-black sm:text-center sm:bg-gray-100">
                        <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 sm:text-black uppercase">P.O. Date</p>
                        <p className="text-sm sm:text-[14px] font-semibold sm:font-normal text-black mt-0.5">
                            {poData.poDate ? new Date(poData.poDate).toLocaleDateString("en-IN") : "N/A"}
                        </p>
                    </div>
                    <div className="px-4 py-2 sm:text-right bg-gray-50/50 sm:bg-gray-100">
                        <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 sm:text-black uppercase">Delivery Date</p>
                        <p className="text-sm sm:text-[14px] font-semibold sm:font-normal text-black mt-0.5">
                            {poData.deliveryDate ? new Date(poData.deliveryDate).toLocaleDateString("en-IN") : "N/A"}
                        </p>
                    </div>
                </div>

                {/* Vendor Details */}
                <div className="mb-8 p-4 border border-gray-100 rounded-lg sm:border-0 sm:p-0 sm:rounded-none bg-gray-50/30 sm:bg-transparent">
                    <h3 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-full md:w-56">
                        VENDOR DETAILS
                    </h3>
                    <div className="space-y-1 text-black text-sm">
                        <p className="font-semibold text-lg mb-2 text-black">
                            {poData.selectedVendor ? poData.selectedVendor.vendor_name || poData.selectedVendor.company_name : "N/A"}
                        </p>
                        <div className="space-y-1">
                            {poData.selectedVendor?.company_name && (
                                <p className="text-gray-600">{poData.selectedVendor.company_name}</p>
                            )}
                            {poData.selectedVendor?.email && (
                                <p className="text-black"><span className="font-semibold">Email:</span> {poData.selectedVendor.email}</p>
                            )}
                            {poData.selectedVendor?.mobile && (
                                <p className="text-black"><span className="font-semibold">Mobile:</span> {poData.selectedVendor.mobile}</p>
                            )}
                            {poData.selectedVendor?.gst && (
                                <p className="text-black"><span className="font-semibold">GST:</span> {poData.selectedVendor.gst}</p>
                            )}
                            {formatAddressLines(poData.selectedVendor).map((line, index) => (
                                <p key={index} className="text-black">{line}</p>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    {/* Desktop / Print Table */}
                    <div className="hidden md:block print:block overflow-hidden rounded-md border border-black">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-black bg-gray-100">
                                    <th className="px-3 py-2 text-left font-semibold text-xs text-black uppercase tracking-wider w-1/2 border-r border-black">Item DESCRIPTION</th>
                                    <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">QTY</th>
                                    <th className="px-3 py-2 text-right font-semibold text-xs text-black uppercase tracking-wider border-r border-black whitespace-nowrap">PRICE/ITEM</th>
                                    <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">DISC.</th>
                                    <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">TAX</th>
                                    <th className="px-3 py-2 text-right font-semibold text-xs text-black uppercase tracking-wider whitespace-nowrap">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black bg-white">
                                {poData.poItems?.map((item, index) => (
                                    <tr key={item.id}>
                                        <td className="px-3 py-2 align-top border-r border-black">
                                            <div className="flex items-start gap-1">
                                                <span className="font-medium text-sm text-black min-w-[20px]">{index + 1}.</span>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm text-black leading-snug">{item.item_name}</p>
                                                    {item.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.description}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                                            {item.quantity} <span className="text-[10px] ml-0.5 text-gray-500 uppercase">{getMeasuringUnit(item.measuring_unit_id)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                                            {formatCurrency(item.price_per_item)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                                            <div className="flex flex-col items-end">
                                                <span>-{formatCurrency((item.price_per_item * item.quantity * item.discount) / 100)}</span>
                                                {item.discount > 0 && <span className="text-[10px] text-orange-600">({item.discount}%)</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                                            <div className="flex flex-col items-end">
                                                <span>{formatCurrency((item.price_per_item * item.quantity * (1 - item.discount / 100) * item.tax) / 100)}</span>
                                                {item.tax > 0 && <span className="text-[10px] text-blue-600">({item.tax}%)</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-sm text-black align-top whitespace-nowrap">
                                            {formatCurrency(item.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black bg-gray-100 font-bold">
                                    <td colSpan={2} className="px-3 py-2 text-right text-xs uppercase tracking-widest text-black border-r border-black">SUBTOTAL</td>
                                    <td className="px-3 py-2 text-right text-sm text-black border-r border-black whitespace-nowrap">{formatCurrency(totals.subtotal)}</td>
                                    <td className="px-3 py-2 text-right text-sm text-black border-r border-black whitespace-nowrap">-{formatCurrency(totals.totalDiscount)}</td>
                                    <td className="px-3 py-2 text-right text-sm text-black border-r border-black whitespace-nowrap">{formatCurrency(totals.totalTax)}</td>
                                    <td className="px-3 py-2 text-right text-sm text-black whitespace-nowrap">{formatCurrency(totals.totalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden no-print space-y-4">
                        {poData.poItems?.map((item, index) => (
                            <div key={item.id} className="bg-white border-2 border-black rounded-lg overflow-hidden p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-2">
                                        <span className="bg-black text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-black text-sm leading-tight">{item.item_name}</h4>
                                            {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Total</p>
                                        <p className="text-sm font-black text-black">{formatCurrency(item.amount)}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Quantity</p>
                                        <p className="text-xs font-semibold text-black">{item.quantity} {getMeasuringUnit(item.measuring_unit_id)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Price/Item</p>
                                        <p className="text-xs font-semibold text-black">{formatCurrency(item.price_per_item)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Discount</p>
                                        <p className="text-xs font-semibold text-orange-600">
                                            -{formatCurrency((item.price_per_item * item.quantity * item.discount) / 100)} ({item.discount}%)
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tax</p>
                                        <p className="text-xs font-semibold text-blue-600">
                                            {formatCurrency((item.price_per_item * item.quantity * (1 - item.discount / 100) * item.tax) / 100)} ({item.tax}%)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Mobile Summary */}
                        <div className="bg-gray-100 border-2 border-black rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-600 uppercase">SUBTOTAL</span>
                                <span className="font-bold text-black">{formatCurrency(totals.subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-orange-600">
                                <span className="font-bold uppercase">TOTAL DISCOUNT</span>
                                <span className="font-bold">-{formatCurrency(totals.totalDiscount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-blue-600">
                                <span className="font-bold uppercase">TOTAL TAX</span>
                                <span className="font-bold">{formatCurrency(totals.totalTax)}</span>
                            </div>
                            <div className="pt-2 border-t border-black flex justify-between items-center text-xl font-bold text-black uppercase tracking-tight mt-2">
                                <span>GRAND TOTAL</span>
                                <span>{formatCurrency(totals.totalAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Notes/Terms + Totals/Signature */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">

                    {/* Left: Notes & Terms */}
                    <div className="space-y-8 order-2 md:order-1">
                        {poData.notes && (
                            <div className="bg-gray-50/50 sm:bg-transparent p-4 sm:p-0 rounded-lg sm:rounded-none">
                                <h4 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-full md:w-56">NOTES</h4>
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap italic">{poData.notes}</p>
                            </div>
                        )}
                        {poData.terms && (
                            <div className="bg-gray-50/50 sm:bg-transparent p-4 sm:p-0 rounded-lg sm:rounded-none">
                                <h4 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-full md:w-56">TERMS & CONDITIONS</h4>
                                <div className="text-[10px] text-gray-600 space-y-2">
                                    {poData.terms?.split("\n").filter((t) => t.trim() !== "").map((term, i) => (
                                        <p key={i} className="leading-snug">• {term}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Tax Summary + Signature */}
                    <div className="order-1 md:order-2">
                        <div className="space-y-0 bg-white sm:bg-transparent p-4 sm:p-0 border border-gray-100 sm:border-0 rounded-lg sm:rounded-none">
                            <div className="flex justify-between items-center py-2 sm:py-3 border-b border-gray-50 sm:border-0">
                                <span className="text-xs font-medium text-gray-500 sm:text-black uppercase">Taxable Amount</span>
                                <span className="text-sm font-bold text-black">{formatCurrency(totals.subtotal - totals.totalDiscount)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 sm:py-3 border-b border-gray-50 sm:border-0">
                                <span className="text-xs font-medium text-gray-500 sm:text-black uppercase">
                                    CGST ({Math.round((totals.primaryTax / 2) * 100) / 100}%)
                                </span>
                                <span className="text-sm font-bold text-black">{formatCurrency(totals.totalCGST)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 sm:py-3 border-b border-black">
                                <span className="text-xs font-medium text-gray-500 sm:text-black uppercase">
                                    {currentUser?.isUT ? 'UTGST' : 'SGST'} ({Math.round((totals.primaryTax / 2) * 100) / 100}%)
                                </span>
                                <span className="text-sm font-bold text-black">{formatCurrency(totals.totalTax / 2)}</span>
                            </div>
                            <div className="pt-2 border-t border-black mt-2">
                                <div className="flex justify-between items-center text-xl font-bold text-black uppercase tracking-tight">
                                    <span>GRAND TOTAL</span>
                                    <span>{formatCurrency(totals.totalAmount)}</span>
                                </div>
                            </div>
                            <div className="pt-4 text-right">
                                <div className="p-3 bg-gray-50 rounded-md inline-block max-w-full italic overflow-hidden">
                                    <p className="text-[10px] sm:text-xs text-gray-600 leading-tight">
                                        <span className="font-bold uppercase text-[10px] sm:text-[11px] not-italic block mb-1">Amount In words:</span>
                                        {formatNumberInWords(totals.totalAmount)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Signature */}
                        <div className="mt-12 sm:mt-20 flex justify-end">
                            <div className="text-center w-full sm:w-auto">
                                <p className="text-[10px] font-bold text-gray-500 sm:text-black uppercase mb-2">
                                    For {getAuthBusinessInfo().name}
                                </p>
                                {/* FIX: removed no-print so e-sign is visible when printing */}
                                {brandingAssets?.esign_path && (
                                    <div className="mb-0 flex justify-center">
                                        <img
                                            src={resolveImageUrl(`/static/uploads/business/${brandingAssets.esign_path}`)}
                                            className="h-12 md:h-16 w-auto object-contain mix-blend-multiply transition-transform hover:scale-105"
                                            alt="Signature"
                                        />
                                    </div>
                                )}
                                <div className={`w-full sm:w-48 border-b-2 border-black mb-1 mx-auto ${brandingAssets?.esign_path ? '-mt-2' : 'mt-12'}`}></div>
                                <p className="text-[10px] font-bold text-black uppercase tracking-widest mt-2">Authorized Signatory</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print-only footer */}
                <div className="hidden print:block fixed bottom-0 left-0 right-0 text-center py-4 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400">Generated via Evoto CRM Invoicing Solution</p>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrderPreviewPage;
