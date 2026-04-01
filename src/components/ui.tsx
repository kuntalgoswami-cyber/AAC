import React from "react";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";

export const Card = ({ className, children, ...props }: any) => (
  <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...props}>
    {children}
  </div>
);

export const Badge = ({ variant = "default", className, children, ...props }: any) => {
  const variants: any = {
    default: "bg-primary text-primary-foreground",
    destructive: "bg-red-500/20 text-red-500 border-red-500/50 border",
    warning: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50 border",
    success: "bg-green-500/20 text-green-500 border-green-500/50 border",
    outline: "border border-input bg-transparent",
  };
  return (
    <div className={cn("inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props}>
      {children}
    </div>
  );
};

export const Button = ({ variant = "default", size = "default", className, ...props }: any) => {
  const variants: any = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
  };
  
  const sizes: any = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-8",
    icon: "h-9 w-9",
  };

  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} 
      {...props} 
    />
  );
};
