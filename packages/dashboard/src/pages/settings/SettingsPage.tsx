import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, Building2, Webhook, ShieldAlert, Plus, Trash2,
  Monitor, Eye, EyeOff, Copy, Check, ExternalLink,
} from 'lucide-react';
import { listUsers, registerUser, deleteUser } from '../../api/auth';
import { listApiKeys, revokeApiKey } from '../../api/apikeys';
import { listWebhooks, createWebhook, deleteWebhook } from '../../api/webhooks';
import { useAuth } from '../../context/AuthContext';
import {
  useObservability,
  ObservabilityConfig,
  OBS_DEFAULTS,
} from '../../context/ObservabilityContext';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

type Tab = 'org' | 'users' | 'webhooks' | 'observability' | 'danger';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'org',           label: 'Organisation', icon: Building2  },
  { key: 'users',         label: 'Users',        icon: Users      },
  { key: 'webhooks',      label: 'Webhooks',     icon: Webhook    },
  { key: 'observability', label: 'Observability',icon: Monitor    },
  { key: 'danger',        label: 'Danger Zone',  icon: ShieldAlert},
];

const WEBHOOK_EVENTS = ['execution.completed', 'execution.failed', '*'];

// ── Observability tool definitions ───────────────────────────────────────────
interface ToolDef {
  key: keyof ObservabilityConfig;
  label: string;
  hasCredentials: boolean;
  note?: string;
}

const TOOLS: ToolDef[] = [
  {
    key: 'grafana',
    label: 'Grafana',
    hasCredentials: false,
    note: 'Anonymous viewer access is pre-configured — no login required.',
  },
  {
    key: 'prometheus',
    label: 'Prometheus',
    hasCredentials: false,
    note: 'No authentication in development mode.',
  },
  {
    key: 'jaeger',
    label: 'Jaeger',
    hasCredentials: false,
    note: 'No authentication in development mode.',
  },
  {
    key: 'rabbitmq',
    label: 'RabbitMQ Management',
    hasCredentials: true,
  },
  {
    key: 'neo4j',
    label: 'Neo4j Browser',
    hasCredentials: true,
    note: 'Username and password are pre-filled with dev defaults.',
  },
];

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

// ── Observability tab ─────────────────────────────────────────────────────────
function ObservabilityTab() {
  const { config, save, reset } = useObservability();
  const [draft, setDraft] = useState<ObservabilityConfig>(config);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});

  const setField = (tool: keyof ObservabilityConfig, field: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [tool]: { ...prev[tool], [field]: value },
    }));
  };

  const handleSave = () => {
    save(draft);
    toast.success('Observability settings saved');
  };

  const handleReset = () => {
    setDraft(OBS_DEFAULTS);
    reset();
    toast.success('Reset to defaults');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Configure URLs and credentials for external monitoring tools.
        Settings are saved in this browser only — no credentials are sent to the server.
      </p>

      {TOOLS.map(({ key, label, hasCredentials, note }) => {
        const tool = draft[key];
        const saved = config[key];
        return (
          <Card key={key}>
            <CardBody className="flex flex-col gap-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <a
                  href={saved.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  Open <ExternalLink size={11} />
                </a>
              </div>

              {note && (
                <p className="text-xs text-gray-400 -mt-1">{note}</p>
              )}

              {/* URL */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    label="URL"
                    type="url"
                    value={tool.url}
                    onChange={(e) => setField(key, 'url', e.target.value)}
                  />
                </div>
                <div className="mt-5">
                  <CopyButton value={tool.url} />
                </div>
              </div>

              {/* Credentials — only for tools that need them */}
              {hasCredentials && (
                <div className="flex gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        label="Username"
                        value={tool.username ?? ''}
                        onChange={(e) => setField(key, 'username', e.target.value)}
                      />
                    </div>
                    <div className="mt-5">
                      <CopyButton value={tool.username ?? ''} />
                    </div>
                  </div>

                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        label="Password"
                        type={showPass[key] ? 'text' : 'password'}
                        value={tool.password ?? ''}
                        onChange={(e) => setField(key, 'password', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => ({ ...p, [key]: !p[key] }))}
                        className="absolute right-8 bottom-2 text-gray-400 hover:text-gray-600"
                      >
                        {showPass[key] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <div className="mt-5">
                      <CopyButton value={tool.password ?? ''} />
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}

      <div className="flex justify-between items-center pt-1">
        <Button variant="secondary" onClick={handleReset}>
          Reset to defaults
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('org');

  // ── Users ────────────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  const inviteMutation = useMutation({
    mutationFn: () => registerUser(inviteEmail, invitePassword, inviteRole),
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail('');
      setInvitePassword('');
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User invited successfully');
    },
    onError: (err) => {
      toast.error('Failed to invite user', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
    onError: (err) => {
      toast.error('Failed to remove user', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  // ── Webhooks ─────────────────────────────────────────────────────────────
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [whUrl, setWhUrl] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>(['execution.completed', 'execution.failed']);
  const [whSecret, setWhSecret] = useState('');
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);

  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: listWebhooks,
    enabled: tab === 'webhooks',
  });

  const createWebhookMutation = useMutation({
    mutationFn: () => createWebhook({ url: whUrl, events: whEvents, secret: whSecret || undefined }),
    onSuccess: () => {
      setWebhookOpen(false);
      setWhUrl('');
      setWhSecret('');
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook registered');
    },
    onError: (err) => {
      toast.error('Failed to create webhook', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      setDeleteWebhookId(null);
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook removed');
    },
    onError: (err) => {
      toast.error('Failed to remove webhook', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  // ── Danger zone ────────────────────────────────────────────────────────
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
    enabled: tab === 'danger',
  });

  const [confirmRotate, setConfirmRotate] = useState(false);

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const active = apiKeys.filter((k) => k.isActive);
      await Promise.all(active.map((k) => revokeApiKey(k.id)));
    },
    onSuccess: () => {
      setConfirmRotate(false);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('All API keys revoked');
    },
    onError: (err) => {
      toast.error('Failed to revoke keys', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const toggleEvent = (ev: string) => {
    setWhEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h2 className="page-title">Settings</h2>

      {/* Tab bar */}
      <div className="border-b border-gray-200 flex gap-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`tab-btn ${tab === key ? 'active' : ''}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Organisation ──────────────────────────────────────────────────── */}
      {tab === 'org' && (
        <Card>
          <CardHeader>Organisation Info</CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Org ID</label>
              <p className="mt-1.5 text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                {user?.orgId}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
              <p className="mt-1.5 text-sm text-gray-700">{user?.email}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role</label>
              <div className="mt-1.5">
                <Badge variant={user?.role === 'admin' ? 'blue' : 'gray'}>{user?.role}</Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Users ──────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {users.length} user{users.length !== 1 ? 's' : ''} in this org
            </p>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus size={14} />
              Invite User
            </Button>
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr>
                    {['Email', 'Role', 'Joined', ''].map((h) => (
                      <th key={h} className="table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-td text-gray-800">{u.email}</td>
                      <td className="table-td">
                        <Badge variant={u.role === 'admin' ? 'blue' : 'gray'}>{u.role}</Badge>
                      </td>
                      <td className="table-td text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="table-td text-right">
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(u.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={13} />
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Webhooks ──────────────────────────────────────────────────────── */}
      {tab === 'webhooks' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Receive HTTP POST notifications when executions finish.
            </p>
            <Button onClick={() => setWebhookOpen(true)}>
              <Plus size={14} />
              Add Webhook
            </Button>
          </div>

          {webhooksLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : webhooks.length === 0 ? (
            <div className="table-container">
              <EmptyState
                icon={Webhook}
                title="No webhooks configured"
                description="Add a webhook URL to receive real-time execution notifications via HTTP POST."
                action={<Button onClick={() => setWebhookOpen(true)}>Add Webhook</Button>}
              />
            </div>
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr>
                    {['URL', 'Events', 'Failures', 'Status', ''].map((h) => (
                      <th key={h} className="table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {webhooks.map((wh) => (
                    <tr key={wh.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-td font-mono text-xs text-gray-700 max-w-xs truncate">
                        {wh.url}
                      </td>
                      <td className="table-td">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <span key={ev} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="table-td text-gray-500">{wh.failureCount}</td>
                      <td className="table-td">
                        <Badge variant={wh.isActive ? 'green' : 'red'}>
                          {wh.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="table-td text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteWebhookId(wh.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={13} />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Observability ─────────────────────────────────────────────────── */}
      {tab === 'observability' && <ObservabilityTab />}

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      {tab === 'danger' && (
        <Card>
          <CardHeader>
            <span className="text-red-600 flex items-center gap-2">
              <ShieldAlert size={15} /> Danger Zone
            </span>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-xl bg-red-50">
              <div>
                <p className="text-sm font-semibold text-red-800">Revoke all API keys</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Immediately invalidates all active API keys for this organisation.
                  {!keysLoading && ` (${apiKeys.filter((k) => k.isActive).length} active)`}
                </p>
              </div>
              <Button variant="danger" onClick={() => setConfirmRotate(true)} loading={keysLoading}>
                Revoke All
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      <Modal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); }}
        title="Invite User"
        description="They'll be able to log in immediately with these credentials."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <Input label="Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <Input label="Temporary Password" type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button loading={inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
              Invite
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove User" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">Remove this user from the organisation? They will lose access immediately.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={webhookOpen}
        onClose={() => setWebhookOpen(false)}
        title="Register Webhook"
        description="Chronos will POST execution events to this URL."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Endpoint URL"
            type="url"
            placeholder="https://example.com/hooks/chronos"
            value={whUrl}
            onChange={(e) => setWhUrl(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Events</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-mono text-gray-700">{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <Input
            label="Secret (optional)"
            type="password"
            placeholder="Used for X-Chronos-Secret header"
            value={whSecret}
            onChange={(e) => setWhSecret(e.target.value)}
          />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setWebhookOpen(false)}>Cancel</Button>
            <Button
              loading={createWebhookMutation.isPending}
              onClick={() => createWebhookMutation.mutate()}
              disabled={!whUrl.trim() || whEvents.length === 0}
            >
              Save Webhook
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteWebhookId} onClose={() => setDeleteWebhookId(null)} title="Remove Webhook" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">Remove this webhook? No further events will be dispatched to it.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteWebhookId(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteWebhookMutation.isPending}
              onClick={() => deleteWebhookId && deleteWebhookMutation.mutate(deleteWebhookId)}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmRotate} onClose={() => setConfirmRotate(false)} title="Revoke all API keys" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            This will immediately revoke <strong>all active API keys</strong> for this organisation.
            Any services using them will lose access until new keys are issued.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirmRotate(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={revokeAllMutation.isPending}
              onClick={() => revokeAllMutation.mutate()}
            >
              Revoke All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
