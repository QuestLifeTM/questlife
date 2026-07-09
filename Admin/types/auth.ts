export type AuthProviderName = "apple" | "google";

export type PasswordRequirement = {
  label: string;
  met: boolean;
};

export type PasswordStrength = {
  label: "Weak" | "Medium" | "Strong";
  progress: number;
  requirements: PasswordRequirement[];
  score: 1 | 2 | 3;
};
