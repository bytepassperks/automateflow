import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ApiKeyManager() {
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const { data } = await api.get('/keys');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name) => {
      const { data } = await api.post('/keys', { name });
      return data;
    },
    onSuccess: (data) => {
      setNewKey(data.apiKey.key);
      setKeyName('');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key created');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create key');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key revoked');
    },
  });

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard');
  };

  return (
    <div>
      {newKey && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-sm font-medium text-green-400 mb-2">New API Key Created</p>
          <p className="text-xs text-gray-400 mb-3">Save this key now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-green-300 font-mono overflow-x-auto">
              {newKey}
            </code>
            <button
              onClick={() => copyKey(newKey)}
              className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-400"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <p className="text-sm text-gray-400">Manage your API keys for programmatic access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors"
        >
          Create New Key
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Key name (e.g., Production API)"
            />
            <button
              onClick={() => keyName && createMutation.mutate(keyName)}
              disabled={!keyName || createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setKeyName(''); }}
              className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Used</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data?.apiKeys?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                    No API keys yet
                  </td>
                </tr>
              ) : (
                data?.apiKeys?.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-800/30">
                    <td className="py-3 px-4 text-sm text-gray-200">{key.name}</td>
                    <td className="py-3 px-4">
                      <code className="text-sm text-gray-400 font-mono">{key.keyPrefix}...</code>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${key.isActive ? 'text-green-400' : 'text-red-400'}`}>
                        {key.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {key.isActive && (
                        <button
                          onClick={() => revokeMutation.mutate(key.id)}
                          className="text-xs text-red-400 hover:text-red-300 font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
