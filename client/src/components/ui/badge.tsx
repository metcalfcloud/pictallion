import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:scale-105',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gradient-to-r from-primary/90 to-blue-500/90 text-primary-foreground shadow-sm hover:shadow-md',
        secondary:
          'border-transparent bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:shadow-sm',
        destructive:
          'border-transparent bg-gradient-to-r from-destructive/90 to-red-500/90 text-destructive-foreground shadow-sm hover:shadow-md',
        outline:
          'text-foreground border-border bg-background/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground',
        success:
          'border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm hover:shadow-md',
        warning:
          'border-transparent bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-sm hover:shadow-md',
        bronze:
          'border-transparent bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-sm hover:shadow-md',
        silver:
          'border-transparent bg-gradient-to-r from-gray-400 to-slate-500 text-white shadow-sm hover:shadow-md',
        gold: 'border-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-sm hover:shadow-md',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
