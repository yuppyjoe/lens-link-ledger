import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, Edit, Trash2 } from 'lucide-react';

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
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPayments: 0,
    totalAmount: 0,
    pendingAmount: 0,
    completedAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    booking_id: '',
    amount: '',
    payment_type: 'deposit',
    mpesa_reference: ''
  });

  if (!user || (userRole !== 'admin' && userRole !== 'staff' && userRole !== 'superadmin')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchPayments();
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          hire_start_date,
          hire_end_date,
          total_cost,
          deposit_amount,
          balance_amount,
          profiles:customer_id (
            full_name,
            phone_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

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

  const resetForm = () => {
    setFormData({
      booking_id: '',
      amount: '',
      payment_type: 'deposit',
      mpesa_reference: ''
    });
    setEditingPayment(null);
  };

  const openEditDialog = (payment: Payment) => {
    setFormData({
      booking_id: payment.booking_id,
      amount: payment.amount.toString(),
      payment_type: payment.payment_type,
      mpesa_reference: payment.mpesa_reference
    });
    setEditingPayment(payment);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const paymentData = {
        booking_id: formData.booking_id,
        amount: parseFloat(formData.amount),
        payment_type: formData.payment_type,
        mpesa_reference: formData.mpesa_reference,
        status: 'pending'
      };

      if (editingPayment) {
        const { error } = await supabase
          .from('payments')
          .update(paymentData)
          .eq('id', editingPayment.id);

        if (error) throw error;
        toast({ title: "Success", description: "Payment updated successfully" });
      } else {
        const { error } = await supabase
          .from('payments')
          .insert([paymentData]);

        if (error) throw error;
        toast({ title: "Success", description: "Payment recorded successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save payment",
        variant: "destructive",
      });
    }
  };

  const deletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Payment deleted successfully" });
      fetchPayments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete payment",
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Payment Management</h1>
            <p className="text-sm text-muted-foreground">Track and manage all payments</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPayment ? 'Edit Payment' : 'Record New Payment'}</DialogTitle>
                <DialogDescription>
                  {editingPayment ? 'Update payment details' : 'Record a new payment transaction'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="booking">Booking</Label>
                  <Select
                    value={formData.booking_id}
                    onValueChange={(value) => setFormData({ ...formData, booking_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select booking" />
                    </SelectTrigger>
                    <SelectContent>
                      {bookings.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>
                          {booking.profiles?.full_name} - KES {booking.total_cost?.toLocaleString()} ({new Date(booking.hire_start_date).toLocaleDateString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="type">Payment Type</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="balance">Balance</SelectItem>
                      <SelectItem value="full">Full Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="reference">M-Pesa Reference</Label>
                  <Input
                    id="reference"
                    value={formData.mpesa_reference}
                    onChange={(e) => setFormData({ ...formData, mpesa_reference: e.target.value })}
                    placeholder="e.g. SH12345678"
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full">
                  {editingPayment ? 'Update Payment' : 'Record Payment'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
              <div className="text-2xl font-bold">KES {stats.totalAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All payments combined</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {stats.pendingAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {stats.completedAmount.toLocaleString()}</div>
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
                        <div className="font-medium text-lg">KES {payment.amount.toLocaleString()}</div>
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
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(payment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {userRole === 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deletePayment(payment.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
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