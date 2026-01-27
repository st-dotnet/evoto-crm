import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { KeenIcon } from "@/components";
import { SpinnerDotted } from 'spinners-react';

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

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const url = baseUrl.endsWith("/") ? `${baseUrl}customers/${uuid}` : `${baseUrl}/customers/${uuid}`;
        const response = await axios.get<Customer>(url);
        setCustomer(response.data);
      } catch (error) {
        console.error("Error fetching customer details:", error);
      }
    };
    if (uuid) fetchCustomer();
  }, [uuid]);

  if (!customer) return <div className="fixed inset-0 flex items-center justify-center">
    <div className="text-[#0D0E12] dark:text-gray-700">
      <SpinnerDotted color="currentColor" />
    </div>
  </div>;

  return (
    <div className="flex">
      {/* Left Sidebar */}
      <div className="w-96 bg-white shadow-md p-6 overflow-y-auto dark:bg-[#0D0E12]">
        {/* Header */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
            {customer.first_name?.[0] + customer.last_name?.[0] || "C"}
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {customer.first_name || customer.last_name
                ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
                : "--"}
            </h1>
            <p className="text-gray-500">{customer.email || "--"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="notepad-edit" /> Note
          </button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="sms" /> Email
          </button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="call" /> Call
          </button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="note" /> Task
          </button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="calendar" /> Meeting
          </button>
        </div>

        {/* About Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">About this customer</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>Email:</strong> {customer.email || "--"}</p>
            <p><strong>Mobile:</strong> {customer.mobile || "--"}</p>
            <p><strong>GST:</strong> {customer.gst || "--"}</p>
            <p><strong>Status:</strong> {STATUS_LABEL_TO_VALUE[customer.status || ""] ||"--"}</p>
            <p><strong>Person-Type:</strong> {customer.person_type || "--"}</p>
            <p><strong>Created:</strong> {customer.created_at || "--"}</p>
          </div>
        </div>

        {/* Address Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Address</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>Address 1:</strong> {customer.address1 || "--"}</p>
            <p><strong>Address 2:</strong> {customer.address2 || "--"}</p>
            <p><strong>City:</strong> {customer.city || "--"}</p>
            <p><strong>State:</strong> {customer.state || "--"}</p>
            <p><strong>Country:</strong> {customer.country || "--"}</p>
            <p><strong>Pin:</strong> {customer.pin || "--"}</p>
          </div>
        </div>
      </div>

      {/* Right side content */}
      <div className="flex-1 p-6 bg-gray-50 overflow-y-auto dark:bg-[#0D0E12]">
        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "overview"
                ? "border-b-2 border-gray-600 text-gray-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "activities"
                ? "border-b-2 border-gray-600 text-gray-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Activities
          </button>
          <button
            onClick={() => setActiveTab("intelligence")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "intelligence"
                ? "border-b-2 border-gray-600 text-gray-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Intelligence
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div>
            {/* Activity totals */}
            <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Activity totals</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">ORDERS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">PAYMENTS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">SUPPORT TICKETS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>

            {/* Data highlights */}
            <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Data highlights</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">CREATE DATE</p>
                  <p>{customer.created_at || "--"}</p>
                </div>
                <div>
                  <p className="text-gray-500">STATUS</p>
                  <p>{STATUS_LABEL_TO_VALUE[customer.status || ""] ||"--"}</p>
                </div>
                <div>
                  <p className="text-gray-500">LAST ACTIVITY DATE</p>
                  <p className="font-medium">--</p>
                </div>
              </div>
            </div>

            {/* Recent activities */}
            <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Recent activities</h3>
                <button className="text-sm text-gray-600 hover:underline">All time so far</button>
              </div>
              <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500">
                <svg
                  className="w-12 h-12 mb-2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No activities.</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-6 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Contacts</h3>
                <button className="px-3 py-2 border border-gray-700 rounded-lg text-sm hover:bg-gray-100">+ Add</button>
              </div>
              <p className="text-gray-500 mt-2">No contacts linked.</p>
            </div>
          </div>
        )}

        {activeTab === "activities" && (
          <div>
            {/* Search and Filters */}
            <div className="flex items-center justify-between mb-6">
              <input
                type="text"
                placeholder="Search activities"
                className="border rounded-lg px-3 py-2 text-sm w-1/3 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700"
              />
              <button className="px-3 py-2 border border-gray-700 rounded-lg text-sm hover:bg-gray-100">Collapse all</button>
            </div>

            {/* Activity Tabs */}
            <div className="flex gap-6 border-b mb-4 text-sm">
              {["Orders", "Payments", "Support", "Notes", "Calls", "Meetings"].map((tab) => (
                <button
                  key={tab}
                  className="pb-2 font-medium text-gray-600 hover:border-b hover:text-gray-800 border-gray-600"
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <div className="text-gray-500 text-sm">September 2025</div>
              <div className="bg-white shadow rounded-lg p-4 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
                <p className="font-semibold">Customer created</p>
                <p className="text-sm">
                  <span className="font-medium text-gray-600">
                    {`${customer.first_name} ${customer.last_name}`.trim() || "--"}
                  </span>{" "}
                  was added to the system. <span className="text-gray-600 cursor-pointer">View details</span>
                </p>
                <p>{customer.created_at || "--"}</p>
              </div>
              <div className="bg-white shadow rounded-lg p-4 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
                <p className="text-sm">This contact was created from Offline Sources from CRM UI</p>
                <p>{customer.created_at || "--"}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "intelligence" && (
          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#0D0E12] dark:border-2 dark:border-gray-700">
            <p className="text-gray-500">No intelligence data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
