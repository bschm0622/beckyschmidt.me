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
    <div className="bg-surface border border-muted rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Select Branch</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-sm text-primary hover:text-opacity-80 transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'New Branch'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      {/* Create Branch Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateBranch} className="mb-4 p-4 bg-background border border-muted rounded-md">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New Branch Name
              </label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/my-new-post"
                className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isCreatingBranch || !newBranchName.trim()}
                className="bg-primary text-white px-3 py-1 rounded text-sm hover:opacity-80 disabled:opacity-50 transition-opacity"
              >
                {isCreatingBranch ? 'Creating...' : 'Create Branch'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewBranchName('');
                }}
                className="px-3 py-1 text-tertiary hover:text-foreground transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Branch Selection */}
      {isLoading ? (
        <div className="text-center py-4 text-tertiary">
          Loading branches...
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map((branch) => (
            <button
              key={branch.name}
              onClick={() => onBranchSelect(branch.name)}
              className={`w-full text-left p-3 rounded-md transition-colors ${
                selectedBranch === branch.name
                  ? 'bg-primary text-white'
                  : 'bg-background border border-muted hover:bg-secondary text-foreground'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{branch.name}</div>
                  <div className="text-sm opacity-75">
                    {branch.sha.substring(0, 7)}
                    {isProtectedBranch(branch.name) && ' • Protected'}
                  </div>
                </div>
                {isProtectedBranch(branch.name) && (
                  <div className="text-xs text-orange-500">
                    Protected
                  </div>
                )}
              </div>
            </button>
          ))}

          {selectedBranch && isProtectedBranch(selectedBranch) && (
            <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-md p-3 mt-3">
              <strong>Note:</strong> This is a protected branch. You can view and load posts from it, 
              but you'll need to select or create a feature branch to save changes.
            </div>
          )}
        </div>
      )}

      {branches.length === 0 && !isLoading && (
        <div className="text-center py-8 text-tertiary">
          No branches found. Check your GitHub configuration.
        </div>
      )}
    </div>
  );
}