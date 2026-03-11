import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import BookingPage from "./pages/BookingPage";

const normalizePathname = (pathname) => {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
};

const getAuthViewFromPathname = (pathname) => {
  const normalizedPathname = normalizePathname(pathname);
  return normalizedPathname === "/signup" ? "signup" : "login";
};

export default function App() {
  const token = useSelector((state) => state.auth.token);
  const [authView, setAuthView] = useState(() =>
    typeof window !== "undefined" ? getAuthViewFromPathname(window.location.pathname) : "login"
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncAuthRoute = () => {
      const currentPath = normalizePathname(window.location.pathname);

      if (token) {
        if (currentPath === "/" || currentPath === "/login" || currentPath === "/signup") {
          window.history.replaceState({}, "", "/dashboard");
        }
        return;
      }

      const nextAuthView = getAuthViewFromPathname(currentPath);
      if (nextAuthView !== authView) {
        setAuthView(nextAuthView);
      }
      const targetPath = nextAuthView === "signup" ? "/signup" : "/login";
      if (currentPath !== targetPath) {
        window.history.replaceState({}, "", targetPath);
      }
    };

    syncAuthRoute();
    window.addEventListener("popstate", syncAuthRoute);
    return () => window.removeEventListener("popstate", syncAuthRoute);
  }, [authView, token]);

  if (token) {
    return (
      <main className="app-container app-container--workspace">
        <BookingPage />
      </main>
    );
  }

  return (
    <main className="app-container">
      {authView === "login" ? (
        <LoginPage
          onSwitchToSignup={() => {
            setAuthView("signup");
            if (typeof window !== "undefined") {
              window.history.pushState({}, "", "/signup");
            }
          }}
        />
      ) : (
        <SignupPage
          onSwitchToLogin={() => {
            setAuthView("login");
            if (typeof window !== "undefined") {
              window.history.pushState({}, "", "/login");
            }
          }}
        />
      )}
    </main>
  );
}
