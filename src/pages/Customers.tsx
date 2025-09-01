import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { Eye, Phone, Mail } from 'lucide-react';
import { CreateCustomerDialog } from '@/components/CreateCustomerDialog';

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  id_number: string;
  id_photo_url?: string;
  created_at: string;
  booking_count?: number;
  total_spent?: number;
  last_booking?: string;
  role?: string;
  app_user_roles?: { role: string }[];
}

export default function Customers() {
  const { user, userRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user || (userRole !== 'admin' && userRole !== 'staff' && userRole !== 'superadmin')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Then get all roles to match with profiles
      const { data: userRoles, error: rolesError } = await supabase
        .from('app_user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Create a map of user_id to role for quick lookup
      const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);

      // Then get booking statistics for each person
      const customersWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('total_cost, created_at')
            .eq('customer_id', profile.user_id);

          if (bookingsError) {
            console.error('Error fetching bookings for user:', bookingsError);
            return {
              ...profile,
              booking_count: 0,
              total_spent: 0,
              last_booking: null,
              role: roleMap.get(profile.user_id) || 'customer'
            };
          }

          const booking_count = bookings?.length || 0;
          const total_spent = bookings?.reduce((sum, booking) => sum + Number(booking.total_cost), 0) || 0;
          const last_booking = bookings && bookings.length > 0 
            ? bookings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
            : null;

          return {
            ...profile,
            booking_count,
            total_spent,
            last_booking,
            role: roleMap.get(profile.user_id) || 'customer'
          };
        })
      );

      setCustomers(customersWithStats as Customer[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const promoteCustomer = async (userId: string, newRole: 'admin' | 'staff') => {
    try {
      const { error } = await supabase
        .from('app_user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Customer promoted to ${newRole} successfully`,
      });
      
      fetchCustomers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to promote customer",
        variant: "destructive",
      });
    }
  };

  const getCustomerTypeBadge = (bookingCount: number) => {
    if (bookingCount === 0) return { variant: 'secondary' as const, label: 'New' };
    if (bookingCount < 3) return { variant: 'default' as const, label: 'Regular' };
    if (bookingCount < 10) return { variant: 'outline' as const, label: 'Frequent' };
    return { variant: 'destructive' as const, label: 'VIP' };
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">View and manage all user profiles and history</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.filter(c => c.booking_count === 0).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.filter(c => (c.booking_count || 0) > 0).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.filter(c => (c.booking_count || 0) >= 10).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage all user profiles and view booking history</CardDescription>
            </div>
            <CreateCustomerDialog onCustomerCreated={fetchCustomers} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Last Booking</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const customerType = getCustomerTypeBadge(customer.booking_count || 0);
                  
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="font-medium">{customer.full_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{customer.id_number}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          customer.role === 'superadmin' ? 'destructive' :
                          customer.role === 'admin' ? 'default' :
                          customer.role === 'staff' ? 'secondary' : 'outline'
                        }>
                          {customer.role || 'customer'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customerType.variant}>
                          {customerType.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{customer.booking_count || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">${(customer.total_spent || 0).toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        {customer.last_booking ? (
                          <span className="text-sm">
                            {new Date(customer.last_booking).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {customer.id_photo_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={customer.id_photo_url} target="_blank" rel="noopener noreferrer">
                                ID
                              </a>
                            </Button>
                          )}
                          {/* Only show promotion for customers */}
                          {customer.role === 'customer' && (
                            <Select onValueChange={(newRole: 'admin' | 'staff') => promoteCustomer(customer.user_id, newRole)}>
                              <SelectTrigger className="w-20">
                                <SelectValue placeholder="Promote" />
                              </SelectTrigger>
                              <SelectContent>
                                {userRole === 'superadmin' && (
                                  <>
                                    <SelectItem value="admin">To Admin</SelectItem>
                                    <SelectItem value="staff">To Staff</SelectItem>
                                  </>
                                )}
                                {userRole === 'admin' && (
                                  <SelectItem value="staff">To Staff</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}