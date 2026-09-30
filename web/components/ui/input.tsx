import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("mt-2 block h-11 w-full rounded-lg border border-marino/20 bg-white px-3 text-noche placeholder:text-marino/45 focus:border-volt", className)} {...props} />;
}
