import {
  BusinessOverviewHeader,
  LatestTransactions,
  OverdueAlert,
  SalesReport,
  StatCards,
  TopParties,
} from "./blocks";

const Demo1LightSidebarContent = () => {
  return (
    <div className="grid gap-5 lg:gap-7.5">
      {/* Business Overview Header */}
      <BusinessOverviewHeader />

      {/* Overdue Invoice Alert */}
      <OverdueAlert />

      {/* Row 1: Three stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7.5">
        <StatCards />
      </div>

      {/* Row 2: Latest Transactions + Top Parties */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
        <div className="lg:col-span-2">
          <LatestTransactions />
        </div>
        <div className="lg:col-span-1">
          <TopParties />
        </div>
      </div>

      {/* Row 3: Sales Report (full width) */}
      <div className="grid grid-cols-1 gap-5 lg:gap-7.5">
        <SalesReport />
      </div>
    </div>
  );
};

export { Demo1LightSidebarContent };
