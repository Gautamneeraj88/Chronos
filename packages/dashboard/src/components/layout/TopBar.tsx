import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Segment { label: string; to?: string; }

function buildCrumbs(pathname: string): Segment[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Dashboard' }];

  const labels: Record<string, string> = {
    workflows:     'Workflows',
    executions:    'Executions',
    metrics:       'Metrics',
    graph:         'Graph Explorer',
    'api-keys':    'API Keys',
    settings:      'Settings',
    notifications: 'Notifications',
    new:           'New',
  };

  return parts.map((part, i) => {
    const to = '/' + parts.slice(0, i + 1).join('/');
    const isId = part.length > 20 || /^[0-9a-f-]{8,}$/i.test(part);
    const label = isId ? part.slice(0, 8) + '…' : (labels[part] ?? part);
    return i < parts.length - 1 ? { label, to } : { label };
  });
}

export function TopBar() {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-1 shrink-0">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-gray-800">{crumb.label}</span>
          )}
        </span>
      ))}
    </header>
  );
}
