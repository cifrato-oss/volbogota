import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type BackButtonProps = {
  href: string;
  children: ReactNode;
};

/** Consistent "back" control rendered as a ghost button with a left arrow. */
export function BackButton({ href, children }: BackButtonProps) {
  return (
    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Button>
  );
}
