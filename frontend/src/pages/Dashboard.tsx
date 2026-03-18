import { useEffect, useState } from 'react';
import { FolderKanban, MessageSquare, CheckCircle, Clock } from 'lucide-react';
import { projectsApi, mentionsApi } from '../services/api';
import type { Mention } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState({
    projects: 0,
    mentions: 0,
    approved: 0,
    pending: 0,
  });
  const [recentMentions, setRecentMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [projectsRes, mentionsRes] = await Promise.all([
        projectsApi.getAll(),
        mentionsApi.getAll(),
      ]);

      const projects = projectsRes.data;
      const mentions = mentionsRes.data;

      setStats({
        projects: projects.length,
        mentions: mentions.length,
        approved: mentions.filter((m: Mention) => m.status === 'approved').length,
        pending: mentions.filter((m: Mention) => m.status === 'pending').length,
      });

      setRecentMentions(mentions.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FolderKanban className="w-5 h-5 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.projects}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Mentions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.mentions}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Mentions */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-4 py-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Recent Mentions</h2>
        </div>
        <div className="divide-y">
          {recentMentions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No mentions yet. Add a source to start collecting.
            </div>
          ) : (
            recentMentions.map((mention) => (
              <div key={mention.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {mention.authorAvatar && (
                      <img
                        src={mention.authorAvatar}
                        alt={mention.authorName}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="text-sm text-gray-900 line-clamp-2">{mention.content}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {mention.authorName} · {mention.platform} ·{' '}
                        {new Date(mention.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      mention.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : mention.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {mention.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
