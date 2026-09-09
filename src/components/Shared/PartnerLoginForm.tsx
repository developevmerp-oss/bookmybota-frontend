"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";
import { useLoginMutation } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { homePathForRole, type UserRole } from "@/lib/authStorage";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import PasswordInput from "@/components/Shared/PasswordInput";
import { businessLoginSchema, type BusinessLoginValues } from "@/lib/loginFormSchema";
import type { ReactNode } from "react";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500 px-1";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  business_admin: "Dining Admin",
  event_admin: "Event Organizer",
  movie_admin: "Movie Admin",
  venue_admin: "Venue Admin",
  artist_admin: "Artist Admin",
  customer: "Customer",
};

/** Panel photos for the left side of the split login card */
export const PARTNER_LOGIN_IMAGES: Record<Exclude<UserRole, "customer">, string> = {
  movie_admin: "/login/panel-movie.png",
  artist_admin: "/login/panel-artist.png",
  venue_admin: "/login/panel-venue.jpg",
  business_admin: "/login/panel-dining.jpg",
  event_admin: "/login/panel-event.jpg",
  super_admin: "/login/login-admin.png",
};

type PartnerLoginFormProps = {
  expectedRole: Exclude<UserRole, "customer">;
  title: string;
  subtitle: string;
  hint?: ReactNode;
  /** page = light split card; embedded = compact card (modals) */
  variant?: "page" | "embedded";
  showCustomerLink?: boolean;
  registerHref?: string;
  registerPrompt?: string;
  registerLinkText?: string;
  titleId?: string;
  sideImageSrc?: string;
  /** Optional overlay copy on the left photo panel (page variant) */
  sideImageLabel?: string;
  sideImageCaption?: string;
  brandName?: string;
};

function LoginFields({
  form,
  onSubmit,
  isLoading,
  registerHref,
  registerPrompt,
  registerLinkText,
  showCustomerLink,
  hint,
  compact,
  footerBar,
}: {
  form: ReturnType<typeof useForm<BusinessLoginValues>>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isLoading: boolean;
  registerHref?: string;
  registerPrompt: string;
  registerLinkText: string;
  showCustomerLink: boolean;
  hint?: ReactNode;
  compact?: boolean;
  /** Soft footer strip for register / customer links (page variant) */
  footerBar?: boolean;
}) {
  const pill =
    "w-full bg-[#EEF2F7] border border-transparent rounded-full py-3.5 text-sm focus:outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/15 text-slate-800 font-medium transition-all placeholder:text-slate-400";
  const pillErr = "border-rose-300 focus:border-rose-400 focus:ring-rose-200 bg-rose-50/40";

  const footer = registerHref ? (
    <p className={`text-center text-[13px] text-slate-500 ${footerBar ? "" : "mt-6"}`}>
      {registerPrompt}{" "}
      <Link href={registerHref} className="text-primary font-semibold hover:underline">
        {registerLinkText}
      </Link>
    </p>
  ) : showCustomerLink ? (
    <p className={`text-center text-[13px] text-slate-500 ${footerBar ? "" : "mt-6"}`}>
      Customer login?{" "}
      <Link href="/login" className="text-primary font-semibold hover:underline">
        Go to customer login
      </Link>
    </p>
  ) : null;

  return (
    <>
      <form onSubmit={onSubmit} className={compact ? "space-y-4" : "space-y-5"} noValidate>
        <div>
          <label htmlFor="partner-login-email" className="sr-only">
            Email Address
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary z-10" aria-hidden />
            <input
              id="partner-login-email"
              type="email"
              autoFocus
              placeholder="Email Address"
              autoComplete="email"
              className={`${pill} pl-11 pr-4 ${form.formState.errors.email ? pillErr : ""}`}
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email && (
            <p className={fieldErrorClass}>{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="partner-login-password" className="sr-only">
            Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-primary z-10 pointer-events-none"
              aria-hidden
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field }) => (
                <PasswordInput
                  id="partner-login-password"
                  mode="login"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Password"
                  toggleClassName="text-primary hover:text-primary/80"
                  inputClassName={`${pill} pl-11 pr-12 ${
                    form.formState.errors.password ? pillErr : ""
                  }`}
                />
              )}
            />
          </div>
          {form.formState.errors.password && (
            <p className={fieldErrorClass}>{form.formState.errors.password.message}</p>
          )}
          <div className="mt-2.5 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[12px] font-semibold text-primary hover:opacity-80"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:opacity-95 text-primary-foreground rounded-full py-3.5 text-sm font-bold uppercase tracking-wide transition-all shadow-[0_10px_24px_-8px_var(--primary-glow)] cursor-pointer flex justify-center items-center gap-2 disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {hint ? (
        <div className="mt-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
          {hint}
        </div>
      ) : null}

      {footerBar && footer ? (
        <div className="mt-8 -mx-6 sm:-mx-10 lg:-mx-12 xl:-mx-14 px-6 sm:px-10 lg:px-12 xl:px-14 py-4 bg-[#F4F6F9] border-t border-slate-100">
          {footer}
        </div>
      ) : (
        footer
      )}
    </>
  );
}

export default function PartnerLoginForm({
  expectedRole,
  title,
  subtitle,
  hint,
  variant = "page",
  showCustomerLink = true,
  registerHref,
  registerPrompt = "Not registered yet?",
  registerLinkText = "Register here",
  titleId,
  sideImageSrc,
  sideImageLabel,
  sideImageCaption,
  brandName = "BookMyBota",
}: PartnerLoginFormProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const imageSrc = sideImageSrc || PARTNER_LOGIN_IMAGES[expectedRole];
  const isPhoto = /\.(jpe?g|png|webp)$/i.test(imageSrc);

  const form = useForm<BusinessLoginValues>({
    resolver: yupResolver(businessLoginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const data = await login({
        email: values.email.trim(),
        password: values.password,
      }).unwrap();

      if (data.user.role !== expectedRole) {
        toast.error(
          `This account is ${ROLE_LABEL[data.user.role] || data.user.role}. Please use the correct login page.`
        );
        return;
      }

      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event("auth_changed"));
      toast.success(extractApiSuccessMessage(data, "Login successful"));
      router.push(homePathForRole(data.user.role));
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Invalid credentials"));
    }
  });

  const fields = (
    <LoginFields
      form={form}
      onSubmit={onSubmit}
      isLoading={isLoading}
      registerHref={registerHref}
      registerPrompt={registerPrompt}
      registerLinkText={registerLinkText}
      showCustomerLink={showCustomerLink}
      hint={hint}
      compact={variant === "embedded"}
      footerBar={variant === "page"}
    />
  );

  if (variant === "embedded") {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-[#EDEDED] shadow-sm overflow-hidden p-7 sm:p-8">
          <h2 id={titleId} className="text-2xl font-black text-slate-800 mb-1">
            {title}
          </h2>
          <p className="text-sm text-slate-400 font-medium mb-6">{subtitle}</p>
          {fields}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[linear-gradient(165deg,#e8f0f8_0%,#f7fafc_45%,#f3eef8_100%)]">
      <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-5xl rounded-[1.75rem] bg-white shadow-[0_28px_90px_-30px_rgba(15,23,42,0.35)] overflow-hidden border border-white/80">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[min(640px,calc(100vh-7rem))]">
            <div className="relative hidden lg:block bg-[#0b0618] min-h-[560px]">
              <Image
                src={imageSrc}
                alt=""
                fill
                priority
                className={isPhoto ? "object-cover object-center" : "object-contain object-center p-10"}
                sizes="(max-width: 1024px) 0px, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/25" />
              <div className="absolute inset-x-0 bottom-0 p-8 xl:p-10">
                <p className="font-display text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                  {brandName}
                </p>
                {sideImageLabel ? (
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/80">
                    {sideImageLabel}
                  </p>
                ) : null}
                {sideImageCaption ? (
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
                    {sideImageCaption}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col justify-center px-6 pt-10 pb-0 sm:px-10 lg:px-12 xl:px-14 sm:pt-12">
              <div className="lg:hidden mb-7 rounded-2xl overflow-hidden border border-slate-100 bg-[#0b0618]">
                <div className="relative w-full aspect-[16/9]">
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    priority
                    className={isPhoto ? "object-cover" : "object-contain p-4"}
                    sizes="(max-width: 1024px) 90vw, 0px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="font-display text-base font-bold text-white">{brandName}</p>
                    {sideImageLabel ? (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75 mt-0.5">
                        {sideImageLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h1
                  id={titleId}
                  className="text-2xl sm:text-[1.65rem] font-black text-slate-800 tracking-tight"
                >
                  {title}
                </h1>
                <p className="mt-1.5 text-sm text-slate-400 font-medium">{subtitle}</p>
              </div>

              {fields}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
