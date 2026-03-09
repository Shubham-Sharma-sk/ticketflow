import { useState } from "react";
import { useDispatch } from "react-redux";
import { useRegisterMutation } from "../services/api";
import { setCredentials } from "../features/auth/authSlice";
import AuthShell from "../components/auth/AuthShell";
import { validatePasswordForSignup, validateUsername } from "../utils/validation";

export default function SignupPage({ onSwitchToLogin }) {
  const dispatch = useDispatch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "" });
  const [register, { isLoading }] = useRegisterMutation();

  const validateForm = () => {
    const errors = {
      username: validateUsername(username),
      password: validatePasswordForSignup(password),
    };
    setFieldErrors(errors);
    return !errors.username && !errors.password;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!validateForm()) return;

    try {
      const result = await register({ username: username.trim(), password }).unwrap();
      dispatch(setCredentials(result));
      setUsername("");
      setPassword("");
      setFieldErrors({ username: "", password: "" });
    } catch (apiError) {
      setFormError(apiError?.data?.message || "Authentication failed");
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Create your account">
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <label>
          Username
          <input
            type="text"
            placeholder="e.g. shubham_01"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={validateForm}
            autoComplete="username"
            required
          />
          {fieldErrors.username && <span className="helper error-text">{fieldErrors.username}</span>}
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Min 6 chars (letter + number)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={validateForm}
            autoComplete="new-password"
            required
          />
          {fieldErrors.password && <span className="helper error-text">{fieldErrors.password}</span>}
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Please wait..." : "Register"}
        </button>
      </form>
      {formError && <p className="error-text">{formError}</p>}
      <button className="link-button" onClick={onSwitchToLogin}>
        Already have an account? Login
      </button>
    </AuthShell>
  );
}
