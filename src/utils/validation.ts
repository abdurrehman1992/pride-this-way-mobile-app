export const validateName = (name: string) => {
    if (!name.trim()) return "Name is required";

    if (name.length < 3) return "Name must be at least 3 characters";

    if (!/^[A-Za-z\s]+$/.test(name))
        return "Name can only contain letters";

    return "";
};

export const validateEmail = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
        return "Email is required";
    }
    const standardStructure = /^[a-z0-9._%+-]+@[a-z0-9.\-]+\.[a-z]{2,6}$/;
    if (!standardStructure.test(trimmedEmail)) {
        return "Enter a valid email address";
    }

    if (trimmedEmail.includes("..")) {
        return "Email cannot contain consecutive dots";
    }

    const [localPart, domain] = trimmedEmail.split("@");
    const domainParts = domain.split(".");
    
    // Emails can only be 2 parts (domain.com) or 3 parts max (domain.co.uk)
    if (domainParts.length < 2 || domainParts.length > 3) {
        return "Enter a valid email domain structure";
    }

    const tld = domainParts[domainParts.length - 1];

    // 2. STRICT PUBLIC DOMAIN VALIDATOR
    if (domain.includes("gmail")) {
        if (domain !== "gmail.com" && domain !== "googlemail.com") {
            return "Invalid Gmail configuration. Did you mean @gmail.com?";
        }
    }
    
    if (domain.includes("yahoo")) {
        // Enforces exact 'yahoo.com' or standard regional variants like 'yahoo.co.uk'
        if (domain !== "yahoo.com" && !(domainParts.length === 3 && domainParts[0] === "yahoo")) {
            return "Invalid Yahoo domain configuration.";
        }
    }

    if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live") || domain.includes("msn")) {
        if (domainParts.length !== 2 || !["outlook", "hotmail", "live", "msn"].includes(domainParts[0])) {
            return "Invalid Microsoft email domain.";
        }
    }

    if (domain.includes("icloud")) {
        if (domain !== "icloud.com") {
            return "Invalid iCloud domain. Did you mean @icloud.com?";
        }
    }

    // 3. GENERIC / CORPORATE DOMAIN STRUCTURAL RULES
    const mainDomain = domainParts[0];
    if (mainDomain.length > 15) {
        return "Invalid domain name length.";
    }

    if (domainParts.length === 3) {
        const subDomain = domainParts[0];
        const validSubdomains = ["mail", "mail2", "apps", "vip", "user", "staff", "student", "edu"];
        
        // If it's a 3-part custom domain and hasn't triggered yahoo/gmail checks, 
        // ensure the subdomain isn't a long keyboard smash.
        if (subDomain.length > 6 && !validSubdomains.includes(subDomain)) {
            return "Unrecognized email routing configuration.";
        }
    }

    // 4. USERNAME PREFIX & DOMAIN KEYBOARD SMASH FILTERS
    if (localPart.length > 30) {
        return "Email prefix is too long";
    }
    if (localPart.length < 2) {
        return "Email prefix is too short";
    }

    // Checking both the local prefix AND the domain chunk for keyboard home-row smashing
    const keyboardSmashes = ["asdf", "adsf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "qwerty", "zxcv", "asfaf", "sfaf"];
    for (const smash of keyboardSmashes) {
        if (localPart.includes(smash) || domainParts[0].includes(smash)) {
            return "Please enter a valid, readable email address";
        }
    }

    if (/^(.)\1{2,}$/.test(localPart)) {
        return "Please enter a proper email address";
    }

    // 5. EXTENSION WHITELIST & BLACKLIST
    const forbiddenDomains = [
        "test.com", "example.com", "mailinator.com", "tempmail.org", 
        "abc.com", "aaa.com", "xyz.com"
    ];
    if (forbiddenDomains.includes(domain)) {
        return "Please use a permanent email address";
    }

    const validTlds = [
        "com", "org", "net", "edu", "gov", "io", "co", "pk", "uk", 
        "us", "ca", "au", "de", "fr", "jp", "in"
    ];
    if (!validTlds.includes(tld)) {
        return "Enter a valid email domain";
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