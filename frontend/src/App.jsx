import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Lend from "./pages/Lend";
import Borrow from "./pages/Borrow";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import LandingPage from "./pages/LandingPage";
import SignIn from "./pages/SignIn";
import Signup from "./pages/Signup";
import HowItWorks from "./pages/HowItWorks";
import LivenessVerification from "./pages/LivenessVerification";
import { useAuth } from "./context/AuthContext";
import { useAccount } from "wagmi";
import { checkIdentityOwnership } from "./blockchainService";
import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import SupportBot from "./components/SupportBot";

const ProtectedRoute = ({
  children,
  loading,
  isAuthenticated,
  walletConnected,
}) => {
  const isOnboarded = localStorage.getItem("isOnboarded") === "true";

  console.log("--- ProtectedRoute Debug ---");
  console.log("Wallet Connected:", walletConnected);
  console.log("Authenticated:", isAuthenticated);
  console.log("Onboarded:", isOnboarded);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex justify-center items-center text-text-primary font-medium">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-fintech-accent border-t-transparent rounded-full animate-spin"></div>
          <span className="animate-pulse tracking-widest uppercase text-xs font-bold text-text-secondary0 text-center">
            Protocol Synchronizing...
          </span>
        </div>
      </div>
    );
  }

  // 1. If not authenticated, always go to signin
  if (!isAuthenticated) return <Navigate to="/signin" replace />;

  // 2. If authenticated but not onboarded, go to onboarding
  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  // 3. Fully authorized
  return <Layout>{children}</Layout>;
};

function App() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isConnected: walletConnected } = useAccount();
  const [appLoading, setAppLoading] = useState(true);

  // Helper to determine if user is fully onboarded
  const isOnboarded = localStorage.getItem("isOnboarded") === "true";

  useEffect(() => {
    console.log("--- App State Refresh ---");
    console.log("Wallet Connected:", walletConnected);
    console.log("Authenticated:", isAuthenticated);
    console.log("Onboarded:", isOnboarded);

    // Just a small delay to ensure auth state is settled
    const timer = setTimeout(() => {
      setAppLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, walletConnected, isOnboarded]);

  const combinedLoading = authLoading || appLoading;

  return (
    <Router>
      <div className="min-h-screen bg-bg-primary">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <LandingPage />
              </>
            }
          />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<Signup />} />

          {/* Steps & Onboarding */}
          <Route
            path="/onboarding"
            element={
              combinedLoading ? (
                <div className="min-h-screen bg-card-bg flex justify-center items-center text-text-primary">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-fintech-accent border-t-transparent rounded-full animate-spin"></div>
                    <span className="animate-pulse tracking-widest uppercase text-xs font-bold text-text-secondary0">Protocol Synchronizing...</span>
                  </div>
                </div>
              ) : isAuthenticated ? (
                isOnboarded ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Onboarding />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          {/* Protected Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                isAuthenticated={isAuthenticated}
                walletConnected={walletConnected}
                loading={combinedLoading}
              >
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <ProtectedRoute
                isAuthenticated={isAuthenticated}
                walletConnected={walletConnected}
                loading={combinedLoading}
              >
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lend"
            element={
              <ProtectedRoute
                isAuthenticated={isAuthenticated}
                walletConnected={walletConnected}
                loading={combinedLoading}
              >
                <Lend />
              </ProtectedRoute>
            }
          />
          <Route
            path="/borrow"
            element={
              <ProtectedRoute
                isAuthenticated={isAuthenticated}
                walletConnected={walletConnected}
                loading={combinedLoading}
              >
                <Borrow />
              </ProtectedRoute>
            }
          />

          <Route
            path="/how-it-works"
            element={
              <ProtectedRoute
                isAuthenticated={isAuthenticated}
                walletConnected={walletConnected}
                loading={combinedLoading}
              >
                <HowItWorks />
              </ProtectedRoute>
            }
          />

          <Route
            path="/liveness"
            element={
              <ProtectedRoute
                isAuthenticated={isAuthenticated}
                walletConnected={walletConnected}
                loading={combinedLoading}
              >
                <LivenessVerification />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SupportBot />
      </div>
    </Router>
  );
}

export default App;