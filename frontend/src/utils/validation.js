const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
const hasLetter = /[A-Za-z]/;
const hasNumber = /\d/;

export const validateUsername = (username) => {
  const trimmed = username.trim();
  if (!usernameRegex.test(trimmed)) {
    return "Username must be 3-20 characters and only contain letters, numbers, or underscore.";
  }
  return "";
};

export const validatePasswordForLogin = (password) => {
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return "";
};

export const validatePasswordForSignup = (password) => {
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  if (!hasLetter.test(password) || !hasNumber.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return "";
};
