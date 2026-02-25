// import { useParams } from "react-router-dom";
// import { useEffect, useState } from "react";
// import axios from "axios";
// import { KeenIcon } from "@/components";
// import { SpinnerDotted } from "spinners-react";
// import { Country, State } from "country-state-city";

// interface Customer {
//   uuid?: string;
//   first_name: string;
//   last_name: string;
//   mobile: string;
//   email: string;
//   gst?: string;
//   status?: string;
//   person_type?: string;
//   city?: string;
//   state?: string;
//   country?: string;
//   pin?: string;
//   address1?: string;
//   address2?: string;
//   created_at?: string;
// }

// const STATUS_LABEL_TO_VALUE: Record<string, string> = {
//   "1": "New",
//   "2": "In-Progress",
//   "3": "Quote Given",
//   "4": "Win",
//   "5": "Lose",
// };

// export const CustomerDetails = () => {
//   const { uuid } = useParams<{ uuid: string }>();
//   const [customer, setCustomer] = useState<Customer | null>(null);
//   const [activeTab, setActiveTab] = useState<
//     "overview" | "activities" | "intelligence"
//   >("overview");

//   useEffect(() => {
//     const fetchCustomer = async () => {
//       try {
//         const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
//         const url = baseUrl.endsWith("/")
//           ? `${baseUrl}customers/${uuid}`
//           : `${baseUrl}/customers/${uuid}`;
//         const response = await axios.get<Customer>(url);
//         setCustomer(response.data);
//       } catch (error) {
//         console.error("Error fetching customer details:", error);
//       }
//     };
//     if (uuid) fetchCustomer();
//   }, [uuid]);

//   if (!customer)
//     return (
//       <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-[#0D0E12]">
//         <SpinnerDotted color="currentColor" />
//       </div>
//     );

//   return (
//     <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 dark:bg-[#0D0E12]">
//       {/* LEFT SIDEBAR */}
//       <div className="w-full lg:w-96 bg-white dark:bg-[#0D0E12] shadow-md p-4 sm:p-6 overflow-y-auto">
//         {/* Header */}
//         <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
//           <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
//             {customer.first_name?.[0] + customer.last_name?.[0] || "C"}
//           </div>
//           <div className="text-center sm:text-left">
//             <h1 className="text-lg sm:text-xl font-semibold break-words">
//               {customer.first_name || customer.last_name
//                 ? `${customer.first_name || ""} ${customer.last_name || ""
//                   }`.trim()
//                 : "--"}
//             </h1>
//             <p className="text-gray-500 break-all text-sm">
//               {customer.email || "--"}
//             </p>
//           </div>
//         </div>

//         {/* Actions */}
//         <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
//           {[
//             { icon: "notepad-edit", label: "Note" },
//             { icon: "sms", label: "Email" },
//             { icon: "call", label: "Call" },
//             { icon: "note", label: "Task" },
//             { icon: "calendar", label: "Meeting" },
//           ].map((btn) => (
//             <button
//               key={btn.label}
//               className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
//             >
//               <KeenIcon icon={btn.icon} />
//               {btn.label}
//             </button>
//           ))}
//         </div>

//         {/* About Section */}
//         <div className="mt-8">
//           <h2 className="text-base sm:text-lg font-semibold mb-3">
//             About this customer
//           </h2>
//           <div className="space-y-2 text-sm sm:text-base text-gray-700 break-words">
//             <p><strong>Email:</strong> {customer.email || "--"}</p>
//             <p><strong>Mobile:</strong> {customer.mobile || "--"}</p>
//             <p><strong>GST:</strong> {customer.gst || "--"}</p>
//             <p>
//               <strong>Status:</strong>{" "}
//               {STATUS_LABEL_TO_VALUE[customer.status || ""] || "--"}
//             </p>
//             <p><strong>Person-Type:</strong> {customer.person_type || "--"}</p>
//             <p><strong>Created:</strong> {customer.created_at || "--"}</p>
//           </div>
//         </div>

//         {/* Address */}
//         <div className="mt-8">
//           <h2 className="text-base sm:text-lg font-semibold mb-3">Address</h2>
//           <div className="space-y-2 text-sm sm:text-base text-gray-700 break-words">
//             <p><strong>Address 1:</strong> {customer.address1 || "--"}</p>
//             <p><strong>Address 2:</strong> {customer.address2 || "--"}</p>
//             <p><strong>City:</strong> {customer.city || "--"}</p>
//             <p><strong>State:</strong> {customer.state ? (State.getStateByCodeAndCountry(customer.state, customer.country || "")?.name || customer.state) : "--"}</p>
//             <p><strong>Country:</strong> {customer.country ? (Country.getCountryByCode(customer.country)?.name || customer.country) : "--"}</p>
//             <p><strong>Pin:</strong> {customer.pin || "--"}</p>
//           </div>
//         </div>
//       </div>

//       {/* RIGHT CONTENT */}
//       <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
//         {/* Tabs */}
//         <div className="overflow-x-auto border-b mb-6">
//           <div className="flex min-w-max">
//             {["overview", "activities", "intelligence"].map((tab) => (
//               <button
//                 key={tab}
//                 onClick={() => setActiveTab(tab as any)}
//                 className={`px-4 sm:px-6 py-3 text-sm font-medium whitespace-nowrap transition ${activeTab === tab
//                   ? "border-b-2 border-gray-600 text-gray-600"
//                   : "text-gray-500 hover:text-gray-700"
//                   }`}
//               >
//                 {tab.charAt(0).toUpperCase() + tab.slice(1)}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* OVERVIEW */}
//         {activeTab === "overview" && (
//           <div>
//             {/* Activity Totals */}
//             <div className="bg-white dark:bg-[#0D0E12] rounded-xl shadow p-4 sm:p-6 mb-6 dark:border dark:border-gray-700">
//               <h3 className="text-base sm:text-lg font-semibold mb-4">
//                 Activity totals
//               </h3>
//               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
//                 <div>
//                   <p className="text-sm text-gray-600">ORDERS</p>
//                   <p className="text-2xl font-bold">0</p>
//                 </div>
//                 <div>
//                   <p className="text-sm text-gray-600">PAYMENTS</p>
//                   <p className="text-2xl font-bold">0</p>
//                 </div>
//                 <div>
//                   <p className="text-sm text-gray-600">SUPPORT TICKETS</p>
//                   <p className="text-2xl font-bold">0</p>
//                 </div>
//               </div>
//             </div>

//             {/* Data Highlights */}
//             <div className="bg-white dark:bg-[#0D0E12] rounded-xl shadow p-4 sm:p-6 mb-6 dark:border dark:border-gray-700">
//               <h3 className="text-base sm:text-lg font-semibold mb-4">
//                 Data highlights
//               </h3>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
//                 <div>
//                   <p className="text-gray-500">CREATE DATE</p>
//                   <p>{customer.created_at || "--"}</p>
//                 </div>
//                 <div>
//                   <p className="text-gray-500">STATUS</p>
//                   <p>
//                     {STATUS_LABEL_TO_VALUE[customer.status || ""] || "--"}
//                   </p>
//                 </div>
//                 <div>
//                   <p className="text-gray-500">LAST ACTIVITY DATE</p>
//                   <p className="font-medium">--</p>
//                 </div>
//               </div>
//             </div>

//             {/* Recent Activities */}
//             <div className="bg-white dark:bg-[#0D0E12] rounded-xl shadow p-4 sm:p-6 mb-6 dark:border dark:border-gray-700">
//               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
//                 <h3 className="text-base sm:text-lg font-semibold">
//                   Recent activities
//                 </h3>
//                 <button className="text-sm text-gray-600 hover:underline">
//                   All time so far
//                 </button>
//               </div>

//               <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 text-sm text-center">
//                 <svg
//                   className="w-12 h-12 mb-2 text-gray-400"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                 >
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//                 </svg>
//                 <p>No activities.</p>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* ACTIVITIES */}
//         {activeTab === "activities" && (
//           <div className="flex flex-col h-full">
//             {/* Search and Filters */}
//             <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between mb-6">
//               <div className="relative flex-1 group">
//                 <input
//                   type="text"
//                   placeholder="Search activities"
//                   className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm 
//                      dark:bg-[#0D0E12] dark:border-gray-700 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
//                 />
//                 <KeenIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500" />
//               </div>
//               <button className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
//                 Collapse all
//               </button>
//             </div>

//             {/* Activity Tabs */}
//             <div className="border-b mb-6 -mx-1 px-1">
//               <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-px">
//                 {["Orders", "Payments", "Support", "Notes", "Calls", "Meetings"].map(
//                   (tab) => (
//                     <button
//                       key={tab}
//                       className="pb-3 text-xs md:text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white relative whitespace-nowrap transition-all hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-500 after:absolute after:bottom-0 after:left-0 after:transition-all"
//                     >
//                       {tab}
//                     </button>
//                   )
//                 )}
//               </div>
//             </div>

//             {/* Timeline */}
//             <div className="space-y-4">
//               <div className="flex items-center gap-2 mb-2">
//                 <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">September 2025</span>
//                 <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
//               </div>

//               <div className="bg-white dark:bg-[#0D0E12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
//                 <div className="flex items-start gap-4">
//                   <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
//                     <KeenIcon icon="user-tick" className="text-blue-600 dark:text-blue-400 text-base" />
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p className="font-bold text-gray-900 dark:text-white text-sm md:text-base mb-1">
//                       Customer created
//                     </p>
//                     <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
//                       <span className="font-semibold text-gray-800 dark:text-gray-200">
//                         {`${customer.first_name} ${customer.last_name}`.trim() || "--"}
//                       </span>{" "}
//                       was added to the system.{" "}
//                       <span className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline font-medium">
//                         View details
//                       </span>
//                     </p>
//                     <div className="flex items-center gap-2 mt-3 text-[11px] md:text-xs text-gray-400">
//                       <KeenIcon icon="calendar" className="text-sm" />
//                       <span>{customer.created_at || "--"}</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-white dark:bg-[#0D0E12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
//                 <div className="flex items-start gap-4">
//                   <div className="h-8 w-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
//                     <KeenIcon icon="devices" className="text-green-600 dark:text-green-400 text-base" />
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
//                       This contact was created from <span className="font-medium text-gray-800 dark:text-gray-200">Offline Sources</span> from CRM UI
//                     </p>
//                     <div className="flex items-center gap-2 mt-3 text-[11px] md:text-xs text-gray-400">
//                       <KeenIcon icon="calendar" className="text-sm" />
//                       <span>{customer.created_at || "--"}</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* INTELLIGENCE */}
//         {activeTab === "intelligence" && (
//           <div className="bg-white dark:bg-[#0D0E12] rounded-xl shadow p-4 sm:p-6 dark:border dark:border-gray-700">
//             <p className="text-gray-500 text-sm">
//               No intelligence data available yet.
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };








import { KeenIcon } from "@/components";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { SpinnerDotted } from "spinners-react";
import { Country, State } from "country-state-city";

interface Customer {
  uuid?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst?: string;
  status?: string;
  person_type?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
  address1?: string;
  address2?: string;
  created_at?: string;
}

const STATUS_LABEL_TO_VALUE: Record<string, string> = {
  "1": "New",
  "2": "In-Progress",
  "3": "Quote Given",
  "4": "Win",
  "5": "Lose",
};

export const CustomerDetails = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "intelligence">("overview");
  const [fetchingCustomer, setFetchingCustomer] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        setFetchingCustomer(true);
        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const url = baseUrl.endsWith("/")
          ? `${baseUrl}customers/${uuid}`
          : `${baseUrl}/customers/${uuid}`;
        const response = await axios.get<Customer>(url);
        setCustomer(response.data);
      } catch (error: any) {
        console.error("Error fetching customer details:", error);
        toast.error(error?.response?.data?.message || "Failed to load customer details");
      } finally {
        setFetchingCustomer(false);
      }
    };
    if (uuid) fetchCustomer();
  }, [uuid]);

  const deleteCustomer = async (uuid: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/customers/${uuid}`);
      toast.success("Customer deleted successfully");
      navigate("/parties/customers");
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

  const fullName = customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : "N/A";
  const initials = customer ? `${customer.first_name?.[0] || ""}${customer.last_name?.[0] || ""}`.toUpperCase() : "?";

  if (!customer || fetchingCustomer) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center text-[#0D0E12]">
        <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 bg-[#F9FAFB] min-h-screen dark:bg-[#09090B]">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Customer Details</h1>
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => navigate("/")} className="hover:text-blue-600 transition-colors">Home</button>
            <KeenIcon icon="right" className="text-[10px]" />
            <button onClick={() => navigate("/parties/customers")} className="hover:text-blue-600 transition-colors">Customers</button>
            <KeenIcon icon="right" className="text-[10px]" />
            <span className="text-gray-900 font-medium">{fullName}</span>
          </nav>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/customer/${uuid}/edit`)}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            <KeenIcon icon="pencil" className="text-sm" /> Edit Customer
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-[#121214]">
            <div className="flex flex-col items-center text-center pb-8 border-b border-gray-100">
              <div className="h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-2xl font-bold mb-4 border border-blue-100">
                {initials || fullName[0]}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{fullName}</h2>
              <p className="text-gray-500 text-sm mb-4">{customer.email || "No email provided"}</p>

              <span className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${customer.status === "4" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                }`}>
                {STATUS_LABEL_TO_VALUE[customer.status || ""] || "New"}
              </span>
            </div>

            <div className="py-8 space-y-6">
              <ContactRow icon="phone" label="Phone" value={customer.mobile} color="text-purple-500" />
              <ContactRow icon="sms" label="Email" value={customer.email} color="text-blue-500" />
              <ContactRow icon="calendar" label="Created" value={customer.created_at} color="text-orange-500" />
              <ContactRow icon="geolocation" label="City" value={customer.city} color="text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Right Column: Information Tabs/Sections */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tabs */}
          <div className="overflow-x-auto border-b">
            <div className="flex min-w-max">
              {["overview", "activities", "intelligence"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-3 text-sm font-medium transition ${activeTab === tab
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
                  <h3 className="font-bold text-gray-900 text-lg">General Information</h3>
                  <KeenIcon icon="user" className="text-gray-400 text-xl" />
                </div>
                <div className="p-8 dark:bg-[#121214]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <DataField label="First Name" value={customer.first_name} />
                    <DataField label="Last Name" value={customer.last_name} />
                    {/* <DataField label="Mobile Number" value={customer.mobile} /> */}
                    {/* <DataField label="Email Address" value={customer.email} /> */}
                    <DataField label="GST Number" value={customer.gst} />
                    <DataField label="Person Type" value={customer.person_type} />
                    <DataField label="Status" value={STATUS_LABEL_TO_VALUE[customer.status || ""] || "--"} />
                    <DataField label="State" value={customer.state && customer.country ? State.getStateByCodeAndCountry(customer.state, customer.country)?.name : "--"} />
                    <DataField label="Country" value={customer.country ? Country.getCountryByCode(customer.country)?.name : "--"} />
                    {/* <DataField label="City" value={customer.city} /> */}
                  </div>
                </div>
              </div>

              {/* Address Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between dark:bg-[#121214]">
                  <h3 className="font-bold text-gray-900 text-lg">Address Details</h3>
                  <KeenIcon icon="geolocation" className="text-gray-400 text-xl" />
                </div>
                <div className="p-8 dark:bg-[#121214]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <DataField label="Address Line 1" value={customer.address1} />
                    <DataField label="Address Line 2" value={customer.address2} />
                    <DataField label="City" value={customer.city} />
                    <DataField label="Pincode" value={customer.pin} />
                  </div>
                </div>
              </div>

              {/* Activity Summary Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between dark:bg-[#121214]">
                  <h3 className="font-bold text-gray-900 text-lg">Activity Summary</h3>
                  <KeenIcon icon="chart-line" className="text-gray-400 text-xl" />
                </div>
                <div className="p-8 dark:bg-[#121214]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 dark:bg-white/5 dark:border-white/5 text-center">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Orders</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">0</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 dark:bg-white/5 dark:border-white/5 text-center">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Payments</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">0</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 dark:bg-white/5 dark:border-white/5 text-center">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Tickets</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">0</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* {activeTab === "activities" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-[#121214]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">Recent Activities</h3>
                <button className="text-sm text-blue-600 font-bold hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                <div className="relative pb-4 pl-8 border-l-2 border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                  <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-blue-500 border-4 border-white dark:border-[#121214]" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Customer created</p>
                  <p className="text-xs text-gray-500 mb-2">{customer.created_at}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Successfully registered in the CRM system.</p>
                </div>
              </div>
            </div>
          )} */}
          {/* ACTIVITIES */}
        {activeTab === "activities" && (
          <div className="flex flex-col h-full">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between mb-6">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  placeholder="Search activities"
                  className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm 
                     dark:bg-[#0D0E12] dark:border-gray-700 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
                <KeenIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500" />
              </div>
              <button className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
                Collapse all
              </button>
            </div>

            {/* Activity Tabs */}
            <div className="border-b mb-6 -mx-1 px-1">
              <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-px">
                {["Orders", "Payments", "Support", "Notes", "Calls", "Meetings"].map(
                  (tab) => (
                    <button
                      key={tab}
                      className="pb-3 text-xs md:text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white relative whitespace-nowrap transition-all hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-500 after:absolute after:bottom-0 after:left-0 after:transition-all"
                    >
                      {tab}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">September 2025</span>
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
              </div>

              <div className="bg-white dark:bg-[#0D0E12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                    <KeenIcon icon="user-tick" className="text-blue-600 dark:text-blue-400 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-sm md:text-base mb-1">
                      Customer created
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {`${customer.first_name} ${customer.last_name}`.trim() || "--"}
                      </span>{" "}
                      was added to the system.{" "}
                      <span className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline font-medium">
                        View details
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[11px] md:text-xs text-gray-400">
                      <KeenIcon icon="calendar" className="text-sm" />
                      <span>{customer.created_at || "--"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0D0E12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                    <KeenIcon icon="devices" className="text-green-600 dark:text-green-400 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      This contact was created from <span className="font-medium text-gray-800 dark:text-gray-200">Offline Sources</span> from CRM UI
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[11px] md:text-xs text-gray-400">
                      <KeenIcon icon="calendar" className="text-sm" />
                      <span>{customer.created_at || "--"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          {activeTab === "intelligence" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 dark:bg-[#121214]">
              <h3 className="text-lg font-bold mb-4">Customer Intelligence</h3>
              <p className="text-gray-500 text-sm">No intelligence data available yet for this customer.</p>
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
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete Customer?</h3>
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
                onClick={() => deleteCustomer(customer.uuid!)}
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