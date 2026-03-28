import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Copy, Check } from 'lucide-react';
import { listApiKeys, createApiKey, revokeApiKey } from '../../api/apikeys';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: () => createApiKey(name),
    onSuccess: ({ rawKey: rk }) => {
      setRawKey(rk);
      setName('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err) => {
      toast.error('Failed to create API key', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      setRevokeId(null);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: (err) => {
      toast.error('Failed to revoke key', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">API Keys</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <KeyRound size={14} />
          New API Key
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : keys.length === 0 ? (
        <div className="table-container">
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create an API key to authenticate programmatic access to Chronos."
            action={<Button onClick={() => setCreateOpen(true)}>New API Key</Button>}
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                {['Name', 'Key Prefix', 'Created', 'Last Used', 'Status', ''].map((h) => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium text-gray-900">{k.name}</td>
                  <td className="table-td">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                      chron_live_{k.keyPrefix}…
                    </code>
                  </td>
                  <td className="table-td text-gray-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="table-td text-gray-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="table-td">
                    <Badge variant={k.isActive ? 'green' : 'red'}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                  </td>
                  <td className="table-td text-right">
                    {k.isActive && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRevokeId(k.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen && !rawKey}
        onClose={() => { setCreateOpen(false); setName(''); }}
        title="New API Key"
        description="Give this key a recognisable name. The raw key is shown only once."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            placeholder="e.g. production-worker"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && createMutation.mutate()}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              disabled={!name.trim()}
            >
              Create Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* Show raw key once */}
      <Modal
        open={!!rawKey}
        onClose={() => { setRawKey(null); setCreateOpen(false); }}
        title="API Key Created"
        description="Copy this key now — it won't be shown again."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">⚠</span>
            Store this key securely. Once you close this dialog it cannot be recovered.
          </div>
          <div className="relative bg-gray-950 text-green-400 font-mono text-sm rounded-lg px-4 py-3 break-all pr-10">
            {rawKey}
            <button
              onClick={() => handleCopy(rawKey ?? '')}
              className="absolute top-2.5 right-2.5 text-gray-400 hover:text-white transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <Button onClick={() => { setRawKey(null); setCreateOpen(false); }}>Done</Button>
        </div>
      </Modal>

      {/* Revoke confirmation */}
      <Modal
        open={!!revokeId}
        onClose={() => setRevokeId(null)}
        title="Revoke API Key"
        description="This action cannot be undone. Any service using this key will lose access immediately."
        size="sm"
      >
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setRevokeId(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={revokeMutation.isPending}
            onClick={() => revokeId && revokeMutation.mutate(revokeId)}
          >
            Revoke Key
          </Button>
        </div>
      </Modal>
    </div>
  );
}
