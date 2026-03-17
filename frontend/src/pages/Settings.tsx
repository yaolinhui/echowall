import { useState } from 'react';
import { User } from 'lucide-react';

export function Settings() {
  const [settings, setSettings] = useState({
    name: '',
    email: '',
    notifications: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement save
    alert('Settings saved!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="max-w-2xl bg-white rounded-lg shadow-sm">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Profile</h2>
              <p className="text-sm text-gray-500">Manage your account settings</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="notifications"
                checked={settings.notifications}
                onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="notifications" className="ml-2 block text-sm text-gray-700">
                Enable email notifications for new mentions
              </label>
            </div>
            <div className="pt-4">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
