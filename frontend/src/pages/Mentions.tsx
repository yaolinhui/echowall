import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Star, Filter } from 'lucide-react';
import { mentionsApi } from '../services/api';
import { Mention } from '../types';

export function Mentions() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchMentions();
  }, [filter]);

  const fetchMentions = async () => {
    try {
      const status = filter === 'all' ? undefined : filter;
      const res = await mentionsApi.getAll(undefined, status);
      setMentions(res.data);
    } catch (error) {
      console.error('Failed to fetch mentions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await mentionsApi.update(id, { status });
      fetchMentions();
    } catch (error) {
      console.error('Failed to update mention:', error);
    }
  };

  const handleBulkAction = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      await mentionsApi.bulkUpdate(selectedIds, status);
      setSelectedIds([]);
      fetchMentions();
    } catch (error) {
      console.error('Failed to bulk update:', error);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-100';
      case 'negative':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mentions</h1>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm border-gray-300 rounded-md focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center p-4 space-x-2 bg-primary-50 rounded-lg">
          <span className="text-sm text-primary-700">{selectedIds.length} selected</span>
          <button
            onClick={() => handleBulkAction('approved')}
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={() => handleBulkAction('rejected')}
            className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <div className="divide-y">
          {mentions.map((mention) => (
            <div key={mention.id} className="p-4">
              <div className="flex items-start space-x-4">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(mention.id)}
                  onChange={() => toggleSelection(mention.id)}
                  className="mt-1"
                />
                <div className="flex-1">
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
                        <p className="text-sm text-gray-900">{mention.content}</p>
                        <div className="flex items-center mt-2 space-x-2">
                          <span className="text-xs text-gray-500">
                            {mention.authorName} · {mention.platform}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${getSentimentColor(
                              mention.sentiment
                            )}`}
                          >
                            {mention.sentiment}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleStatusChange(mention.id, 'approved')}
                        className={`p-1 rounded ${
                          mention.status === 'approved'
                            ? 'bg-green-100 text-green-600'
                            : 'text-gray-400 hover:text-green-600'
                        }`}
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(mention.id, 'rejected')}
                        className={`p-1 rounded ${
                          mention.status === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : 'text-gray-400 hover:text-red-600'
                        }`}
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(mention.id, 'featured')}
                        className={`p-1 rounded ${
                          mention.status === 'featured'
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'text-gray-400 hover:text-yellow-600'
                        }`}
                      >
                        <Star className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {mentions.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No mentions found. Add sources to start collecting mentions.
          </div>
        )}
      </div>
    </div>
  );
}
