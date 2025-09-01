import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { DollarSign, Users, Package, Calendar } from 'lucide-react';

interface ReportData {
  totalRevenue: number;
  totalBookings: number;
  totalCustomers: number;
  totalItems: number;
  monthlyRevenue: { month: string; revenue: number }[];
  topItems: { name: string; bookings: number }[];
  recentBookings: any[];
  staffList: { name: string; role: string; phone: string }[];
}

export default function Reports() {
  const { user, userRole } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  if (!user || (userRole !== 'admin' && userRole !== 'superadmin')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      // Fetch total revenue
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('total_cost, created_at, payment_status');

      if (bookingsError) throw bookingsError;

      const totalRevenue = bookings?.reduce((sum, booking) => 
        booking.payment_status === 'paid' ? sum + Number(booking.total_cost) : sum, 0) || 0;

      // Fetch customer count
      const { count: customerCount, error: customerError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (customerError) throw customerError;

      // Fetch inventory count
      const { count: itemCount, error: itemError } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true });

      if (itemError) throw itemError;

      // Calculate monthly revenue for the last 6 months
      const monthlyData = bookings?.reduce((acc: { [key: string]: number }, booking) => {
        if (booking.payment_status === 'paid') {
          const month = new Date(booking.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
          acc[month] = (acc[month] || 0) + Number(booking.total_cost);
        }
        return acc;
      }, {}) || {};

      const monthlyRevenue = Object.entries(monthlyData).map(([month, revenue]) => ({ month, revenue }));

      // Fetch booking items to find top equipment
      const { data: bookingItems, error: itemsError } = await supabase
        .from('booking_items')
        .select(`
          quantity,
          inventory_items(name)
        `);

      if (itemsError) throw itemsError;

      const itemStats: { [key: string]: number } = {};
      bookingItems?.forEach(item => {
        const name = item.inventory_items?.name || 'Unknown';
        itemStats[name] = (itemStats[name] || 0) + item.quantity;
      });

      const topItems = Object.entries(itemStats)
        .map(([name, bookings]) => ({ name, bookings }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5);

      // Fetch staff list for admin and superadmin
      const { data: staffRoles, error: staffError } = await supabase
        .from('app_user_roles')
        .select('user_id, role')
        .in('role', ['staff', 'admin', 'superadmin']);

      if (staffError) throw staffError;

      const staffList = await Promise.all(
        (staffRoles || []).map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('user_id', role.user_id)
            .single();

          return {
            name: profile?.full_name || 'No name',
            role: role.role,
            phone: profile?.phone_number || 'No phone'
          };
        })
      );

      setReportData({
        totalRevenue,
        totalBookings: bookings?.length || 0,
        totalCustomers: customerCount || 0,
        totalItems: itemCount || 0,
        monthlyRevenue,
        topItems,
        recentBookings: bookings?.slice(0, 5) || [],
        staffList
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!reportData) {
    return <div className="flex justify-center items-center min-h-screen">No data available</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Business Reports</h1>
          <p className="text-sm text-muted-foreground">View business performance and analytics</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${reportData.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From paid bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalBookings}</div>
              <p className="text-xs text-muted-foreground">All time bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Registered customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipment Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalItems}</div>
              <p className="text-xs text-muted-foreground">In inventory</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>Revenue from paid bookings by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.monthlyRevenue.map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <span className="font-medium">{month.month}</span>
                  <span className="text-2xl font-bold">${month.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Equipment */}
        <Card>
          <CardHeader>
            <CardTitle>Most Popular Equipment</CardTitle>
            <CardDescription>Equipment with the most bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.topItems.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm bg-muted rounded-full px-2 py-1">
                      #{index + 1}
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="text-lg font-bold">{item.bookings} bookings</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Average Booking Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${reportData.totalBookings > 0 ? (reportData.totalRevenue / reportData.totalBookings).toFixed(2) : '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue per Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${reportData.totalCustomers > 0 ? (reportData.totalRevenue / reportData.totalCustomers).toFixed(2) : '0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>All Staff</CardTitle>
            <CardDescription>List of all staff members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.staffList.map((staff, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{staff.name}</p>
                    <p className="text-sm text-muted-foreground">{staff.phone}</p>
                  </div>
                  <span className="px-2 py-1 bg-muted rounded-full text-sm capitalize">
                    {staff.role}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}