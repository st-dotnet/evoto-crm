import { ReactElement, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { DefaultPage, Demo1DarkSidebarPage } from '@/pages/dashboards';
// Lazy loaded components
const ProfileActivityPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileActivityPage })));
const ProfileBloggerPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileBloggerPage })));
const CampaignsCardPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.CampaignsCardPage })));
const CampaignsListPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.CampaignsListPage })));
const ProjectColumn2Page = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProjectColumn2Page })));
const ProjectColumn3Page = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProjectColumn3Page })));
const ProfileCompanyPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileCompanyPage })));
const ProfileCreatorPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileCreatorPage })));
const ProfileCRMPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileCRMPage })));
const ProfileDefaultPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileDefaultPage })));
const ProfileEmptyPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileEmptyPage })));
const ProfileFeedsPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileFeedsPage })));
const ProfileGamerPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileGamerPage })));
const ProfileModalPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileModalPage })));
const ProfileNetworkPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileNetworkPage })));
const ProfileNFTPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileNFTPage })));
const ProfilePlainPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfilePlainPage })));
const ProfileTeamsPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileTeamsPage })));
const ProfileWorksPage = lazy(() => import('@/pages/public-profile').then(module => ({ default: module.ProfileWorksPage })));
// Lazy loaded account pages
const AccountActivityPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountActivityPage })));
const AccountAllowedIPAddressesPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountAllowedIPAddressesPage })));
const AccountApiKeysPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountApiKeysPage })));
const AccountAppearancePage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountAppearancePage })));
const AccountBackupAndRecoveryPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountBackupAndRecoveryPage })));
const AccountBasicPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountBasicPage })));
const AccountCompanyProfilePage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountCompanyProfilePage })));
const AccountCurrentSessionsPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountCurrentSessionsPage })));
const AccountDeviceManagementPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountDeviceManagementPage })));
const AccountEnterprisePage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountEnterprisePage })));
const AccountGetStartedPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountGetStartedPage })));
const AccountHistoryPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountHistoryPage })));
const AccountImportMembersPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountImportMembersPage })));
const AccountIntegrationsPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountIntegrationsPage })));
const AccountInviteAFriendPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountInviteAFriendPage })));
const AccountMembersStarterPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountMembersStarterPage })));
const AccountNotificationsPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountNotificationsPage })));
const AccountOverviewPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountOverviewPage })));
const AccountPermissionsCheckPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountPermissionsCheckPage })));
const AccountPermissionsTogglePage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountPermissionsTogglePage })));
const AccountPlansPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountPlansPage })));
const AccountPrivacySettingsPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountPrivacySettingsPage })));
const AccountRolesPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountRolesPage })));
const AccountSecurityGetStartedPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountSecurityGetStartedPage })));
const AccountSecurityLogPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountSecurityLogPage })));
const AccountSettingsEnterprisePage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountSettingsEnterprisePage })));
const AccountSettingsModalPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountSettingsModalPage })));
const AccountSettingsPlainPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountSettingsPlainPage })));
const AccountSettingsSidebarPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountSettingsSidebarPage })));
const AccountTeamInfoPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountTeamInfoPage })));
const AccountTeamMembersPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountTeamMembersPage })));
const AccountTeamsPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountTeamsPage })));
const AccountTeamsStarterPage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountTeamsStarterPage })));
const AccountUserProfilePage = lazy(() => import('@/pages/account').then(module => ({ default: module.AccountUserProfilePage })));
// Lazy loaded network pages
const NetworkAppRosterPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkAppRosterPage })));
const NetworkMarketAuthorsPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkMarketAuthorsPage })));
const NetworkAuthorPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkAuthorPage })));
const NetworkGetStartedPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkGetStartedPage })));
const NetworkMiniCardsPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkMiniCardsPage })));
const NetworkNFTPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkNFTPage })));
const NetworkSocialPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkSocialPage })));
const NetworkUserCardsTeamCrewPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkUserCardsTeamCrewPage })));
const NetworkSaasUsersPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkSaasUsersPage })));
const NetworkStoreClientsPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkStoreClientsPage })));
const NetworkUserTableTeamCrewPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkUserTableTeamCrewPage })));
const NetworkVisitorsPage = lazy(() => import('@/pages/network').then(module => ({ default: module.NetworkVisitorsPage })));

// Lazy loaded party pages
const LeadsPage = lazy(() => import('@/pages/parties/PartiesLeads').then(module => ({ default: module.LeadsPage })));
const CustomerDetails = lazy(() => import('@/pages/parties/blocks/customers/CustomerDetails').then(module => ({ default: module.CustomerDetails })));
const LeadDetails = lazy(() => import('@/pages/parties/blocks/leads/LeadDetails').then(module => ({ default: module.LeadDetails })));
const PartiesVendorsPage = lazy(() => import('@/pages/parties/blocks/vendors/PartiesVendors').then(module => ({ default: module.PartiesVendorsPage })));
const PartiesCustomersPage = lazy(() => import('@/pages/parties/blocks/customers/PartiesCustomers').then(module => ({ default: module.PartiesCustomersPage })));
import { AuthPage } from '@/auth';
import { RequireAuth } from '@/auth/RequireAuth';
import { Demo1Layout } from '@/layouts/demo1';
import { ErrorsRouting } from '@/errors';
import { CheckRole } from '@/auth/CheckRole';
import {
  AuthenticationWelcomeMessagePage,
  AuthenticationAccountDeactivatedPage,
  AuthenticationGetStartedPage
} from '@/pages/authentication';
// Lazy loaded other pages
const InventoryPage = lazy(() => import('@/pages/items/InventoryPage').then(module => ({ default: module.default })));
const ItemDetailsPage = lazy(() => import('@/pages/items/ItemDetails').then(module => ({ default: module.default })));
const QuotationPage = lazy(() => import('@/pages/quotation/components/QuotationPage').then(module => ({ default: module.default })));
const CreateQuotationPage = lazy(() => import('@/pages/quotation/components/CreateQuotationPage').then(module => ({ default: module.default })));
const QuotationPreviewPage = lazy(() => import('@/pages/quotation/components/QuotationPreviewPage').then(module => ({ default: module.default })));
const UserDetails = lazy(() => import('@/pages/userManagement/UserDetails').then(module => ({ default: module.UserDetails })));
const UserEdit = lazy(() => import('@/pages/userManagement/UserEdit').then(module => ({ default: module.UserEdit })));
const PartiesUsersPage = lazy(() => import('@/pages/userManagement/PartiesUsers').then(module => ({ default: module.PartiesUsersPage })));
const PartiesPurchaseEntry = lazy(() => import('@/pages/Accounting/PartiesPurchaseEntry').then(module => ({ default: module.PartiesPurchaseEntry })));


// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
  </div>
);

const AppRoutingSetup = (): ReactElement => {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route element={<Demo1Layout />}>
          {/* Manager & Admin Routes */}
          <Route element={<CheckRole allowedRoles={['Admin', 'Manager']} />}>
            <Route path="/" element={<DefaultPage />} />
            <Route path="/parties/leads" element={
              <Suspense fallback={<LoadingFallback />}>
                <LeadsPage />
              </Suspense>
            } />
            <Route path="/parties/customers" element={
              <Suspense fallback={<LoadingFallback />}>
                <PartiesCustomersPage />
              </Suspense>
            } />
            <Route path="/parties/vendors" element={
              <Suspense fallback={<LoadingFallback />}>
                <PartiesVendorsPage />
              </Suspense>
            } />
            <Route path="/lead/:uuid" element={
              <Suspense fallback={<LoadingFallback />}>
                <LeadDetails />
              </Suspense>
            } />
            <Route path="/customer/:uuid" element={
              <Suspense fallback={<LoadingFallback />}>
                <CustomerDetails />
              </Suspense>
            } />
            <Route path="/user-management/users" element={
              <Suspense fallback={<LoadingFallback />}>
                <PartiesUsersPage />
              </Suspense>
            } />
            <Route path="/user/:id" element={
              <Suspense fallback={<LoadingFallback />}>
                <UserDetails />
              </Suspense>
            } />
            <Route path="/items/inventory" element={
              <Suspense fallback={<LoadingFallback />}>
                <InventoryPage />
              </Suspense>
            } />
            <Route path="/items/inventory/:itemId" element={
              <Suspense fallback={<LoadingFallback />}>
                <ItemDetailsPage />
              </Suspense>
            } />
            <Route path='/accounting/purchase-entry' element={
              <Suspense fallback={<LoadingFallback />}>
                <PartiesPurchaseEntry />
              </Suspense>
            } />
            {/* Add more Manager/Admin routes here as needed */}
          </Route>

          {/* User & Admin Routes */}
          <Route element={<CheckRole allowedRoles={['Admin', 'User']} />}>
            <Route path="/public-profile/profiles/default" element={<ProfileDefaultPage />} />
            <Route path="/public-profile/profiles/creator" element={<ProfileCreatorPage />} />
            <Route path="/public-profile/profiles/company" element={<ProfileCompanyPage />} />
            <Route path="/public-profile/profiles/nft" element={<ProfileNFTPage />} />
            <Route path="/public-profile/profiles/blogger" element={<ProfileBloggerPage />} />
            <Route path="/public-profile/profiles/crm" element={<ProfileCRMPage />} />
            <Route path="/public-profile/profiles/gamer" element={<ProfileGamerPage />} />
            <Route path="/public-profile/profiles/feeds" element={<ProfileFeedsPage />} />
            <Route path="/public-profile/profiles/plain" element={<ProfilePlainPage />} />
            <Route path="/public-profile/profiles/modal" element={<ProfileModalPage />} />
            <Route path="/public-profile/projects/3-columns" element={<ProjectColumn3Page />} />
            <Route path="/public-profile/projects/2-columns" element={<ProjectColumn2Page />} />
            <Route path="/public-profile/works" element={<ProfileWorksPage />} />
            <Route path="/public-profile/teams" element={<ProfileTeamsPage />} />
            <Route path="/public-profile/network" element={<ProfileNetworkPage />} />
            <Route path="/public-profile/activity" element={<ProfileActivityPage />} />
            <Route path="/public-profile/campaigns/card" element={<CampaignsCardPage />} />
            <Route path="/public-profile/campaigns/list" element={<CampaignsListPage />} />
            <Route path="/public-profile/empty" element={<ProfileEmptyPage />} />

            <Route path="/account/home/get-started" element={<AccountGetStartedPage />} />
            <Route path="/account/home/user-profile" element={<AccountUserProfilePage />} />
            <Route path="/account/home/company-profile" element={<AccountCompanyProfilePage />} />
            <Route path="/account/home/settings-sidebar" element={<AccountSettingsSidebarPage />} />
            <Route
              path="/account/home/settings-enterprise"
              element={<AccountSettingsEnterprisePage />}
            />
            <Route path="/account/home/settings-plain" element={<AccountSettingsPlainPage />} />
            <Route path="/account/home/settings-modal" element={<AccountSettingsModalPage />} />
            <Route path="/account/billing/basic" element={<AccountBasicPage />} />
            <Route path="/account/billing/enterprise" element={<AccountEnterprisePage />} />
            <Route path="/account/billing/plans" element={<AccountPlansPage />} />
            <Route path="/account/billing/history" element={<AccountHistoryPage />} />
            <Route path="/account/security/get-started" element={<AccountSecurityGetStartedPage />} />
            <Route path="/account/security/overview" element={<AccountOverviewPage />} />
            <Route
              path="/account/security/allowed-ip-addresses"
              element={<AccountAllowedIPAddressesPage />}
            />
            <Route
              path="/account/security/privacy-settings"
              element={<AccountPrivacySettingsPage />}
            />
            <Route
              path="/account/security/device-management"
              element={<AccountDeviceManagementPage />}
            />
            <Route
              path="/account/security/backup-and-recovery"
              element={<AccountBackupAndRecoveryPage />}
            />
            <Route
              path="/account/security/current-sessions"
              element={<AccountCurrentSessionsPage />}
            />
            <Route path="/account/security/security-log" element={<AccountSecurityLogPage />} />
            <Route path="/account/members/team-starter" element={<AccountTeamsStarterPage />} />
            <Route path="/account/members/teams" element={<AccountTeamsPage />} />
            <Route path="/account/members/team-info" element={<AccountTeamInfoPage />} />
            <Route path="/account/members/members-starter" element={<AccountMembersStarterPage />} />
            <Route path="/account/members/team-members" element={<AccountTeamMembersPage />} />
            <Route path="/account/members/import-members" element={<AccountImportMembersPage />} />
            <Route path="/account/members/roles" element={<AccountRolesPage />} />
            <Route
              path="/account/members/permissions-toggle"
              element={<AccountPermissionsTogglePage />}
            />
            <Route
              path="/account/members/permissions-check"
              element={<AccountPermissionsCheckPage />}
            />
            <Route path="/account/integrations" element={<AccountIntegrationsPage />} />
            <Route path="/account/notifications" element={<AccountNotificationsPage />} />
            <Route path="/account/api-keys" element={<AccountApiKeysPage />} />
            <Route path="/account/appearance" element={<AccountAppearancePage />} />
            <Route path="/account/invite-a-friend" element={<AccountInviteAFriendPage />} />
            <Route path="/account/activity" element={<AccountActivityPage />} />

            <Route path="/network/get-started" element={<NetworkGetStartedPage />} />
            <Route path="/network/user-cards/mini-cards" element={<NetworkMiniCardsPage />} />
            <Route path="/network/user-cards/team-crew" element={<NetworkUserCardsTeamCrewPage />} />
            <Route path="/network/user-cards/author" element={<NetworkAuthorPage />} />
            <Route path="/network/user-cards/nft" element={<NetworkNFTPage />} />
            <Route path="/network/user-cards/social" element={<NetworkSocialPage />} />
            <Route path="/network/user-table/team-crew" element={<NetworkUserTableTeamCrewPage />} />
            <Route path="/network/user-table/app-roster" element={<NetworkAppRosterPage />} />
            <Route path="/network/user-table/market-authors" element={<NetworkMarketAuthorsPage />} />
            <Route path="/network/user-table/saas-users" element={<NetworkSaasUsersPage />} />
            <Route path="/network/user-table/store-clients" element={<NetworkStoreClientsPage />} />
            <Route path="/network/user-table/visitors" element={<NetworkVisitorsPage />} />
          </Route>

          {/* Admin Only Routes */}
          <Route element={<CheckRole allowedRoles={['Admin']} />}>
            <Route path="/user/:id/edit" element={<UserEdit />} />
          </Route>

          {/* Common Authenticated Routes */}
          <Route path="/dark-sidebar" element={<Demo1DarkSidebarPage />} />
          <Route path="/auth/welcome-message" element={<AuthenticationWelcomeMessagePage />} />
          <Route path="/parties/leads" element={<LeadsPage />} />
          <Route path="/user-management/users" element={<PartiesUsersPage />} />
          <Route path="/parties/customers" element={<PartiesCustomersPage />} />
          <Route path="/parties/vendors" element={<PartiesVendorsPage />} />
          <Route path="/lead/:uuid" element={<LeadDetails />} />
          <Route path="/customer/:uuid" element={<CustomerDetails />} />
          <Route path="/user/:id" element={<UserDetails />} />
          <Route path="/user/:id/edit" element={<UserEdit />} />
          <Route path="/items/inventory" element={<InventoryPage />} />
          <Route path="/items/inventory/:itemId" element={<ItemDetailsPage />} />
          <Route path="/quotes/list" element={<QuotationPage />} />
          <Route path="/quotes/new-quotation" element={<CreateQuotationPage />} />
          <Route path="/quotes/:id" element={<QuotationPreviewPage />} />
          <Route path="/quotes/:id/edit" element={<CreateQuotationPage />} />
          <Route path="/quotes/preview" element={<QuotationPreviewPage />} />

          {/* Invoice Routes */}
          {/* <Route path="/invoices/list" element={<InvoicePage />} />
          <Route path="/invoices" element={<InvoicePage />} /> */}
          <Route path="/invoices/:id" element={<QuotationPreviewPage />} />

          <Route
            path="/auth/account-deactivated"
            element={<AuthenticationAccountDeactivatedPage />}
          />
          <Route path="/authentication/get-started" element={<AuthenticationGetStartedPage />} />
        </Route>
      </Route>
      <Route path="error/*" element={<ErrorsRouting />} />
      <Route path="auth/*" element={<AuthPage />} />
      <Route path="*" element={<Navigate to="/error/404" />} />
    </Routes>
  );
};

export { AppRoutingSetup };
