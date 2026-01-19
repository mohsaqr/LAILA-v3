import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Shield, Calendar, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { usersApi } from '../api/users';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export const Profile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullname: user?.fullname || '',
    email: user?.email || '',
  });

  const updateMutation = useMutation({
    mutationFn: (data: { fullname: string }) => usersApi.updateUser(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleSave = () => {
    if (!formData.fullname.trim()) {
      toast.error('Name is required');
      return;
    }
    updateMutation.mutate({ fullname: formData.fullname });
  };

  const getRoleBadges = () => {
    const badges = [];
    if (user?.isAdmin) badges.push({ label: 'Admin', color: 'bg-red-100 text-red-700' });
    if (user?.isInstructor) badges.push({ label: 'Instructor', color: 'bg-blue-100 text-blue-700' });
    if (!user?.isAdmin && !user?.isInstructor) badges.push({ label: 'Student', color: 'bg-green-100 text-green-700' });
    return badges;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

      <div className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  loading={updateMutation.isPending}
                  icon={<Save className="w-4 h-4" />}
                >
                  Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{user?.fullname}</h3>
                <div className="flex gap-2 mt-1">
                  {getRoleBadges().map(badge => (
                    <span
                      key={badge.label}
                      className={`px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                {isEditing ? (
                  <Input
                    value={formData.fullname}
                    onChange={e => setFormData(f => ({ ...f, fullname: e.target.value }))}
                    placeholder="Full name"
                    className="flex-1"
                  />
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="text-gray-900">{user?.fullname}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-900">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Account Status</p>
                  <p className="text-gray-900">
                    {user?.isConfirmed ? 'Verified' : 'Pending Verification'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="text-gray-900">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500">Last changed: Never</p>
              </div>
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
