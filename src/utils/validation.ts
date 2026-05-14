export const validateName = (name: string) => {
    if (!name.trim()) return "Name is required";

    if (name.length < 3) return "Name must be at least 3 characters";

    if (!/^[A-Za-z\s]+$/.test(name))
        return "Name can only contain letters";

    return "";
};
export const validateEmail = (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return "Email is required";
    const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!regex.test(trimmedEmail)) return "Enter a valid email address";
    const [localPart, domain] = trimmedEmail.toLowerCase().split('@');
    const isRepeated = /^(.)\1{2,}$/.test(localPart); 
    const commonFakes = ['abc', '123', 'test', 'user', 'admin', 'qwerty'];
    if (isRepeated || commonFakes.includes(localPart)) {
        return "Please enter a proper email, not a random sequence";
    }
    const forbiddenDomains = [
        'test.com', 'example.com', 'mailinator.com', 'tempmail.org', 
        'abc.com', 'aaa.com', 'xyz.com'
    ];
    if (forbiddenDomains.includes(domain)) {
        return "Please use a permanent email address";
    }
    return "";
};
export const validateLoginEmail = (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return "Email is required";
    return "";
};

export const validatePhone = (phone: string) => {
    const trimmed = phone.trim();
    if (!trimmed) return "Phone number is required";
    let cleaned = trimmed.replace(/(?!^\+)\D/g, "");
    if (cleaned.startsWith("00")) {
        cleaned = `+${cleaned.slice(2)}`;
    }
    const internationalRegex = /^\+[1-9]\d{9,14}$/;
    if (!cleaned.startsWith("+")) {
        return "International prefix (+ or 00) is required";
    }
    if (cleaned.length < 11) {
        return "Phone number is too short";
    }
    if (cleaned.length > 16) {
        return "Phone number exceeds maximum length (15 digits)";
    }
    if (!internationalRegex.test(cleaned)) {
        return "Enter a valid international number (e.g. +923436173864)";
    }
    return "";
};

export const validatePassword = (password: string) => {
    if (!password) return ["Password is required"];
    const errors: string[] = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("One number");
    if (!/[!@#$%^&*]/.test(password)) errors.push("One special character");

    return errors;
};

export const validateConfirmPassword = (
    password: string,
    confirmPassword: string
) => {
    if (!confirmPassword) return "Confirm your password";
    if (password !== confirmPassword)
        return "Passwords do not match";
    return "";
};
export const validateLoginPassword = (password: string): string => {
  if (!password) return "Password is required";
//   if (password.length < 6) return "Password must be at least 6 characters";
  return "";
};