import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost" | "lightBlue" | "auth" | "profile";

type CommonProps = {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
};
type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

type LinkButtonProps = CommonProps & {
  href: string;
  "aria-label"?: string;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[#A9D8F7] text-[#191C21] border-[#8DC8EE] hover:bg-[#95CDED] active:bg-[#84C1E6] focus-visible:ring-[#2459A9]",
  auth:
    "bg-black text-white border-black hover:bg-[#242424] active:bg-[#333333] focus-visible:ring-black",
  profile:
    "bg-[#FFFFFF] text-[#000000] border-[#D1D5DB] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] focus-visible:ring-[#2459A9]",
  secondary:
    "bg-white text-[#191C21] border-[#C6CBD3] hover:bg-[#F8F9FB] active:bg-[#EEF1F5] focus-visible:ring-[#2459A9]",
  ghost:
    "bg-transparent text-[#191C21] border-transparent hover:bg-[#F3F4F6] active:bg-[#E9EDF2] focus-visible:ring-[#2459A9]",
  lightBlue:
    "bg-[#A9D8F7] text-[#191C21] border-[#8DC8EE] hover:bg-[#95CDED] active:bg-[#84C1E6] focus-visible:ring-[#2459A9]",
};

const baseClass =
  "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function mergedClass(variant: ButtonVariant, className?: string) {
  return `${baseClass} ${variantClass[variant]} ${className ?? ""}`.trim();
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={mergedClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  className,
  children,
  href,
  ...props
}: LinkButtonProps) {
  return (
    <Link href={href} className={mergedClass(variant, className)} {...props}>
      {children}
    </Link>
  );
}
