// import { useParams } from "react-router-dom";
// import { User } from "./user-models"; 
// import { useEffect, useState } from "react";
// import axios from "axios";
// import { KeenIcon } from '@/components';
// import { SpinnerDotted } from 'spinners-react';
// import { useNavigate } from "react-router-dom";

// export const UserDetails = () => {
//   const { id } = useParams<{ id: string }>();
//   const [user, setUser] = useState<User | null>(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const fetchUser = async () => {
//       try {
//         const response = await axios.get<User>(
//           `${import.meta.env.VITE_APP_API_URL}/users/${id}` 
//         );
//         setUser(response.data);
//       } catch (error) {
//         console.error("Error fetching user details:", error);
//       }
//     };
//     fetchUser();
//   }, [id]);

//   if (!user) {
//     return (
//       <div className="fixed inset-0 flex items-center justify-center">
//         <div className="text-[#0D0E12] dark:text-gray-700">
//           <SpinnerDotted color="currentColor" />
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex">
//       {/* Left Sidebar */}
//       <div className="w-96 bg-white shadow-md p-6 overflow-y-auto dark:bg-[#0D0E12]">
//         {/* Header */}
//         <div className="flex items-center gap-4">
//           <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
//             {user.username?.[0]?.toUpperCase() || "U"}
//           </div>
//           <div>
//             <h1 className="text-xl font-semibold">
//               {user.username || "--"}
//             </h1>
//             <p className="text-gray-500">{user.email || "--"}</p>
//           </div>
//         </div>

//         {/* Actions */}
//         <div className="flex flex-wrap gap-3 mt-6">
//           <button 
//             onClick={() => navigate(`/user/${id}/edit`)}
//             className="px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary-active flex items-center gap-2"
//           >
//             <KeenIcon icon="notepad-edit" />
//             Edit User
//           </button>
//         </div>

//         {/* About Section */}
//         <div className="mt-8">
//           <h2 className="text-lg font-semibold mb-3">About this user</h2>
//           <div className="space-y-2 text-gray-700">
//             <p><strong>Username:</strong> {user.username || "--"}</p>
//             <p><strong>Email:</strong> {user.email || "--"}</p>
//             <p><strong>Mobile:</strong> {user.mobile || "--"}</p>
//             <p><strong>Role:</strong> {user.role || "--"}</p>
//             <p><strong>Created:</strong> {user.created_at || "--"}</p>
//             <p><strong>Updated:</strong> {user.updated_at || "--"}</p>
//           </div>
//         </div>

//         {/* Businesses Section */}
//         {user.businesses && user.businesses.length > 0 && (
//           <div className="mt-8">
//             <h2 className="text-lg font-semibold mb-3">Businesses</h2>
//             <div className="space-y-2">
//               {user.businesses.map((business) => (
//                 <div key={business.id} className="p-2 bg-gray-50 rounded-lg">
//                   <p className="font-medium">{business.name}</p>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Right side content */}
//       <div className="flex-1 p-6 bg-gray-50 overflow-y-auto dark:bg-[#0D0E12]">
//         <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12]">
//           <h3 className="text-lg font-semibold mb-4">User Information</h3>
//           <div className="grid grid-cols-2 gap-4 text-sm">
//             <div>
//               <p className="text-gray-500">USER ID</p>
//               <p className="font-medium">{user.id || "--"}</p>
//             </div>
//             <div>
//               <p className="text-gray-500">USERNAME</p>
//               <p className="font-medium">{user.username || "--"}</p>
//             </div>
//             <div>
//               <p className="text-gray-500">EMAIL</p>
//               <p className="font-medium">{user.email || "--"}</p>
//             </div>
//             <div>
//               <p className="text-gray-500">MOBILE</p>
//               <p className="font-medium">{user.mobile || "--"}</p>
//             </div>
//             <div>
//               <p className="text-gray-500">ROLE</p>
//               <p className="font-medium">{user.role || "--"}</p>
//             </div>
//             <div>
//               <p className="text-gray-500">CREATED DATE</p>
//               <p className="font-medium">{user.created_at || "--"}</p>
//             </div>
//             <div>
//               <p className="text-gray-500">LAST UPDATED</p>
//               <p className="font-medium">{user.updated_at || "--"}</p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };


//--------------------------------------------------------Detail1
// import { useParams, useNavigate } from "react-router-dom";
// import { User } from "./user-models";
// import { useEffect, useState } from "react";
// import axios from "axios";
// import { KeenIcon } from '@/components';
// import { SpinnerDotted } from 'spinners-react';
// import { toast } from "sonner";

// export const UserDetails = () => {
//   const { id } = useParams<{ id: string }>();
//   const [user, setUser] = useState<User | null>(null);
//   const navigate = useNavigate();
//   const [showDeleteDialog, setShowDeleteDialog] = useState(false);

//   useEffect(() => {
//     const fetchUser = async () => {
//       try {
//         const response = await axios.get<User>(
//           `${import.meta.env.VITE_APP_API_URL}/users/${id}`
//         );
//         setUser(response.data);
//       } catch (error) {
//         console.error("Error fetching user details:", error);
//       }
//     };
//     fetchUser();
//   }, [id]);

//   const deleteUser = async (userId: number) => {
//     try {
//       await axios.delete(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
//       toast.success("User deleted successfully");
//       setShowDeleteDialog(false);
//       navigate("/user-management/users");
//     } catch {
//       toast.error("Delete failed");
//     }
//   };


//   if (!user) {
//     return (
//       <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/20">
//         <div className="text-primary text-black">
//           <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] pb-20">
//       {/* 1. Hero / Header Section */}
//       <div className="relative h-64 w-full bg-gradient-to-r overflow-hidden">
//         <div className="container mx-auto px-6 pt-10 relative">
//           <button
//             onClick={() => navigate(-1)}
//             className="flex items-center gap-2  hover:text-gray-700 text-gray-600 font-medium mb-6 transition-transform duration-200 hover:-translate-x-1"
//           >
//             <KeenIcon icon="arrow-left" className="text-xl" /> Back to Directory
//           </button>
//         </div>
//       </div>

//       <div className="container mx-auto px-6 -mt-32 relative ">
//         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

//           {/* Left Column: The Profile Hub */}
//           <div className="lg:col-span-4">
//             <div className="bg-white dark:bg-[#121214] rounded-3xl shadow-xl shadow-blue-500/5 border border-white dark:border-white/5 p-8 transition-all hover:shadow-2xl">
//               <div className="flex flex-col items-center w-full">

//                 {/* AVATAR + INFO ROW */}
//                 <div className="flex items-center gap-6 w-full justify-center md:justify-start">
//                   <div className="flex items-center w-full gap-6">

//                     <div className="relative shrink-0">
//                       <div className="h-28 w-28 rounded-full ring-4 ring-white dark:ring-white/10 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-2xl">
//                         <span className="text-5xl font-black text-blue-600">
//                           {user.username?.[0]?.toUpperCase()}
//                         </span>
//                       </div>
//                       <div className="absolute bottom-2 right-2 h-5 w-5 bg-emerald-500 border-4 border-white dark:border-[#121214] rounded-full" />
//                     </div>

//                     <div className="flex-1 flex justify-end">
//                       <div className="text-right">
//                         <h3 className="font-black text-xl tracking-tight">
//                           {user.username}
//                         </h3>

//                         <p className="text-sm font-medium text-slate-500">
//                           {user.email}
//                         </p>

//                         <div className="mt-2">
//                           <span className="inline-block bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-500/20">
//                             {user.role}
//                           </span>
//                         </div>
//                       </div>
//                     </div>

//                   </div>

//                 </div>

//                 {/* ACTION BUTTONS */}
//                 <div className="grid grid-cols-2 gap-4 w-full mt-8">
//                   <button
//                     onClick={() => navigate(`/user/${id}/edit`)}
//                     className="flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-white dark:text-black text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
//                   >
//                     <KeenIcon icon="pencil" /> Edit
//                   </button>

//                   <div>
//                     {!showDeleteDialog ? (
//                       <button
//                         onClick={() => setShowDeleteDialog(true)}
//                         className="w-full py-3 bg-red-600 active:scale-95 hover:scale-[1.02] text-white rounded-2xl font-black hover:bg-red-700 transition-all shadow-xl shadow-red-500/20"
//                       >
//                         <KeenIcon icon="trash" /> Delete Account
//                       </button>
//                     ) : (
//                       <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300 rounded-2xl bg-gray-200 p-2">
//                         <button
//                           onClick={() => setShowDeleteDialog(false)}
//                           className="px-4 py-3 bg-white dark:bg-white/5 border border-red-200 dark:border-red-900/50 rounded-2xl font-bold text-sm"
//                         >
//                           Cancel
//                         </button>
//                         <button
//                           onClick={() => deleteUser(user.id)}
//                           className="px-4 py-3 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-800 transition-all"
//                         >
//                           Confirm
//                         </button>
//                       </div>
//                     )}
//                   </div>
//                 </div>

//                 {/* DELETE WARNING */}
//                 {showDeleteDialog && (
//                   <div className="text-center mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
//                     <p className="text-red-500/70 text-sm font-medium">
//                       Once you delete this user, all associated data will be permanently removed.
//                     </p>
//                   </div>
//                 )}
//               </div>


//               <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5">
//                 <h4 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">Contact Details</h4>
//                 <div className="space-y-6">
//                   <ContactRow icon="phone" label="Phone" value={user.mobile} color="text-purple-500" />
//                   <ContactRow icon="sms" label="Official Email" value={user.email} color="text-blue-500" />
//                   <ContactRow icon="calendar" label="Date Joined" value={user.created_at} color="text-orange-500" />
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Right Column: Information & Activity */}
//           <div className="lg:col-span-8 space-y-8">

//             {/* Quick Stats Grid */}
//             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
//               {/* <StatCard title="Account ID" value={`#${user.id?.slice(0, 8)}`} icon="fingerprint" color="blue" /> */}
//               <StatCard title="Last Login" value="2 hours ago" icon="time" color="emerald" />
//               <StatCard title="Access Level" value={user.role || 'Standard'} icon="shield-search" color="indigo" />
//             </div>

//             {/* Detailed Data Card */}
//             <div className="bg-white dark:bg-[#121214] rounded-3xl shadow-xl shadow-slate-200/50 border border-white dark:border-white/5 overflow-hidden">
//               <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
//                 <div>
//                   <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profile Analytics</h3>
//                   <p className="text-sm text-slate-500">System generated metadata</p>
//                 </div>
//                 <KeenIcon icon="setting-2" className="text-2xl text-slate-400 hover:rotate-90 transition-transform duration-300" />
//               </div>

//               <div className="p-4 px-8">
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
//                   <DataField label="Registered Username" value={user.username} />
//                   <DataField
//                     label="Account Status"
//                     value={user.isActive ? "Active" : "Inactive"}
//                     status={user.isActive ? "success" : "danger"}
//                   />
//                   <DataField label="Account Created At" value={user.created_at} />
//                   <DataField label="Profile Last Updated" value={user.updated_at} />
//                   <DataField label="Created By (User ID)" value={user.created_by} />
//                 </div>
//               </div>
//             </div>

//             {/* Businesses Section with horizontal scroll or grid */}
//             <div className="bg-white dark:bg-[#121214] rounded-3xl p-8 border border-white dark:border-white/5">
//               <div className="flex items-center justify-between mb-6">
//                 <h3 className="text-xl font-bold">Associated Businesses</h3>
//                 <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400">
//                   {user.businesses?.length || 0} Total
//                 </span>
//               </div>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {user.businesses?.map((b) => (
//                   <div key={b.id} className="p-5 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/5 flex items-center gap-4 hover:border-blue-400 transition-colors group">
//                     <div className="h-12 w-12 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
//                       <KeenIcon icon="shop" className="text-2xl" />
//                     </div>
//                     <div>
//                       <p className="font-bold text-slate-900 dark:text-white">{b.name}</p>
//                       <p className="text-xs text-slate-500">Business Partner</p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// // --- Helper Components for Cleanliness ---

// const ContactRow = ({ icon, label, value, color }: any) => (
//   <div className="flex items-center gap-4 group cursor-pointer">
//     <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-white/5 transition-colors group-hover:bg-white group-hover:shadow-md ${color}`}>
//       <KeenIcon icon={icon} className="text-xl" />
//     </div>
//     <div>
//       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
//       <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{value || '--'}</p>
//     </div>
//   </div>
// );

// const StatCard = ({ title, value, icon, color }: any) => {
//   const colors: any = {
//     blue: "text-blue-600 bg-blue-50 dark:bg-blue-500/10",
//     emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
//     indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
//   };
//   return (
//     <div className="bg-white dark:bg-[#121214] p-6 rounded-3xl border border-white dark:border-white/5 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center group hover:-translate-y-1 transition-all">
//       <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>
//         <KeenIcon icon={icon} className="text-2xl" />
//       </div>
//       <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{title}</p>
//       <p className="text-lg font-black text-slate-900 dark:text-white mt-1 group-hover:text-blue-600 transition-colors">{value}</p>
//     </div>
//   );
// };

// const DataField = ({ label, value, status }: any) => (
//   <div className="relative pb-2 border-b border-slate-50 dark:border-white/5">
//     <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">{label}</p>
//     <div className="flex items-center gap-2">
//       {status === 'success' && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
//       {status === 'danger' && <span className="h-2 w-2 rounded-full bg-red-500" />}
//       <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{value || '--'}</p>
//     </div>
//   </div>
// );

import { useParams, useNavigate } from "react-router-dom";
import { User } from "./user-models";
import { useEffect, useState } from "react";
import axios from "axios";
import { KeenIcon } from '@/components';
import { SpinnerDotted } from 'spinners-react';
import { toast } from "sonner";

export const UserDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [fetchingUser, setFetchingUser] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get<User>(
          `${import.meta.env.VITE_APP_API_URL}/users/${id}`
        );
        setUser(response.data);
      } catch (error: any) {
        console.error("Error fetching user details:", error);
        toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to load user details");
      }
    };
    fetchUser();
  }, [id]);

  const ContactRow = ({ icon, label, value, color }: any) => (
    <div className="flex items-center gap-4 group cursor-pointer">
      <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-white/5 transition-colors group-hover:bg-white group-hover:shadow-md ${color}`}>
        <KeenIcon icon={icon} className="text-xl" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{value || '--'}</p>
      </div>
    </div>
  );

  const deleteUser = async (userId: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
      toast.success("User deleted successfully");
      navigate("/user-management/users");
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || "Delete failed";
      toast.error(errorMessage);
    }
  };
  // Fetch Single User Details
  const fetchUserDetails = async (userId: string) => {
    try {
      setFetchingUser(true);
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
      setSelectedUser(response.data);
      return response.data;
    } catch (error) {
      toast.error("Failed to fetch user details");
      return null;
    } finally {
      setFetchingUser(false);
    }
  };

  // Helper for Name Concatenation
  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'N/A';
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : '?';

  if (!user || fetchingUser) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center text-[#0D0E12]">
        <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 bg-[#F9FAFB] min-h-screen">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">User Details</h1>
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">Home</button>
            <KeenIcon icon="right" className="text-[10px]" />
            <button onClick={() => navigate('/user-management/users')} className="hover:text-blue-600 transition-colors">Users</button>
            <KeenIcon icon="right" className="text-[10px]" />
            <span className="text-gray-900 font-medium">{fullName}</span>
          </nav>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/user/${id}/edit`)}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            <KeenIcon icon="pencil" className="text-sm" /> Edit User
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <div className="flex flex-col items-center text-center pb-8 border-b border-gray-100">
              <div className="h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-2xl font-bold mb-4 border border-blue-100">
                {initials || user.username?.[0].toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{fullName}</h2>
              <p className="text-gray-500 text-sm mb-4">{user.email}</p>

              <span className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="py-8 space-y-6">
              <ContactRow label="Role" value={user.role} icon="shield-tick" color="text-yellow-600" />
              {/* <SidebarInfo label="Mobile" value={user.mobile} icon="phone" />
               <SidebarInfo label="Member Since" value={user.created_at} icon="calendar" /> */}
              <ContactRow icon="phone" label="Phone" value={user.mobile} color="text-purple-500" />
              <ContactRow icon="sms" label="Official Email" value={user.email} color="text-blue-500" />
              <ContactRow icon="calendar" label="Date Joined" value={user.created_at} color="text-orange-500" />
            </div>
          </div>
        </div>

        {/* Right Column: Information Tabs/Sections */}
        <div className="lg:col-span-2 space-y-8">
          {/* General Information Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-gray-900 text-lg">General Information</h3>
              <KeenIcon icon="user" className="text-gray-400 text-xl" />
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <DataField label="Full Name" value={fullName} />
                <DataField label="Username" value={user.username} />
                <DataField label="Email Address" value={user.email} />
                <DataField label="Phone Number" value={user.mobile} />
                <DataField label="Designation" value={user.role} />
                <DataField label="Account Status" value={user.isActive ? "Active" : "Inactive"} status={user.isActive ? "success" : "danger"} />
                <DataField label="Last Updated" value={user.updated_at} />
                <DataField label="Account ID" value={`#${user.id?.toString().slice(0, 8)}...`} />
              </div>
            </div>
          </div>

          {/* Associated Businesses Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Associated Businesses</h3>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">
                {user.businesses?.length || 0} Total
              </span>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.businesses && user.businesses.length > 0 ? (
                  user.businesses.map((b) => (
                    <div key={b.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors group bg-gray-50/30">
                      <div className="h-12 w-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                        <KeenIcon icon="shop" className="text-2xl" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{b.name}</p>
                        <p className="text-xs text-gray-500 uppercase font-medium tracking-tight">Business Partner</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-6">
                    <p className="text-gray-400 text-sm italic">No business records found for this user.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <KeenIcon icon="trash" className="text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete User?</h3>
            <p className="text-gray-500 text-center text-sm mb-8">
              Are you sure you want to delete <span className="font-bold text-gray-800">{fullName}</span>? This process cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(user.id)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
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

// --- Helper Components ---

const SidebarInfo = ({ label, value, icon }: any) => (
  <div className="flex items-center gap-4">
    <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
      <KeenIcon icon={icon} className="text-lg" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-700 truncate">{value || 'Not provided'}</p>
    </div>
  </div>
);

const DataField = ({ label, value, status }: any) => (
  <div className="relative pb-2 border-b border-slate-50 dark:border-white/5">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">{label}</p>
    <div className="flex items-center gap-2">
      {status === 'success' && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
      {status === 'danger' && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{value || '--'}</p>
    </div>
  </div>
);