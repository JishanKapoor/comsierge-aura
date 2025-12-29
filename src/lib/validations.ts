import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").refine(
    (val) => val === "admin" || val === "user" || z.string().email().safeParse(val).success,
    "Please enter a valid email address"
  ),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

export const normalizeUsPhoneDigits = (value: string) => value.replace(/\D/g, "");

// Accepts:
// - 10 digits (e.g. 5551234567)
// - 11 digits starting with 1 (e.g. 15551234567)
// - Any formatting characters, including +1, parentheses, spaces, dashes
export const isValidUsPhoneNumber = (value: string) => {
  const digits = normalizeUsPhoneDigits(value);
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
};

export const toE164UsPhoneNumber = (value: string): string | null => {
  if (!isValidUsPhoneNumber(value)) return null;
  const digits = normalizeUsPhoneDigits(value);
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
};

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
