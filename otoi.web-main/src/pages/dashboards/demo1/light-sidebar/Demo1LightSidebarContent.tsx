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
    <div className="flex flex-col gap-5 lg:gap-7.5">
      {/* Section 1: Header & Alerts */}
      <div className="flex flex-col gap-5 lg:gap-7.5">
        <BusinessOverviewHeader />
        <OverdueAlert />
      </div>

      {/* Section 2: Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
        {/* Stat Cards (3 items) */}
        <StatCards />

        {/* Transactions & Parties */}
        <div className="md:col-span-2 lg:col-span-2">
          <LatestTransactions />
        </div>
        <div className="md:col-span-2 lg:col-span-1">
          <TopParties />
        </div>

        {/* Sales Report */}
        <div className="md:col-span-2 lg:col-span-3">
          <SalesReport />
        </div>
      </div>
    </div>
  );
};

export { Demo1LightSidebarContent };
