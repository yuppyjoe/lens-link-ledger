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
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';

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
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customer_id: '',
    hire_start_date: '',
    hire_end_date: '',
    deposit_amount: '',
    items: [{ item_id: '', quantity: '1' }]
  });

  if (!user || (userRole !== 'admin' && userRole !== 'staff')) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchBookings();
    fetchCustomers();
    fetchInventoryItems();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .order('full_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, price_per_day, available_quantity')
        .order('name');

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

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

  const resetForm = () => {
    setFormData({
      customer_id: '',
      hire_start_date: '',
      hire_end_date: '',
      deposit_amount: '',
      items: [{ item_id: '', quantity: '1' }]
    });
    setEditingBooking(null);
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_id: '', quantity: '1' }]
    });
  };

  const removeItemRow = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateItemRow = (index: number, field: string, value: string) => {
    const newItems = formData.items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    const startDate = new Date(formData.hire_start_date);
    const endDate = new Date(formData.hire_end_date);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return formData.items.reduce((total, item) => {
      const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
      if (inventoryItem) {
        return total + (inventoryItem.price_per_day * parseInt(item.quantity) * days);
      }
      return total;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const totalCost = calculateTotal();
      const depositAmount = parseFloat(formData.deposit_amount);
      const balanceAmount = totalCost - depositAmount;

      const bookingData = {
        customer_id: formData.customer_id,
        hire_start_date: formData.hire_start_date,
        hire_end_date: formData.hire_end_date,
        total_cost: totalCost,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,
        status: 'pending',
        payment_status: 'unpaid'
      };

      let bookingId;
      if (editingBooking) {
        const { error } = await supabase
          .from('bookings')
          .update(bookingData)
          .eq('id', editingBooking.id);

        if (error) throw error;
        bookingId = editingBooking.id;
        toast({ title: "Success", description: "Booking updated successfully" });
      } else {
        const { data, error } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select()
          .single();

        if (error) throw error;
        bookingId = data.id;
        toast({ title: "Success", description: "Booking created successfully" });
      }

      // Handle booking items
      if (!editingBooking) {
        const itemsToInsert = formData.items.map(item => {
          const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
          const days = Math.ceil((new Date(formData.hire_end_date).getTime() - new Date(formData.hire_start_date).getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            booking_id: bookingId,
            item_id: item.item_id,
            quantity: parseInt(item.quantity),
            daily_rate: inventoryItem?.price_per_day || 0,
            total_amount: (inventoryItem?.price_per_day || 0) * parseInt(item.quantity) * days
          };
        });

        const { error: itemsError } = await supabase
          .from('booking_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      setIsDialogOpen(false);
      resetForm();
      fetchBookings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save booking",
        variant: "destructive",
      });
    }
  };

  const deleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Booking deleted successfully" });
      fetchBookings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete booking",
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Bookings Management</h1>
            <p className="text-sm text-muted-foreground">View and manage all equipment bookings</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                New Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBooking ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
                <DialogDescription>
                  {editingBooking ? 'Update booking details' : 'Create a new equipment booking'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer">Customer</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.user_id} value={customer.user_id}>
                            {customer.full_name} - {customer.phone_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="deposit">Deposit Amount</Label>
                    <Input
                      id="deposit"
                      type="number"
                      step="0.01"
                      value={formData.deposit_amount}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.hire_start_date}
                      onChange={(e) => setFormData({ ...formData, hire_start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.hire_end_date}
                      onChange={(e) => setFormData({ ...formData, hire_end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Equipment Items</Label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex gap-2 mt-2">
                      <Select
                        value={item.item_id}
                        onValueChange={(value) => updateItemRow(index, 'item_id', value)}
                        required
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select equipment" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.name} - ${inv.price_per_day}/day
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemRow(index, 'quantity', e.target.value)}
                        className="w-20"
                        required
                      />
                      {formData.items.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removeItemRow(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addItemRow} className="mt-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                {formData.hire_start_date && formData.hire_end_date && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium">Total Cost: ${calculateTotal().toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      Days: {Math.ceil((new Date(formData.hire_end_date).getTime() - new Date(formData.hire_start_date).getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full">
                  {editingBooking ? 'Update Booking' : 'Create Booking'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                customer_id: booking.customer_id,
                                hire_start_date: booking.hire_start_date,
                                hire_end_date: booking.hire_end_date,
                                deposit_amount: booking.deposit_amount.toString(),
                                items: [{ item_id: '', quantity: '1' }]
                              });
                              setEditingBooking(booking);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {userRole === 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteBooking(booking.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
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