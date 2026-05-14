import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  FileText,
  Loader2,
  ArrowLeft,
  Printer,
  PrinterIcon,
  AlertTriangle,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getInventoryItems,
  exportInventoryToExcel,
  printInventoryPDF,
  printInventoryForPrint,
} from "./service/inventory.service";
import { updateItem } from "../items/services/items.service";
import { toast } from "sonner";

interface ReportsInventoryItem {
  id: string;
  name: string;
  item_code: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  category: string;
  description?: string;
  hsn_sac_code?: string;
  measuring_unit?: string;
  created_at?: string;
  updated_at?: string;
}

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryData, setInventoryData] = useState<ReportsInventoryItem[]>([]);
  const [filteredData, setFilteredData] = useState<ReportsInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const fetchInventoryData = async () => {
    setLoading(true); setError(null);
    try {
      const response = await getInventoryItems({ items_per_page: 10000 });
      if (response.success && response.data) {
        const t = response.data.map(item => ({ ...item, purchase_price: item.mrp }));
        setInventoryData(t); setFilteredData(t);
      } else {
        setError(response.error || "Failed to fetch inventory data");
      }
    } catch { setError("An unexpected error occurred"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInventoryData(); }, []);

  useEffect(() => {
    setFilteredData(
      inventoryData.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, inventoryData]);

  const fmt = (v: number | null | undefined) =>
    v ? `₹${v.toFixed(2)}` : null;

  const handleDoubleClick = (item: ReportsInventoryItem, field: string) => {
    if (field === "selling_price") {
      setEditingCell({ id: item.id, field });
      setEditValue(item.selling_price ? item.selling_price.toString() : "");
    }
  };

  const handleBlur = async () => {
    if (editingCell) {
      const newPrice = parseFloat(editValue) || 0;
      const cur = filteredData.find(i => i.id === editingCell.id);
      if (cur && cur[editingCell.field as keyof ReportsInventoryItem] !== newPrice) {
        setUpdatingPrice(true);
        try {
          const res = await updateItem(editingCell.id, { sales_price: newPrice });
          if (res.success) {
            const upd = filteredData.map(i =>
              i.id === editingCell.id ? { ...i, [editingCell.field]: newPrice } : i
            );
            setFilteredData(upd); setInventoryData(upd);
            toast.success(`Price updated for ${cur.name}`);
          } else toast.error(`Failed: ${res.error}`);
        } catch { toast.error("Update failed. Try again."); }
        finally { setUpdatingPrice(false); }
      }
    }
    setEditingCell(null); setEditValue("");
  };

  const handlePrintPDF = async () => {
    try {
      await printInventoryPDF({ search: searchTerm });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const handlePrintForPrint = async () => {
    try {
      await printInventoryForPrint({ search: searchTerm });
    } catch (error) {
      console.error("Print failed:", error);
      toast.error("Failed to open print dialog");
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportInventoryToExcel({ search: searchTerm });
      toast.success("Excel file downloaded successfully!");
    } catch (error) {
      console.error("Excel export failed:", error);
      toast.error("Failed to export Excel. Please try again.");
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleBlur();
    else if (e.key === "Escape") { setEditingCell(null); setEditValue(""); }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <FileText className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Rate List</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {loading ? "Loading inventory..." : "Double-click selling price to edit"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={loading}
              className="rounded-xl border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 gap-2 h-10 px-4 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintForPrint}
              disabled={loading}
              className="rounded-xl border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 gap-2 h-10 px-4 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              <PrinterIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Print List</span>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintPDF}
              disabled={loading}
              className="rounded-xl border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 gap-2 h-10 px-4 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Search & Stats Bar */}
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name or item code..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-800 transition-all"
              />
            </div>
            {!loading && (
              <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {filteredData.length} Items Found
              </span>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Fetching inventory data...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="m-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
                <AlertTriangle className="w-5 h-5" />
                <p><strong>Error:</strong> {error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchInventoryData} className="rounded-lg border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400">
                Retry
              </Button>
            </div>
          )}

          {/* Data Table */}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      Item Details
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      Item Code
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      MRP
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      Selling Price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredData.map((item, idx) => {
                    const mrp = fmt(item.purchase_price);
                    const sp = fmt(item.selling_price);
                    const isEditing = editingCell?.id === item.id && editingCell?.field === "selling_price";

                    return (
                      <tr 
                        key={item.id} 
                        className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                            {item.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {item.item_code ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-medium font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              {item.item_code}
                            </span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-500 dark:text-zinc-500">
                            {mrp || <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={handleBlur}
                                onKeyDown={handleKey}
                                disabled={updatingPrice}
                                className="w-28 h-9 px-3 rounded-lg border-2 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm focus:outline-none transition-all shadow-sm"
                                autoFocus
                              />
                              {updatingPrice && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                            </div>
                          ) : (
                            <div
                              onDoubleClick={() => handleDoubleClick(item, "selling_price")}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 text-green-700 dark:text-green-400 font-bold text-sm cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20 transition-all group/price"
                              title="Double-click to edit"
                            >
                              {sp || <span className="text-green-300 dark:text-green-800">—</span>}
                              <Edit className="w-3 h-3 ml-2 opacity-0 group-hover/price:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredData.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-600">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No matching items found in the inventory</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;