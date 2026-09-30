import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors disabled:pointer-events-none", {
  variants: { variant: {
    default: "bg-volt text-white hover:bg-marino",
    outline: "border border-marino/25 bg-white text-marino hover:bg-cielo",
  } },
  defaultVariants: { variant: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button({ className, variant, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
