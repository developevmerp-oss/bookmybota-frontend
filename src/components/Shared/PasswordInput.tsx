"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  isValidPassword,
  PASSWORD_RULES,
} from "@/lib/validation";

type InputVariant = "light" | "dark" | "input-field";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  /** create = show requirements; login = eye only */
  mode?: "create" | "login";
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  variant?: InputVariant;
  showRequirements?: boolean;
  label?: string;
  labelClassName?: string;
  /** Extra left padding when using icon wrapper (e.g. login page) */
  withLeftIcon?: boolean;
}

const variantClasses: Record<InputVariant, string> = {
  light:
    "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-11 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm",
  dark: "input-field pr-11",
  "input-field": "input-field pr-11",
};

export default function PasswordInput({
  value,
  onChange,
  onValidChange,
  mode = "create",
  id,
  name,
  required = false,
  disabled = false,
  placeholder = "Create a password...",
  className,
  inputClassName,
  variant = "input-field",
  showRequirements,
  label,
  labelClassName,
  withLeftIcon = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const isCreate = mode === "create";
  const showReqs = showRequirements ?? isCreate;

  const allValid = isCreate ? isValidPassword(value) : value.length > 0;
  const failedRules = isCreate
    ? PASSWORD_RULES.filter((r) => !r.test(value))
    : [];

  useEffect(() => {
    if (isCreate) {
      onValidChange?.(isValidPassword(value));
    } else {
      onValidChange?.(value.length > 0);
    }
  }, [value, isCreate, onValidChange]);

  const baseInput = inputClassName || variantClasses[variant];
  const pl = withLeftIcon ? " pl-10" : variant === "light" ? "" : "";

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className={
            labelClassName ||
            "block text-sm font-medium text-muted-foreground mb-2"
          }
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`${baseInput}${pl}`}
          autoComplete={isCreate ? "new-password" : "current-password"}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {showReqs && (touched || value.length > 0) && (
        <ul className="mt-2 space-y-1">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return (
              <li
                key={rule.id}
                className={`text-xs ${ok ? "text-emerald-600" : "text-rose-500"}`}
              >
                {ok ? "✓" : "•"} {rule.label}
              </li>
            );
          })}
        </ul>
      )}

      {showReqs && touched && value && failedRules.length > 0 && (
        <p className="text-xs text-rose-500 font-medium mt-1">
          Fix all password requirements above to continue.
        </p>
      )}
    </div>
  );
}

export { isValidPassword };
