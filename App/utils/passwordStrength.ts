import { PasswordRequirement, PasswordStrength } from "@/types/auth";

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
    { label: "12 characters", met: password.length >= 12 },
  ];
}

export function getPasswordStrength(password: string): PasswordStrength {
  const requirements = getPasswordRequirements(password);
  const metCount = requirements.filter((item) => item.met).length;
  const hasMinimumLength = password.length >= 8;
  const hasBasics =
    hasMinimumLength &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password);
  const isStrong = hasBasics && /[^A-Za-z0-9]/.test(password) && password.length >= 12;

  if (isStrong) {
    return {
      label: "Strong",
      progress: 1,
      requirements,
      score: 3,
    };
  }

  if (hasBasics) {
    return {
      label: "Medium",
      progress: Math.max(0.66, metCount / requirements.length),
      requirements,
      score: 2,
    };
  }

  return {
    label: "Weak",
    progress: Math.max(0.2, metCount / requirements.length),
    requirements,
    score: 1,
  };
}
