import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  FileText,
  Loader2,
  ArrowLeft,
  Printer,
  PrinterIcon,
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

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');

  .rp-root {
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Header Band ── */
  .rp-header-band {
    background: linear-gradient(135deg, #0F1117 0%, #1A1D2E 55%, #21243A 100%);
    border-radius: 16px;
    padding: 22px 26px;
    position: relative;
    overflow: hidden;
    margin-bottom: 18px;
    box-shadow: 0 8px 32px rgba(10,12,20,0.22), 0 1px 0 rgba(255,255,255,0.04) inset;
  }
  .rp-header-band::before {
    content: '';
    position: absolute;
    top: -50px; right: -30px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(108,99,255,0.22) 0%, transparent 68%);
    pointer-events: none;
  }
  .rp-header-band::after {
    content: '';
    position: absolute;
    bottom: -35px; left: 38%;
    width: 140px; height: 140px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,196,140,0.1) 0%, transparent 70%);
    pointer-events: none;
  }
  .rp-header-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .rp-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .rp-back-btn {
    height: 32px; width: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .rp-back-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
  }
  .rp-icon-wrap {
    height: 42px; width: 42px;
    border-radius: 12px;
    background: linear-gradient(140deg, #6C63FF 0%, #8B85FF 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 14px rgba(108,99,255,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset;
    flex-shrink: 0;
  }
  .rp-title {
    font-family: 'DM Serif Display', serif;
    font-size: 21px;
    color: #FFFFFF;
    letter-spacing: -0.3px;
    line-height: 1.2;
  }
  .rp-subtitle {
    font-size: 11.5px;
    color: #FFFFFF;
    margin-top: 2px;
    font-weight: 400;
  }
  .rp-dl-btn {
    height: 34px;
    padding: 0 14px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.8);
    font-size: 12px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    display: flex; align-items: center; gap: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .rp-dl-btn:hover:not(:disabled) {
    background: rgba(108,99,255,0.28);
    border-color: rgba(108,99,255,0.55);
    color: #fff;
    box-shadow: 0 0 18px rgba(108,99,255,0.25);
  }
  .rp-dl-btn:disabled { opacity: 0.38; cursor: not-allowed; }

  /* ── Card ── */
  .rp-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #EAECF0;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.04);
  }

  /* ── Search Bar ── */
  .rp-search-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 18px;
    border-bottom: 1px solid #F2F3F5;
    background: #FAFBFC;
    gap: 12px;
  }
  .rp-search-wrap {
    position: relative;
    width: 270px;
  }
  .rp-search-wrap input {
    height: 34px;
    width: 100%;
    padding-left: 32px;
    font-size: 12.5px;
    font-family: 'DM Sans', sans-serif;
    border-radius: 8px;
    border: 1.5px solid #E5E7EB;
    background: #fff;
    outline: none;
    color: #111318;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .rp-search-wrap input::placeholder { color: #BDC1CA; }
  .rp-search-wrap input:focus {
    border-color: #6C63FF;
    box-shadow: 0 0 0 3px rgba(108,99,255,0.1);
  }
  .rp-search-icon {
    position: absolute; left: 10px; top: 50%;
    transform: translateY(-50%);
    color: #BDC1CA; pointer-events: none;
  }
  .rp-count-tag {
    font-size: 11px;
    font-weight: 500;
    color: #9CA3AF;
    background: #F3F4F6;
    border-radius: 20px;
    padding: 3px 11px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Table ── */
  .rp-table {
    width: 100%;
    border-collapse: collapse;
  }
  .rp-thead th {
    padding: 10px 18px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #A0A7B5;
    background: #F9FAFB;
    border-bottom: 1px solid #F0F1F3;
    white-space: nowrap;
  }
  .rp-col-accent {
    display: inline-block;
    width: 2px; height: 12px;
    background: linear-gradient(180deg, #6C63FF, #B8B5FF);
    border-radius: 2px;
    vertical-align: middle;
    margin-right: 7px;
    margin-bottom: 1px;
  }
  .rp-row {
    border-bottom: 1px solid #F7F8FA;
    transition: background 0.1s ease;
  }
  .rp-row:last-child { border-bottom: none; }
  .rp-row:hover { background: #F8F7FF; }
  .rp-row td { padding: 11px 18px; vertical-align: middle; }

  .rp-item-name {
    font-size: 13.5px;
    font-weight: 500;
    color: #111318;
    letter-spacing: -0.1px;
  }

  .rp-code-pill {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    font-weight: 500;
    color: #6B7280;
    background: #F3F4F6;
    border: 1px solid #E9EAEC;
    border-radius: 5px;
    padding: 2px 7px;
    letter-spacing: 0.4px;
  }

  .rp-mrp-val {
    font-size: 13px;
    color: #9CA3AF;
    font-weight: 400;
  }

  /* Selling price cell */
  .rp-sp-clickable {
    display: inline-flex;
    cursor: pointer;
    border-radius: 7px;
    padding: 1px;
    transition: all 0.12s;
  }
  .rp-sp-badge {
    font-size: 13px;
    font-weight: 600;
    color: #007A5A;
    background: linear-gradient(135deg, #EAFAF4 0%, #DDF5EC 100%);
    border: 1px solid #B7EDD8;
    border-radius: 7px;
    padding: 3px 10px;
    transition: all 0.12s;
    letter-spacing: -0.1px;
  }
  .rp-sp-clickable:hover .rp-sp-badge {
    background: linear-gradient(135deg, #D5F5EB 0%, #C0EDDA 100%);
    box-shadow: 0 2px 8px rgba(0,122,90,0.14);
  }
  .rp-sp-dash { font-size: 13px; color: #D1D5DB; padding: 2px 0; }

  /* Edit input */
  .rp-edit-input {
    width: 96px;
    padding: 4px 9px;
    font-size: 12.5px;
    font-family: 'DM Sans', sans-serif;
    border: 1.5px solid #6C63FF;
    border-radius: 7px;
    outline: none;
    box-shadow: 0 0 0 3px rgba(108,99,255,0.12);
    background: #fff;
    color: #111318;
    -moz-appearance: textfield;
  }
  .rp-edit-input::-webkit-inner-spin-button,
  .rp-edit-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

  /* Loading & Error */
  .rp-loader {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 56px 0;
  }
  .rp-error-box {
    margin: 16px;
    background: #FEF2F2;
    border: 1px solid #FEE2E2;
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: #B91C1C;
  }
  .rp-retry-btn {
    margin-left: auto;
    font-size: 11.5px;
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid #FCA5A5;
    background: #fff;
    color: #B91C1C;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.12s;
  }
  .rp-retry-btn:hover { background: #FEF2F2; }

  /* Empty */
  .rp-empty {
    text-align: center;
    padding: 56px 16px;
  }

  /* Animations */
  @keyframes rp-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rp-anim-band { animation: rp-in 0.3s cubic-bezier(.22,.68,0,1.2) both; }
  .rp-anim-card { animation: rp-in 0.3s cubic-bezier(.22,.68,0,1.2) 0.07s both; }
  .rp-row       { animation: rp-in 0.22s ease both; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.9s linear infinite; }
`;

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
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const handlePrintForPrint = async () => {
    try {
      await printInventoryForPrint({ search: searchTerm });
      toast.success("Print dialog opened successfully!");
    } catch (error) {
      console.error("Print failed:", error);
      toast.error("Failed to open print dialog. Please try again.");
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
    <>
      <style>{styles}</style>
      <div className="rp-root" style={{ padding: "20px 20px 36px", minWidth: 0 }}>

        {/* ── Header ── */}
        <div className="rp-header-band rp-anim-band">
          <div className="rp-header-content">
            <div className="rp-header-left">
              <button className="rp-back-btn" onClick={() => window.history.back()}>
                <ArrowLeft style={{ width: 14, height: 14, color: "rgba(255,255,255,0.65)" }} />
              </button>
              <div className="rp-icon-wrap">
                <FileText style={{ width: 18, height: 18, color: "#fff" }} />
              </div>
              <div>
                <div className="rp-title">Rate List</div>
                <div className="rp-subtitle">
                  {loading
                    ? "Loading inventory…"
                    : `Double-click selling price to edit`
                  }
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={loading}
                className="h-8 px-3 text-xs gap-1.5 bg-white border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 hover:shadow-md hover:scale-[1.02] transition-all duration-200 group"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintForPrint}
                disabled={loading}
                className="h-8 px-3 text-xs gap-1.5 bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md hover:scale-[1.02] transition-all duration-200 group"
              >
                <PrinterIcon className="w-3.5 h-3.5" />
                Print Rate List
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPDF}
                disabled={loading}
                className="h-8 px-3 text-xs gap-1.5 bg-white border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 hover:shadow-md hover:scale-[1.02] transition-all duration-200 group"
              >
                <Printer className="w-3.5 h-3.5" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="rp-card rp-anim-card">

          {/* Search */}
          <div className="rp-search-row">
            <div className="rp-search-wrap">
              <Search className="rp-search-icon" style={{ width: 13, height: 13 }} />
              <input
                type="text"
                placeholder="Search by name or item code…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {!loading && (
              <span className="rp-count-tag">{filteredData.length} results</span>
            )}
          </div>

          {/* Loader */}
          {loading && (
            <div className="rp-loader">
              <Loader2 style={{ width: 18, height: 18, color: "#6C63FF" }} className="spin" />
              <span style={{ fontSize: 13, color: "#9CA3AF" }}>Loading inventory…</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rp-error-box">
              <strong>Error:</strong>&nbsp;{error}
              <button className="rp-retry-btn" onClick={fetchInventoryData}>Retry</button>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div style={{ overflowX: "auto" }}>
              <div style={{ maxHeight: "42rem", overflowY: "auto" }}>
                <table className="rp-table">
                  <thead className="rp-thead">
                    <tr>
                      <th style={{ width: "44%" }}>
                        <span className="rp-col-accent" />Item Name
                      </th>
                      <th>Item Code</th>
                      <th>MRP</th>
                      <th>Selling Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, idx) => {
                      const mrp = fmt(item.purchase_price);
                      const sp = fmt(item.selling_price);
                      const isEditing = editingCell?.id === item.id && editingCell?.field === "selling_price";

                      return (
                        <tr
                          key={item.id}
                          className="rp-row"
                          style={{ animationDelay: `${Math.min(idx * 0.016, 0.28)}s` }}
                        >
                          <td>
                            <span className="rp-item-name">{item.name}</span>
                          </td>
                          <td>
                            {item.item_code
                              ? <span className="rp-code-pill">{item.item_code}</span>
                              : <span style={{ color: "#E2E4E9" }}>—</span>
                            }
                          </td>
                          <td>
                            {mrp
                              ? <span className="rp-mrp-val">{mrp}</span>
                              : <span style={{ color: "#E2E4E9" }}>—</span>
                            }
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={handleBlur}
                                  onKeyPress={handleKey}
                                  disabled={updatingPrice}
                                  className="rp-edit-input"
                                  autoFocus
                                />
                                {updatingPrice && (
                                  <Loader2 style={{ width: 12, height: 12, color: "#6C63FF" }} className="spin" />
                                )}
                              </div>
                            ) : (
                              <div
                                className="rp-sp-clickable"
                                onDoubleClick={() => handleDoubleClick(item, "selling_price")}
                                title="Double-click to edit"
                              >
                                {sp
                                  ? <span className="rp-sp-badge">{sp}</span>
                                  : <span className="rp-sp-dash">—</span>
                                }
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredData.length === 0 && (
                  <div className="rp-empty">
                    <FileText style={{ width: 34, height: 34, margin: "0 auto 10px", color: "#D1D5DB" }} />
                    <p style={{ fontSize: 13, color: "#9CA3AF" }}>No items match your search.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReportsPage;