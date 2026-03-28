import { NavLink } from 'react-router-dom';
import {
  GitBranchPlus,
  Play,
  BarChart2,
  Network,
  KeyRound,
  Settings,
  LogOut,
  Zap,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

const navItems = [
  { to: '/workflows',  label: 'Workflows',     Icon: GitBranchPlus },
  { to: '/executions', label: 'Executions',     Icon: Play          },
  { to: '/metrics',    label: 'Metrics',        Icon: BarChart2     },
  { to: '/graph',      label: 'Graph Explorer', Icon: Network       },
];

const adminItems = [
  { to: '/api-keys',  label: 'API Keys',  Icon: KeyRound  },
  { to: '/settings',  label: 'Settings',  Icon: Settings  },
];

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function UserAvatar({ email }: { email: string }) {
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
      {initials}
    </div>
  );
}

export function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const { unread } = useNotifications();

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-gray-900 min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-white tracking-tight">Chronos</span>
          <p className="text-[10px] text-gray-500 truncate max-w-[130px]">{user?.orgId}</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto pt-3 pb-2 space-y-0.5">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-5 my-3 border-t border-gray-800" />
            <p className="px-5 pb-1 text-[10px] font-semibold uppercase text-gray-600 tracking-widest">
              Admin
            </p>
            {adminItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* Notification bell */}
      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          `group flex items-center gap-3 px-3 py-2.5 mx-2 mb-1 rounded-lg text-sm font-medium transition-all ${
            isActive
              ? 'bg-brand-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <div className="relative">
              <Bell size={16} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'} />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            Notifications
          </>
        )}
      </NavLink>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors group">
          {user && <UserAvatar email={user.email} />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300 truncate">{user?.email}</p>
            <p className="text-[10px] text-gray-600 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
