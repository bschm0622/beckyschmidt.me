import React, { useState, useEffect } from 'react';

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface BranchSelectorProps {
  selectedBranch?: string;
  onBranchSelect: (branch: string) => void;
}

export default function BranchSelector({ selectedBranch, onBranchSelect }: BranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  // Debug logging
  useEffect(() => {
  }, [selectedBranch, branches]);

  const loadBranches = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/github/branches');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load branches');
      }
      setBranches(data.branches);
      
      // Auto-select master branch if no branch is selected
      if (!selectedBranch && data.branches.length > 0) {
        const defaultBranch = data.branches.find((b: Branch) => b.name === 'master') || data.branches[0];
        onBranchSelect(defaultBranch.name);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load branches');
      console.error('Error loading branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setIsCreatingBranch(true);
    setError('');

    try {
      const response = await fetch('/api/github/create-branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchName: newBranchName.trim(),
          fromBranch: 'master',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(`Branch "${newBranchName}" already exists`);
        }
        throw new Error(data.error || 'Failed to create branch');
      }

      // Reload branches and select the new one
      await loadBranches();
      onBranchSelect(newBranchName.trim());
      setNewBranchName('');
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
      console.error('Error creating branch:', err);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const isProtectedBranch = (branchName: string) => {
    const branch = branches.find(b => b.name === branchName);
    return branch?.protected || ['master', 'main'].includes(branchName);
  };

  return (
    <div className="bg-surface border border-muted rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base text-lg font-semibold text-foreground">Branch</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-lg text-primary hover:text-opacity-80 transition-colors px-2 py-1 rounded border border-primary/20 hover:bg-primary/5"
        >
          {showCreateForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
          {error}
        </div>
      )}

      {/* Create Branch Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateBranch} className="mb-3 p-3 bg-background border border-muted rounded">
          <div className="space-y-2">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/my-new-post"
              className="w-full px-2 py-1 bg-background border border-muted rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-md"
              required
            />
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={isCreatingBranch || !newBranchName.trim()}
                className="bg-primary text-white px-2 py-1 rounded text-md hover:opacity-80 disabled:opacity-50 transition-opacity"
              >
                {isCreatingBranch ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewBranchName('');
                }}
                className="px-2 py-1 text-tertiary hover:text-foreground transition-colors text-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Branch Selection */}
      {isLoading ? (
        <div className="text-center py-3 text-tertiary text-md">
          Loading branches...
        </div>
      ) : (
        <div>
          <select
            value={selectedBranch || ''}
            onChange={(e) => onBranchSelect(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-md"
          >
            <option value="" disabled>Select a branch...</option>
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
                {isProtectedBranch(branch.name) ? ' (Protected)' : ''}
                {` • ${branch.sha.substring(0, 7)}`}
              </option>
            ))}
          </select>

          {selectedBranch && isProtectedBranch(selectedBranch) && (
            <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded p-2 mt-2">
              <strong>Note:</strong> Protected branch - create a feature branch to save changes.
            </div>
          )}
        </div>
      )}

      {branches.length === 0 && !isLoading && (
        <div className="text-center py-4 text-tertiary text-sm">
          No branches found. Check your GitHub configuration.
        </div>
      )}
    </div>
  );
}