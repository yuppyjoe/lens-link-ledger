import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  payment_type: string;
  mpesa_reference: string;
  status: string;
  created_at: string;
  bookings?: {
    hire_start_date: string;
    hire_end_date: string;
    total_cost: number;
  };
}

interface PaymentStats {
  totalPaid: number;
  totalPending: number;
  totalPayments: number;
  averagePayment: number;
}

export default function PaymentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPaid: 0,
    totalPending: 0,
    totalPayments: 0,
    averagePayment: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      // First get all bookings for this user
      const { data: userBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, hire_start_date, hire_end_date, total_cost')
        .eq('customer_id', user.id);

      if (bookingsError) throw bookingsError;

      if (!userBookings || userBookings.length === 0) {
        setLoading(false);
        return;
      }

      const bookingIds = userBookings.map(b => b.id);

      // Get payments for user's bookings
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Combine payment data with booking details
      const paymentsWithBookings = (paymentsData || []).map(payment => ({
        ...payment,
        bookings: userBookings.find(b => b.id === payment.booking_id)
      }));

      setPayments(paymentsWithBookings);

      // Calculate stats
      const totalPaid = paymentsData
        ?.filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      
      const totalPending = paymentsData
        ?.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      
      const totalPayments = paymentsData?.length || 0;
      const averagePayment = totalPayments > 0 ? (totalPaid + totalPending) / totalPayments : 0;

      setStats({
        totalPaid,
        totalPending,
        totalPayments,
        averagePayment
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch payment history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return { variant: 'default' as const, label: 'Completed' };
      case 'pending': return { variant: 'secondary' as const, label: 'Pending' };
      case 'failed': return { variant: 'destructive' as const, label: 'Failed' };
      default: return { variant: 'outline' as const, label: status };
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit': return { variant: 'secondary' as const, label: 'Deposit' };
      case 'balance': return { variant: 'default' as const, label: 'Balance' };
      case 'full': return { variant: 'outline' as const, label: 'Full Payment' };
      default: return { variant: 'outline' as const, label: type };
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-2xl font-bold">Payment History</h1>
          <p className="text-sm text-muted-foreground">View all your payment transactions</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Payment Statistics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {stats.totalPaid.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Successfully processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {stats.totalPending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPayments}</div>
              <p className="text-xs text-muted-foreground">All time payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Payment</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {Math.round(stats.averagePayment).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Per transaction</p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Transactions</CardTitle>
            <CardDescription>Complete history of your payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No payments yet</h3>
                <p className="text-muted-foreground mb-6">Your payment history will appear here once you make your first booking.</p>
                <Button onClick={() => navigate('/new-booking')}>
                  Make a Booking
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>M-Pesa Reference</TableHead>
                      <TableHead>Booking Period</TableHead>
                      <TableHead>Booking Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const statusBadge = getStatusBadge(payment.status);
                      const typeBadge = getPaymentTypeBadge(payment.payment_type);
                      
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(payment.created_at).toLocaleDateString()}
                              <div className="text-xs text-muted-foreground">
                                {new Date(payment.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-lg">
                              KES {payment.amount.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={typeBadge.variant}>
                              {typeBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadge.variant}>
                              {statusBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {payment.mpesa_reference}
                            </span>
                          </TableCell>
                          <TableCell>
                            {payment.bookings && (
                              <div className="text-sm">
                                <div>
                                  {new Date(payment.bookings.hire_start_date).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  to {new Date(payment.bookings.hire_end_date).toLocaleDateString()}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              KES {payment.bookings?.total_cost.toLocaleString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}