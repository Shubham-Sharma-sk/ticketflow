import { useState } from "react";
import { useSelector } from "react-redux";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import BookingPage from "./pages/BookingPage";

export default function App() {
  const token = useSelector((state) => state.auth.token);
  const [authView, setAuthView] = useState("login");

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
        <LoginPage onSwitchToSignup={() => setAuthView("signup")} />
      ) : (
        <SignupPage onSwitchToLogin={() => setAuthView("login")} />
      )}
    </main>
  );
}
