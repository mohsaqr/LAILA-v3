import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Edit2,
  Trash2,
  Eye,
  Shield,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { userManagementApi } from '../../api/userManagement';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ManagedUser, UpdateUserData } from '../../types';

export const UsersManagement = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'admin' | 'instructor' | 'student' | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<UpdateUserData>({});

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['managedUsers', page, debouncedSearch, roleFilter, activeFilter],
    queryFn: () =>
      userManagementApi.getUsers(page, 20, {
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        isActive: activeFilter,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['userStats'],
    queryFn: () => userManagementApi.getUserStats(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) =>
      userManagementApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      setIsEditModalOpen(false);
      setSelectedUser(null);
      setEditForm({});
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userManagementApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
  });

  const clearSearch = () => {
    setSearchInput('');
    setDebouncedSearch('');
  };

  const handleEditUser = (user: ManagedUser) => {
    setSelectedUser(user);
    setEditForm({
      fullname: user.fullname,
      email: user.email,
      isActive: user.isActive,
      isInstructor: user.isInstructor,
      isAdmin: user.isAdmin,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({ id: selectedUser.id, data: editForm });
  };

  const handleDeleteClick = (user: ManagedUser) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    deleteUserMutation.mutate(userToDelete.id);
  };

  const getRoleBadges = (user: ManagedUser) => {
    const badges = [];
    if (user.isAdmin) {
      badges.push(
        <span key="admin" className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
          Admin
        </span>
      );
    }
    if (user.isInstructor) {
      badges.push(
        <span key="instructor" className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
          Instructor
        </span>
      );
    }
    if (!user.isAdmin && !user.isInstructor) {
      badges.push(
        <span key="student" className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
          Student
        </span>
      );
    }
    return badges;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error loading users. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600 mt-1">Manage user accounts and roles</p>
        </div>
        <Link to="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardBody className="text-center py-4">
              <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              <p className="text-xs text-gray-500">Total Users</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
              <p className="text-xs text-gray-500">Active</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <ShieldCheck className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.admins}</p>
              <p className="text-xs text-gray-500">Admins</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Shield className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.instructors}</p>
              <p className="text-xs text-gray-500">Instructors</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Users className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.students}</p>
              <p className="text-xs text-gray-500">Students</p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as typeof roleFilter);
                  setPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="instructor">Instructor</option>
                <option value="student">Student</option>
              </select>
              <select
                value={activeFilter === undefined ? '' : activeFilter.toString()}
                onChange={(e) => {
                  setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true');
                  setPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            Users ({data?.pagination.total || 0})
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <Loading text="Loading users..." />
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Enrollments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.fullname}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">{getRoleBadges(user)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            user.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user._count.enrollments}
                        {user._count.taughtCourses > 0 && (
                          <span className="text-xs text-gray-400 ml-2">
                            ({user._count.taughtCourses} teaching)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/users/${user.id}`}>
                            <Button variant="ghost" size="sm" title="View details">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            title="Edit user"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(user)}
                            title="Delete user"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-gray-500">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={page === data.pagination.totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {data?.users.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No users found.
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
          setEditForm({});
        }}
        title={`Edit User: ${selectedUser?.fullname}`}
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={editForm.fullname || ''}
            onChange={(e) => setEditForm({ ...editForm, fullname: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email || ''}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="New Password (leave blank to keep current)"
            type="password"
            value={editForm.password || ''}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value || undefined })}
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.isActive ?? true}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.isInstructor ?? false}
                onChange={(e) => setEditForm({ ...editForm, isInstructor: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Instructor</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.isAdmin ?? false}
                onChange={(e) => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Admin</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete "${userToDelete?.fullname}"? This action cannot be undone and will remove all their enrollments and data.`}
        confirmText="Delete"
        loading={deleteUserMutation.isPending}
      />
    </div>
  );
};
