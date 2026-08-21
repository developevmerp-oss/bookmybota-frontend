"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import {
  getPhoneValidationError,
  isValidPhone,
  sanitizePhoneInput,
} from "@/lib/validation";

type InputVariant = "light" | "dark" | "input-field";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when validity changes (for disabling submit) */
  onValidChange?: (valid: boolean) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  variant?: InputVariant;
  /** Show error after blur or when showError is true */
  showError?: boolean;
  label?: string;
  labelClassName?: string;
  helperText?: string;
  /** Show phone icon on the left inside the field */
  showIcon?: boolean;
}

const variantClasses: Record<InputVariant, string> = {
  light:
    "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm",
  dark: "input-field",
  "input-field": "input-field",
};

export default function PhoneInput({
  value,
  onChange,
  onValidChange,
  id,
  name,
  required = false,
  disabled = false,
  placeholder = "9876543210",
  className,
  inputClassName,
  variant = "input-field",
  showError: showErrorProp = false,
  label,
  labelClassName,
  helperText,
  showIcon = false,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);
  const error = !value && !required ? null : getPhoneValidationError(value);
  const showError = (touched || showErrorProp) && !!error;

  useEffect(() => {
    const valid = !required && !value ? true : isValidPhone(value);
    onValidChange?.(valid);
  }, [value, required, onValidChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(sanitizePhoneInput(e.target.value));
  };

  const baseInput = inputClassName || variantClasses[variant];
  const errorBorder = showError ? " border-rose-500 focus:border-rose-500 focus:ring-rose-500" : "";
  const iconPad = showIcon && !inputClassName?.includes("pl-") ? " pl-10" : "";

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
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className={showIcon ? "relative" : undefined}>
        {showIcon && (
          <Phone
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        )}
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          pattern="[0-9]*"
          required={required}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`${baseInput}${iconPad}${errorBorder}`}
          maxLength={PHONE_MAX_LENGTH_ATTR}
        />
      </div>
      {helperText && !showError && (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      )}
      {!helperText && !showError && (
        <p className="text-xs text-slate-400 mt-1">9–12 digits, numbers only</p>
      )}
      {showError && (
        <p className="text-xs text-rose-500 font-medium mt-1">{error}</p>
      )}
    </div>
  );
}

const PHONE_MAX_LENGTH_ATTR = 12;

export { sanitizePhoneInput, isValidPhone, getPhoneValidationError };
