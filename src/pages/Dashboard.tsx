import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigate, useNavigate } from 'react-router-dom';
import { ProfileForm } from '@/components/ProfileForm';

export default function Dashboard() {
  const { user, userRole, profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Camera Gear Hire System</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.full_name || user.email}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{user.email}</p>
              <p className="text-sm text-muted-foreground capitalize">{userRole}</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!profile ? (
          <div className="mb-8">
            <ProfileForm />
          </div>
        ) : null}

        {/* Role-based Dashboard */}
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff Management</CardTitle>
                <CardDescription>Manage staff accounts and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/staff')}>Manage Staff</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>Manage camera gear inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/inventory')}>Manage Inventory</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bookings</CardTitle>
                <CardDescription>View and manage all bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/bookings')}>View Bookings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <CardDescription>Manage customer profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/customers')}>Manage Customers</Button>
              </CardContent>
            </Card>

            {/* Reports only for admin and superadmin */}
            {(userRole === 'admin' || userRole === 'superadmin') && (
              <Card>
                <CardHeader>
                  <CardTitle>Reports</CardTitle>
                  <CardDescription>View business reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => handleNavigation('/reports')}>View Reports</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Track payments and revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/payments')}>View Payments</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Item Analysis</CardTitle>
                <CardDescription>Analyze item performance and revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/item-analysis')}>View Analytics</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {userRole === 'staff' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>My Bookings</CardTitle>
                <CardDescription>Manage bookings assigned to you</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/my-bookings')}>View My Bookings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>View available equipment</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/inventory')}>View Inventory</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <CardDescription>Assist customers with bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/customers')}>Manage Customers</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Process payments</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/payments')}>Process Payments</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {userRole === 'customer' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Browse Equipment</CardTitle>
                <CardDescription>View available camera gear</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/equipment')}>Browse Equipment</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Bookings</CardTitle>
                <CardDescription>View your booking history</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/my-bookings')}>View My Bookings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>New Booking</CardTitle>
                <CardDescription>Create a new equipment booking</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/new-booking')}>New Booking</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>View your payment history</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleNavigation('/payment-history')}>View Payments</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}