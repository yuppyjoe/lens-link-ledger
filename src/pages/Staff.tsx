import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

interface StaffMember {
  id: string;
  user_id: string;
  role: 'superadmin' | 'admin' | 'staff' | 'customer';
  created_at: string;
  profiles?: {
    full_name: string;
    phone_number: string;
  } | null;
}

export default function Staff() {
  const { user, userRole } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user || (userRole !== 'admin' && userRole !== 'superadmin')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      // Filter roles based on current user's role
      let roleFilter: ('superadmin' | 'admin' | 'staff' | 'customer')[];
      if (userRole === 'superadmin') {
        roleFilter = ['superadmin', 'admin', 'staff'];
      } else if (userRole === 'admin') {
        roleFilter = ['admin', 'staff'];
      } else {
        roleFilter = [];
      }

      // Get all profiles first with their roles in a single query
      const { data: profilesWithRoles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          app_user_roles!inner (
            id,
            role,
            created_at
          )
        `)
        .in('app_user_roles.role', roleFilter)
        .order('app_user_roles.created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Transform the data to match expected format
      const staffWithProfiles = (profilesWithRoles || []).map((profile: any) => {
        const userRole = profile.app_user_roles[0];
        return {
          id: userRole.id,
          user_id: profile.user_id,
          role: userRole.role,
          created_at: userRole.created_at,
          profiles: {
            full_name: profile.full_name,
            phone_number: profile.phone_number
          }
        };
      });

      setStaff(staffWithProfiles);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast({
        title: "Error",
        description: "Failed to fetch staff members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: 'superadmin' | 'admin' | 'staff' | 'customer') => {
    try {
      const { error } = await supabase
        .from('app_user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      
      fetchStaff();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin': return 'destructive';
      case 'admin': return 'default';
      case 'staff': return 'secondary';
      case 'customer': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Manage staff roles and permissions</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage user roles and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      {member.profiles?.full_name || 'No name provided'}
                    </TableCell>
                    <TableCell>
                      {member.profiles?.phone_number || 'No phone provided'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {/* Prevent superadmin from changing their own role */}
                      {member.user_id === user?.id && member.role === 'superadmin' ? (
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role} (You)
                        </Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(newRole: 'superadmin' | 'admin' | 'staff' | 'customer') => updateRole(member.user_id, newRole)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {userRole === 'superadmin' && (
                              <>
                                <SelectItem value="superadmin">Super Admin</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </>
                            )}
                            {userRole === 'admin' && member.role !== 'superadmin' && (
                              <>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}