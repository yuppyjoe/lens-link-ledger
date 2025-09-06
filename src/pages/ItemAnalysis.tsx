import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, DollarSign, BarChart3 } from 'lucide-react';

interface ItemAnalytics {
  id: string;
  name: string;
  category: string;
  price_per_day: number;
  total_quantity: number;
  created_at: string;
  total_revenue: number;
  total_bookings: number;
  total_days_booked: number;
  average_booking_duration: number;
  utilization_rate: number;
  revenue_per_owned_day: number;
  last_booked: string | null;
}

export default function ItemAnalysis() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<ItemAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!user || (userRole !== 'admin' && userRole !== 'staff')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    if (user && (userRole === 'admin' || userRole === 'staff')) {
      fetchItemAnalytics();
    }
  }, [user, userRole]);

  const fetchItemAnalytics = async () => {
    try {
      // Fetch inventory items with their booking data
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Fetch all booking items with related booking and inventory data
      const { data: bookingItems, error: bookingError } = await supabase
        .from('booking_items')
        .select(`
          *,
          bookings!inner(
            id,
            hire_start_date,
            hire_end_date,
            created_at,
            status
          ),
          inventory_items!inner(
            id,
            name,
            price_per_day
          )
        `);

      if (bookingError) throw bookingError;

      // Calculate analytics for each item
      const itemAnalytics: ItemAnalytics[] = items?.map(item => {
        const itemBookings = bookingItems?.filter(bi => bi.item_id === item.id) || [];
        
        const totalRevenue = itemBookings.reduce((sum, bi) => sum + (bi.total_amount || 0), 0);
        const totalBookings = itemBookings.length;
        
        // Calculate total days booked and average duration
        const bookingStats = itemBookings.reduce((acc, bi) => {
          const startDate = new Date(bi.bookings.hire_start_date);
          const endDate = new Date(bi.bookings.hire_end_date);
          const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
          
          return {
            totalDays: acc.totalDays + duration,
            totalDuration: acc.totalDuration + duration
          };
        }, { totalDays: 0, totalDuration: 0 });

        const averageBookingDuration = totalBookings > 0 ? bookingStats.totalDuration / totalBookings : 0;
        
        // Calculate days since item was created
        const daysSinceCreated = Math.max(1, Math.ceil((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)));
        
        // Utilization rate: percentage of days the item was booked since creation
        const utilizationRate = (bookingStats.totalDays / daysSinceCreated) * 100;
        
        // Revenue per day of ownership
        const revenuePerOwnedDay = totalRevenue / daysSinceCreated;
        
        // Find last booking date
        const lastBooked = itemBookings.length > 0 
          ? itemBookings.reduce((latest, bi) => {
              const bookingDate = new Date(bi.bookings.hire_start_date);
              return bookingDate > new Date(latest) ? bi.bookings.hire_start_date : latest;
            }, itemBookings[0].bookings.hire_start_date)
          : null;

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          price_per_day: item.price_per_day,
          total_quantity: item.total_quantity,
          created_at: item.created_at,
          total_revenue: totalRevenue,
          total_bookings: totalBookings,
          total_days_booked: bookingStats.totalDays,
          average_booking_duration: averageBookingDuration,
          utilization_rate: Math.min(100, utilizationRate),
          revenue_per_owned_day: revenuePerOwnedDay,
          last_booked: lastBooked
        };
      }) || [];

      setAnalytics(itemAnalytics);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch item analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;

  const getUtilizationBadge = (rate: number) => {
    if (rate >= 70) return <Badge variant="default" className="bg-green-500">High ({rate.toFixed(1)}%)</Badge>;
    if (rate >= 30) return <Badge variant="secondary">Medium ({rate.toFixed(1)}%)</Badge>;
    return <Badge variant="outline">Low ({rate.toFixed(1)}%)</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // Calculate summary statistics
  const totalRevenue = analytics.reduce((sum, item) => sum + item.total_revenue, 0);
  const totalBookings = analytics.reduce((sum, item) => sum + item.total_bookings, 0);
  const averageUtilization = analytics.length > 0 
    ? analytics.reduce((sum, item) => sum + item.utilization_rate, 0) / analytics.length 
    : 0;
  const topPerformer = analytics.length > 0 
    ? analytics.reduce((top, item) => item.total_revenue > top.total_revenue ? item : top, analytics[0])
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Item Performance Analysis</h1>
              <p className="text-sm text-muted-foreground">Analyze revenue and utilization metrics for each item</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Utilization</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageUtilization.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{topPerformer?.name || 'N/A'}</div>
              <div className="text-xs text-muted-foreground">
                {topPerformer ? formatCurrency(topPerformer.total_revenue) : ''}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Item Performance Details</CardTitle>
            <CardDescription>Detailed analytics for each inventory item</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Total Bookings</TableHead>
                    <TableHead className="text-right">Days Booked</TableHead>
                    <TableHead className="text-right">Avg. Duration</TableHead>
                    <TableHead>Utilization Rate</TableHead>
                    <TableHead className="text-right">Revenue/Day Owned</TableHead>
                    <TableHead>Last Booked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics
                    .sort((a, b) => b.total_revenue - a.total_revenue)
                    .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total_revenue)}
                      </TableCell>
                      <TableCell className="text-right">{item.total_bookings}</TableCell>
                      <TableCell className="text-right">{item.total_days_booked}</TableCell>
                      <TableCell className="text-right">
                        {item.average_booking_duration.toFixed(1)} days
                      </TableCell>
                      <TableCell>{getUtilizationBadge(item.utilization_rate)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.revenue_per_owned_day)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.last_booked)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {analytics.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No analytics data available yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Analytics will appear once items have been booked.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}