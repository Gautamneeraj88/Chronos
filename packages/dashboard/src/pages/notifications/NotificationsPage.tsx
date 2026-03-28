import { Bell, CheckCheck, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsPage() {
  const { notifications, unread, markAllRead, connected } = useNotifications();

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h2 className="page-title">Notifications</h2>
          {unread > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {unread} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-600' : 'text-gray-400'}`}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck size={13} />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="table-container">
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll see execution completions and failures here in real time."
          />
        </div>
      ) : (
        <div className="table-container divide-y divide-gray-100">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  n.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/executions/${n.executionId}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-600 truncate"
                    >
                      {n.executionId.slice(0, 12)}…
                    </Link>
                    <StatusBadge status={n.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    Workflow {n.workflowId.slice(0, 8)}…
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-4">{timeAgo(n.occurredAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
