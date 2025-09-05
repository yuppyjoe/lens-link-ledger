import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Calendar, Package } from 'lucide-react';

interface Booking {
  id: string;
  hire_start_date: string;
  hire_end_date: string;
  total_cost: number;
  deposit_amount: number;
  balance_amount: number;
  status: string;
  payment_status: string;
  mpesa_reference?: string;
  created_at: string;
  booking_items: {
    quantity: number;
    daily_rate: number;
    total_amount: number;
    inventory_items: {
      name: string;
      category: string;
    };
  }[];
}

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_items (
            quantity,
            daily_rate,
            total_amount,
            inventory_items (
              name,
              category
            )
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch your bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return { variant: 'default' as const, label: 'Confirmed' };
      case 'pending': return { variant: 'secondary' as const, label: 'Pending' };
      case 'completed': return { variant: 'outline' as const, label: 'Completed' };
      case 'cancelled': return { variant: 'destructive' as const, label: 'Cancelled' };
      default: return { variant: 'outline' as const, label: status };
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid': return { variant: 'default' as const, label: 'Paid' };
      case 'partial': return { variant: 'secondary' as const, label: 'Partial' };
      case 'unpaid': return { variant: 'destructive' as const, label: 'Unpaid' };
      default: return { variant: 'outline' as const, label: status };
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
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
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-sm text-muted-foreground">View and track all your equipment bookings</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bookings.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'confirmed').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KES {bookings.reduce((sum, b) => sum + b.total_cost, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KES {bookings
                  .filter(b => b.payment_status !== 'paid')
                  .reduce((sum, b) => sum + b.balance_amount, 0)
                  .toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No bookings yet</h3>
              <p className="text-muted-foreground mb-6">Start by browsing our equipment and making your first booking.</p>
              <Button onClick={() => navigate('/equipment')}>
                <Calendar className="mr-2 h-4 w-4" />
                Browse Equipment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const statusBadge = getStatusBadge(booking.status);
              const paymentBadge = getPaymentBadge(booking.payment_status);
              const days = calculateDays(booking.hire_start_date, booking.hire_end_date);
              
              return (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Booking #{booking.id.slice(0, 8)}
                          <Badge variant={statusBadge.variant}>
                            {statusBadge.label}
                          </Badge>
                          <Badge variant={paymentBadge.variant}>
                            {paymentBadge.label}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Booked on {new Date(booking.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">KES {booking.total_cost.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">{days} day{days !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Booking Details */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">Rental Period</h4>
                        <p className="text-sm">
                          <strong>From:</strong> {new Date(booking.hire_start_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm">
                          <strong>To:</strong> {new Date(booking.hire_end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Payment Details</h4>
                        <p className="text-sm">
                          <strong>Deposit:</strong> KES {booking.deposit_amount.toLocaleString()}
                        </p>
                        <p className="text-sm">
                          <strong>Balance:</strong> KES {booking.balance_amount.toLocaleString()}
                        </p>
                        {booking.mpesa_reference && (
                          <p className="text-sm">
                            <strong>M-Pesa Ref:</strong> {booking.mpesa_reference}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Equipment Items */}
                    <div>
                      <h4 className="font-medium mb-2">Equipment</h4>
                      <div className="space-y-2">
                        {booking.booking_items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{item.inventory_items.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.inventory_items.category} • Qty: {item.quantity} • KES {item.daily_rate}/day
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">KES {item.total_amount.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}