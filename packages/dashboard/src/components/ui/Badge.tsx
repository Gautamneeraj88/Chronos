import React from 'react';

type Variant = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' | 'orange';

const VARIANTS: Record<Variant, string> = {
  green:  'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  red:    'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  amber:  'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  blue:   'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
  gray:   'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
};

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

const STATUS_VARIANTS: Record<string, Variant> = {
  PENDING:      'gray',
  RUNNING:      'blue',
  COMPLETED:    'green',
  FAILED:       'red',
  COMPENSATING: 'amber',
  COMPENSATED:  'purple',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? 'gray'}>{status}</Badge>;
}
