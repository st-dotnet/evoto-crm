import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Plus,
  User,
  Calendar,
  CreditCard,
  Wallet,
  Banknote,
  FileText,
  Search,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpinnerDotted } from "spinners-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const CreatePaymentIn = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [parties, setParties] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPartiesLoading, setIsPartiesLoading] = useState(false);

  const handleBackClick = () => {
    navigate('/payment-in');
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // TODO: Implement save logic
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Payment created successfully");
      navigate('/payment-in');
    } catch (error) {
      toast.error("Failed to create payment");
    } finally {
      setIsSaving(false);
    }
  };

  // Mock fetch parties function
  const fetchParties = async () => {
    setIsPartiesLoading(true);
    try {
      // Mock data - replace with actual API call
      // Only showing invoiced parties (XYZ and others with invoices)
      const mockParties = [
        { id: "1", name: "XYZ Solutions", mobile: "9876543211", hasInvoices: true },
        { id: "2", name: "ABC Company", mobile: "9876543210", hasInvoices: true },
        { id: "3", name: "Test Customer", mobile: "9876543212", hasInvoices: true },
        { id: "4", name: "Non-Invoiced Party", mobile: "9876543213", hasInvoices: false }, // This won't appear
      ];
      setParties(mockParties);
    } catch (error) {
      toast.error("Failed to fetch parties");
    } finally {
      setIsPartiesLoading(false);
    }
  };

  const handlePartySelect = (party: any) => {
    setSelectedParty(party);
    setIsAddingParty(false);
    setSearchQuery("");
  };

  const filteredParties = parties.filter((party) => {
    // Only show parties that have invoices
    if (!party.hasInvoices) return false;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      party.name.toLowerCase().includes(searchLower) ||
      (party.mobile && party.mobile.includes(searchQuery))
    );
  });

  useEffect(() => {
    fetchParties();
  }, []);

  const paymentModes = [
    { id: "cash", label: "Cash", icon: Banknote },
    { id: "bank_transfer", label: "Bank", icon: CreditCard },
    { id: "upi", label: "UPI", icon: Wallet },
    { id: "cheque", label: "Cheque", icon: FileText },
    { id: "netbanking", label: "Net Banking", icon: CreditCard },
    { id: "card", label: "Card", icon: CreditCard },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6 relative">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <SpinnerDotted size={50} thickness={100} speed={100} color="#1B84FF" />
          <p className="ml-4 text-sm font-medium text-gray-600">Loading details...</p>
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
            Create Payment In
          </h1>
        </div>
        <Button
          type="button"
          className="bg-[#1B84FF] hover:bg-[#0F6FE0] text-white gap-2 px-4 py-2 rounded-lg"
          disabled={isSaving}
          onClick={handleSave}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Payment"}
        </Button>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Div - Party List Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Party Payments</h2>

            {/* Party List Items */}
            <div className="space-y-3">
              {isAddingParty ? (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Search Party</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search parties..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
                          autoFocus
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {isPartiesLoading ? (
                      <div className="text-center py-4">
                        <div className="inline-flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 border-t-transparent"></div>
                          <span className="ml-2 text-sm text-gray-600">Loading...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                        {filteredParties.length > 0 ? (
                          filteredParties.map((party) => (
                            <div
                              key={party.id}
                              onClick={() => handlePartySelect(party)}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium text-sm text-gray-900">{party.name}</div>
                                  <div className="text-xs text-gray-500">{party.mobile}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-sm text-gray-500">
                            No parties found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Sample Party Item */}
                  <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Party Name</label>
                        <Input
                          type="text"
                          value={selectedParty?.name || ""}
                          className="h-8 text-sm"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Payment Received</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Payment In Discount</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Add More Parties Button */}
                  <Button
                    variant="outline"
                    className="w-full h-8 gap-2 text-sm border-dashed"
                    onClick={() => setIsAddingParty(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Add Party
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Div - Payment Details Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment Details</h2>

            <div className="space-y-4">
              {/* Payment Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Number
                  </label>
                  <Input
                    type="text"
                    value="PAY-2024-001"
                    className="bg-gray-50 h-8"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date
                  </label>
                  <Input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full h-8"
                  />
                </div>
              </div>

              {/* Total Amounts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Settled
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="w-full h-8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Amount Received
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="w-full h-8"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  style={{ color: '#000000', backgroundColor: '#ffffff' }}
                  className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-10"
                >
                  <option value="">Select payment mode</option>
                  {paymentModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePaymentIn;
