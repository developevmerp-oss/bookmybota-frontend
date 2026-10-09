"use client";

import Link from "next/link";
import { FileSignature, FileStack, KeyRound, LogOut, User, type LucideIcon } from "lucide-react";

export type PartnerProfileExtraLink = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

type Props = {
  displayName: string;
  email?: string | null;
  initials: string;
  roleLabel: string;
  profileHref: string;
  changePasswordHref: string;
  onLogout: () => void;
  extraLinks?: PartnerProfileExtraLink[];
};

/**
 * Partner header profile control — menu opens on hover (desktop) / focus-within.
 * Matches Super Admin pattern: My Profile, Change Password, Log out.
 */
export default function PartnerProfileHoverMenu({
  displayName,
  email,
  initials,
  roleLabel,
  profileHref,
  changePasswordHref,
  onLogout,
  extraLinks = [],
}: Props) {
  void email;
  return (
    <div className="relative group">
      <button
        type="button"
        className="inline-flex h-8 sm:h-9 items-center gap-1.5 pl-1 pr-2 sm:pr-2.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors relative z-10"
        aria-label={`${displayName} account menu`}
        aria-haspopup="menu"
      >
        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
          {initials}
        </span>
        <span className="hidden sm:block text-left min-w-0 pr-0.5">
          <span className="block text-sm font-medium text-slate-800 truncate max-w-[120px]">
            {displayName}
          </span>
          <span className="block text-[10px] text-slate-500 leading-tight">{roleLabel}</span>
        </span>
      </button>

      <div className="absolute right-0 top-full pt-1 w-52 sm:w-56 z-[60] opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition-all duration-200">
        <div
          role="menu"
          className="rounded-xl border border-rose-100 bg-white shadow-lg py-1.5 overflow-hidden"
        >
          <Link
            href={profileHref}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
          >
            <User size={16} className="text-slate-500" />
            My Profile
          </Link>
          {extraLinks.map((link) => {
            const Icon = link.icon ?? FileSignature;
            return (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
              >
                <Icon size={16} className="text-slate-500" />
                {link.label}
              </Link>
            );
          })}
          <Link
            href={changePasswordHref}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
          >
            <KeyRound size={16} className="text-slate-500" />
            Change Password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-red-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export const ORGANIZER_CONTRACT_PROFILE_LINKS: PartnerProfileExtraLink[] = [
  { href: "/organizer/contracts", label: "Current Contract", icon: FileSignature },
  { href: "/organizer/contracts/history", label: "Old Contracts", icon: FileStack },
];

export const MOVIE_CONTRACT_PROFILE_LINKS: PartnerProfileExtraLink[] = [
  { href: "/movie/contract", label: "Current Contract", icon: FileSignature },
];
