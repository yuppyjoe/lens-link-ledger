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
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  payment_type: string;
  mpesa_reference: string;
  status: string;
  created_at: string;
  bookings?: {
    customer_id: string;
    hire_start_date: string;
    hire_end_date: string;
    profiles: {
      full_name: string;
      phone_number: string;
    };
  };
}

interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  pendingAmount: number;
  completedAmount: number;
}

export default function Payments() {
  const { user, userRole } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPayments: 0,
    totalAmount: 0,
    pendingAmount: 0,
    completedAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user || (userRole !== 'admin' && userRole !== 'staff')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      // Get payments first
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Get payment details with booking and customer info
      const paymentsWithDetails = await Promise.all(
        (paymentsData || []).map(async (payment) => {
          // Get booking details
          const { data: booking } = await supabase
            .from('bookings')
            .select('customer_id, hire_start_date, hire_end_date')
            .eq('id', payment.booking_id)
            .single();

          let customerProfile = null;
          if (booking) {
            // Get customer profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', booking.customer_id)
              .single();
            
            customerProfile = profile;
          }

          return {
            ...payment,
            bookings: booking ? {
              ...booking,
              profiles: customerProfile
            } : null
          };
        })
      );

      setPayments(paymentsWithDetails);

      // Calculate stats
      const totalPayments = paymentsData.length;
      const totalAmount = paymentsData.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const pendingAmount = paymentsData
        .filter(p => p.status === 'pending')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const completedAmount = paymentsData
        .filter(p => p.status === 'completed')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      setStats({
        totalPayments,
        totalAmount,
        pendingAmount,
        completedAmount
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (paymentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: newStatus })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment status updated successfully",
      });
      
      fetchPayments();
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
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit': return 'secondary';
      case 'balance': return 'default';
      case 'full': return 'outline';
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
          <h1 className="text-2xl font-bold">Payment Management</h1>
          <p className="text-sm text-muted-foreground">Track and manage all payments</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Payment Statistics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPayments}</div>
              <p className="text-xs text-muted-foreground">All time payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All payments combined</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.pendingAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.completedAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Successfully processed</p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Payments</CardTitle>
            <CardDescription>Track and manage payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>M-Pesa Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Booking Period</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="font-medium">
                          {payment.bookings?.profiles?.full_name || 'Unknown Customer'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {payment.bookings?.profiles?.phone_number || 'No phone'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-lg">${payment.amount}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPaymentTypeBadge(payment.payment_type)}>
                          {payment.payment_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{payment.mpesa_reference}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant={getStatusBadgeVariant(payment.status)}>
                            {payment.status}
                          </Badge>
                          <Select
                            value={payment.status}
                            onValueChange={(newStatus) => updatePaymentStatus(payment.id, newStatus)}
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(payment.created_at).toLocaleDateString()}
                          <div className="text-xs text-muted-foreground">
                            {new Date(payment.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.bookings && (
                          <div className="text-sm">
                            <div>{new Date(payment.bookings.hire_start_date).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground">
                              to {new Date(payment.bookings.hire_end_date).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <div>Payment ID:</div>
                          <div className="font-mono">{payment.id.slice(0, 8)}...</div>
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