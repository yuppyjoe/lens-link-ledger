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

interface Booking {
  id: string;
  customer_id: string;
  staff_id?: string;
  hire_start_date: string;
  hire_end_date: string;
  total_cost: number;
  deposit_amount: number;
  balance_amount: number;
  payment_status: string;
  status: string;
  mpesa_reference?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    phone_number: string;
  };
  booking_items?: {
    quantity: number;
    daily_rate: number;
    total_amount: number;
    inventory_items: {
      name: string;
    };
  }[];
}

export default function Bookings() {
  const { user, userRole } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user || (userRole !== 'admin' && userRole !== 'staff')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      // Get bookings first
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Get booking details with customer profiles and items
      const bookingsWithDetails = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          // Get customer profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('user_id', booking.customer_id)
            .single();

          // Get booking items
          const { data: items } = await supabase
            .from('booking_items')
            .select(`
              quantity,
              daily_rate,
              total_amount,
              inventory_items(name)
            `)
            .eq('booking_id', booking.id);

          return {
            ...booking,
            profiles: profile,
            booking_items: items
          };
        })
      );

      setBookings(bookingsWithDetails);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking status updated successfully",
      });
      
      fetchBookings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive",
      });
    }
  };

  const updatePaymentStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment status updated successfully",
      });
      
      fetchBookings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'pending': return 'secondary';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getPaymentBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'partial': return 'secondary';
      case 'unpaid': return 'destructive';
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
          <h1 className="text-2xl font-bold">Bookings Management</h1>
          <p className="text-sm text-muted-foreground">View and manage all equipment bookings</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
            <CardDescription>Manage customer bookings and rental periods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        {booking.profiles?.full_name || 'Unknown Customer'}
                      </TableCell>
                      <TableCell>
                        {booking.profiles?.phone_number || 'No phone'}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm">
                          {booking.booking_items?.map((item, index) => (
                            <div key={index}>
                              {item.inventory_items?.name} (x{item.quantity})
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(booking.hire_start_date).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">
                            to {new Date(booking.hire_end_date).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">${booking.total_cost}</div>
                          <div className="text-muted-foreground">
                            Deposit: ${booking.deposit_amount}
                          </div>
                          <div className="text-muted-foreground">
                            Balance: ${booking.balance_amount}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant={getPaymentBadgeVariant(booking.payment_status)}>
                            {booking.payment_status}
                          </Badge>
                          <Select
                            value={booking.payment_status}
                            onValueChange={(newStatus) => updatePaymentStatus(booking.id, newStatus)}
                          >
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unpaid">Unpaid</SelectItem>
                              <SelectItem value="partial">Partial</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant={getStatusBadgeVariant(booking.status)}>
                            {booking.status}
                          </Badge>
                          <Select
                            value={booking.status}
                            onValueChange={(newStatus) => updateBookingStatus(booking.id, newStatus)}
                          >
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {booking.mpesa_reference && (
                            <div>Ref: {booking.mpesa_reference}</div>
                          )}
                          <div>Created: {new Date(booking.created_at).toLocaleDateString()}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}