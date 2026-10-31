"use client";

import type { ReactNode } from "react";
import { BackButton } from "@/components/ui/back-button";

type PageHeaderProps = {
  fallbackHref: string;
  title: string;
  description?: string;
  rightSlot?: ReactNode;
};

export function PageHeader({ fallbackHref, title, description, rightSlot }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <BackButton fallbackHref={fallbackHref} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#191C21]">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-[#646A73]">{description}</p> : null}
        </div>
        {rightSlot}
      </div>
    </header>
  );
}
