import { ScreenLoader } from "@/components/loaders";
import { KeenIcon } from "@/components";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Lead } from "./lead-models";

export const LeadDetails = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "intelligence">("overview");
  const [fetchingLead, setFetchingLead] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLead = async () => {
      try {
        setFetchingLead(true);
        const response = await axios.get<Lead>(
          `${import.meta.env.VITE_APP_API_URL}/leads/${uuid}`
        );
        setLead(response.data);
      } catch (error: any) {
        console.error("Error fetching lead details:", error);
        toast.error(error?.response?.data?.message || "Failed to load lead details");
      } finally {
        setFetchingLead(false);
      }
    };
    fetchLead();
  }, [uuid]);

  const deleteLead = async (uuid: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/leads/${uuid}`);
      toast.success("Lead deleted successfully");
      navigate("/parties/leads");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Delete failed");
    }
  };

  const ContactRow = ({ icon, label, value, color }: any) => (
    <div className="flex items-center gap-4 group cursor-pointer">
      <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-white/5 transition-colors group-hover:bg-white group-hover:shadow-md ${color}`}>
        <KeenIcon icon={icon} className="text-xl" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{value || "--"}</p>
      </div>
    </div>
  );

  const DataField = ({ label, value, status }: any) => (
    <div className="relative pb-2 border-b border-slate-50 dark:border-white/5">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">{label}</p>
      <div className="flex items-center gap-2">
        {status === "success" && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
        {status === "danger" && <span className="h-2 w-2 rounded-full bg-red-500" />}
        <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{value || "--"}</p>
      </div>
    </div>
  );

  const fullName = lead ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : "N/A";
  const initials = lead ? `${lead.first_name?.[0] || ""}${lead.last_name?.[0] || ""}`.toUpperCase() : "?";

  if (!lead || fetchingLead) {
    return <ScreenLoader />;
  }

  return (
    <div className="p-6 lg:p-10 bg-[#F9FAFB] min-h-screen dark:bg-[#09090B]">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Lead Details</h1>
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => navigate("/")} className="hover:text-blue-600 transition-colors">Home</button>
            <KeenIcon icon="right" className="text-[10px]" />
            <button onClick={() => navigate("/parties/leads")} className="hover:text-blue-600 transition-colors">Leads</button>
            <KeenIcon icon="right" className="text-[10px]" />
            <span className="text-gray-900 font-medium">{fullName}</span>
          </nav>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/lead/${uuid}/edit`)}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            <KeenIcon icon="pencil" className="text-sm" /> Edit Lead
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            <KeenIcon icon="trash" className="text-sm" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-[#121214]">
            <div className="flex flex-col items-center text-center pb-8 border-b border-gray-100">
              <div className="h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-2xl font-bold mb-4 border border-blue-100">
                {initials || fullName[0]}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{fullName}</h2>
              <p className="text-gray-500 text-sm mb-4">{lead.email || ""}</p>

              <span className="px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                {lead.status || "New"}
              </span>
            </div>

            <div className="py-8 space-y-6">
              <ContactRow icon="phone" label="Phone" value={lead.mobile} color="text-purple-500" />
              <ContactRow icon="sms" label="Email" value={lead.email} color="text-blue-500" />
              <ContactRow icon="calendar" label="Lead Created" value={lead.created_at} color="text-orange-500" />
              <ContactRow icon="geolocation" label="City" value={lead.city} color="text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Right Column: Information Tabs/Sections */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tabs */}
          <div className="overflow-hidden border-b">
            <div className="flex min-w-max">
              {["overview", "activities", "intelligence"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-5 py-3 text-sm font-medium transition ${activeTab === tab
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* General Information Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white dark:bg-[#121214]">
                  <h3 className="font-bold text-gray-900 text-lg">Lead Information</h3>
                  <KeenIcon icon="user" className="text-gray-400 text-xl" />
                </div>
                <div className="p-8 dark:bg-[#121214]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <DataField label="First Name" value={lead.first_name} />
                    <DataField label="Last Name" value={lead.last_name} />
                    <DataField label="Mobile Number" value={lead.mobile} />
                    <DataField label="Email Address" value={lead.email} />
                    <DataField label="GST Number" value={lead.gst} />
                    <DataField label="Status" value={lead.status} />
                    <DataField label="Created Date" value={lead.created_at} />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between dark:bg-[#121214]">
                  <h3 className="font-bold text-gray-900 text-lg">Address Details</h3>
                  <KeenIcon icon="geolocation" className="text-gray-400 text-xl" />
                </div>
                <div className="p-8 dark:bg-[#121214]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <DataField label="Address 1" value={lead.address1} />
                    <DataField label="Address 2" value={lead.address2} />
                    <DataField label="City" value={lead.city} />
                    <DataField label="State" value={lead.state} />
                    <DataField label="Country" value={lead.country} />
                    <DataField label="Pin Code" value={lead.pin} />
                  </div>
                </div>
              </div>


            </div>
          )}

          {activeTab === "activities" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-[#121214]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">Recent Activities</h3>
                <button className="text-sm text-blue-600 font-bold hover:underline">View All</button>
              </div>
              <div className="border border-dashed border-gray-200 rounded-2xl py-12 flex flex-col items-center justify-center text-gray-400">
                <KeenIcon icon="chart-line-star" className="text-4xl mb-3 text-gray-200" />
                <p className="text-sm">No recent activities found for this lead.</p>
              </div>
              {/* Activity Totals Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between dark:bg-[#121214]">
                  <h3 className="font-bold text-gray-900 text-lg">Activity Summary</h3>
                  <KeenIcon icon="chart-line" className="text-gray-400 text-xl" />
                </div>
                <div className="p-8 dark:bg-[#121214]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 dark:bg-white/5 dark:border-white/5 text-center">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Emails</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">0</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 dark:bg-white/5 dark:border-white/5 text-center">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Calls</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">0</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 dark:bg-white/5 dark:border-white/5 text-center">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Meetings</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">0</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "intelligence" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-[#121214]">
              <h3 className="text-lg font-bold mb-4">Lead Intelligence</h3>
              <p className="text-gray-500 text-sm">No intelligence data available yet for this lead.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#121214] rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <KeenIcon icon="trash" className="text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete Lead?</h3>
            <p className="text-gray-500 text-center text-sm mb-8">
              Are you sure you want to delete <span className="font-bold text-gray-800">{fullName}</span>? This process cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteLead(lead.uuid)}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg "
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};