import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailOnComplete, setEmailOnComplete] = useState(
    user?.notificationPreferences?.emailOnComplete ?? true
  );
  const [emailOnFailure, setEmailOnFailure] = useState(
    user?.notificationPreferences?.emailOnFailure ?? true
  );

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { name, email });
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account preferences</p>
      </div>

      <form onSubmit={handleProfileSave} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <form onSubmit={handlePasswordChange} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Change Password</h2>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Changing...' : 'Change Password'}
        </button>
      </form>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOnComplete}
              onChange={(e) => setEmailOnComplete(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
            />
            <div>
              <span className="text-sm text-gray-200">Email on job completion</span>
              <p className="text-xs text-gray-500">Receive an email when a job completes successfully</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOnFailure}
              onChange={(e) => setEmailOnFailure(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
            />
            <div>
              <span className="text-sm text-gray-200">Email on job failure</span>
              <p className="text-xs text-gray-500">Receive an email when a job fails</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
