import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Toast from './components/Toast';
import ScrollToTop from './components/ScrollToTop';

import ProductsHome from './screens/products/Home';
import CategoryList from './screens/products/CategoryList';
import ProductDetail from './screens/product/ProductDetail';

import ConfirmationSheet from './screens/purchase/ConfirmationSheet';
import PurchaseSuccess from './screens/purchase/Success';
import PurchaseFailed from './screens/purchase/Failed';
import InsufficientBalance from './screens/purchase/InsufficientBalance';
import PurchaseDetails from './screens/purchase/PurchaseDetails';
import SubscriptionDetails from './screens/purchase/SubscriptionDetails';

import PurchasesHome from './screens/purchases/Home';
import PurchasesSubscriptions from './screens/purchases/Subscriptions';

import BalanceDeposit from './screens/balance/Deposit';
import DepositPayment from './screens/balance/DepositPayment';
import { DepositSuccess, DepositFailed } from './screens/balance/DepositResult';
import BalanceHistory from './screens/balance/History';

import ReferralsHome from './screens/referrals/Home';
import ReferralsAll from './screens/referrals/All';

import ProfileHome from './screens/profile/Home';
import ProfileTerms from './screens/profile/Terms';

import { AdminAuthProvider } from './admin/AdminAuthContext';
import AdminGuard from './admin/components/AdminGuard';
import AdminProductsList from './admin/screens/AdminProductsList';
import AdminProductForm from './admin/screens/AdminProductForm';
import AdminInventory from './admin/screens/AdminInventory';
import AdminStats from './admin/screens/AdminStats';
import AdminCategories from './admin/screens/AdminCategories';

export default function App() {
  return (
    <ThemeProvider>
    <AppProvider>
      <AdminAuthProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/products" replace />} />

        <Route path="/products" element={<ProductsHome />} />
        <Route path="/products/:categoryId" element={<CategoryList />} />
        <Route path="/product/:id" element={<ProductDetail />} />

        <Route path="/purchase/confirm/:id" element={<ConfirmationSheet />} />
        <Route path="/purchase/success" element={<PurchaseSuccess />} />
        <Route path="/purchase/failed" element={<PurchaseFailed />} />
        <Route path="/purchase/insufficient" element={<InsufficientBalance />} />

        <Route path="/purchases" element={<PurchasesHome />} />
        <Route path="/purchases/subscriptions" element={<PurchasesSubscriptions />} />
        <Route path="/purchases/:id" element={<PurchaseDetails />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetails />} />

        <Route path="/balance/deposit" element={<BalanceDeposit />} />
        <Route path="/balance/deposit/payment" element={<DepositPayment />} />
        <Route path="/balance/deposit/success" element={<DepositSuccess />} />
        <Route path="/balance/deposit/failed" element={<DepositFailed />} />
        <Route path="/balance/history" element={<BalanceHistory />} />

        <Route path="/referrals" element={<ReferralsHome />} />
        <Route path="/referrals/all" element={<ReferralsAll />} />

        <Route path="/profile" element={<ProfileHome />} />
        <Route path="/profile/terms" element={<ProfileTerms />} />

        <Route
          path="/admin/products"
          element={
            <AdminGuard>
              <AdminProductsList />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/products/new"
          element={
            <AdminGuard>
              <AdminProductForm />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/products/:id/edit"
          element={
            <AdminGuard>
              <AdminProductForm />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/products/:id/inventory"
          element={
            <AdminGuard>
              <AdminInventory />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/stats"
          element={
            <AdminGuard>
              <AdminStats />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <AdminGuard>
              <AdminCategories />
            </AdminGuard>
          }
        />

        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
      <Toast />
      </AdminAuthProvider>
    </AppProvider>
    </ThemeProvider>
  );
}
