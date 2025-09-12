import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Calendar, CreditCard } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  price_per_day: number;
  available_quantity: number;
}

interface BookingItem {
  item_id: string;
  quantity: string;
}

export default function NewBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    pickup_date: '',
    rental_days: '1',
    is_traveling: false,
    late_return_allowance: '0',
    deposit_percentage: '50',
    items: [{ item_id: '', quantity: '1' }] as BookingItem[]
  });

  const preselectedItemId = searchParams.get('item');

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  useEffect(() => {
    if (preselectedItemId && inventoryItems.length > 0) {
      const item = inventoryItems.find(i => i.id === preselectedItemId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          items: [{ item_id: preselectedItemId, quantity: '1' }]
        }));
      }
    }
  }, [preselectedItemId, inventoryItems]);

  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, price_per_day, available_quantity')
        .gt('available_quantity', 0)
        .order('name');

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', quantity: '1' }]
    }));
  };

  const removeItemRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItemRow = (index: number, field: keyof BookingItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateReturnDate = () => {
    if (!formData.pickup_date || !formData.rental_days) return '';
    
    const pickupDate = new Date(formData.pickup_date);
    const rentalDays = parseInt(formData.rental_days);
    const allowanceDays = formData.is_traveling ? parseInt(formData.late_return_allowance) : 0;
    
    const returnDate = new Date(pickupDate);
    returnDate.setDate(pickupDate.getDate() + rentalDays + allowanceDays);
    
    return returnDate.toISOString().split('T')[0];
  };

  const calculateTotal = () => {
    if (!formData.pickup_date || !formData.rental_days) return 0;
    
    const days = parseInt(formData.rental_days);
    
    return formData.items.reduce((total, item) => {
      const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
      if (!inventoryItem) return total;
      return total + (inventoryItem.price_per_day * parseInt(item.quantity || '0') * days);
    }, 0);
  };

  const validateQuantity = (itemId: string, quantity: number): boolean => {
    const inventoryItem = inventoryItems.find(item => item.id === itemId);
    return inventoryItem ? quantity <= inventoryItem.available_quantity : false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate quantities
      for (const item of formData.items) {
        if (!validateQuantity(item.item_id, parseInt(item.quantity))) {
          const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
          throw new Error(`Quantity exceeds available stock for ${inventoryItem?.name}`);
        }
      }

      const totalCost = calculateTotal();
      const depositAmount = (totalCost * parseInt(formData.deposit_percentage)) / 100;
      const balanceAmount = totalCost - depositAmount;
      const days = parseInt(formData.rental_days);
      const returnDate = calculateReturnDate();

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          hire_start_date: formData.pickup_date,
          hire_end_date: returnDate,
          total_cost: totalCost,
          deposit_amount: depositAmount,
          balance_amount: balanceAmount,
          status: 'pending',
          payment_status: 'unpaid'
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create booking items
      const bookingItems = formData.items.map(item => {
        const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
        return {
          booking_id: booking.id,
          item_id: item.item_id,
          quantity: parseInt(item.quantity),
          daily_rate: inventoryItem?.price_per_day || 0,
          total_amount: (inventoryItem?.price_per_day || 0) * parseInt(item.quantity) * days
        };
      });

      const { error: itemsError } = await supabase
        .from('booking_items')
        .insert(bookingItems);

      if (itemsError) throw itemsError;

      // Update inventory quantities
      for (const item of formData.items) {
        const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
        if (inventoryItem) {
          const { error: updateError } = await supabase
            .from('inventory_items')
            .update({ 
              available_quantity: inventoryItem.available_quantity - parseInt(item.quantity)
            })
            .eq('id', item.item_id);

          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Booking Created Successfully!",
        description: `Booking #${booking.id.slice(0, 8)} has been created. Total: KES ${totalCost.toLocaleString()}`,
      });

      navigate('/my-bookings');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = calculateTotal();
  const depositAmount = (totalCost * parseInt(formData.deposit_percentage)) / 100;
  const balanceAmount = totalCost - depositAmount;

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
          <h1 className="text-2xl font-bold">New Booking</h1>
          <p className="text-sm text-muted-foreground">Create a new equipment rental booking</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Rental Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Rental Details
                </CardTitle>
                <CardDescription>Specify pickup date and rental duration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="pickup_date">Pickup Date</Label>
                    <Input
                      id="pickup_date"
                      type="date"
                      value={formData.pickup_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, pickup_date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="rental_days">Number of Days</Label>
                    <Input
                      id="rental_days"
                      type="number"
                      min="1"
                      value={formData.rental_days}
                      onChange={(e) => setFormData(prev => ({ ...prev, rental_days: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Travel Options */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_traveling"
                      checked={formData.is_traveling}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        is_traveling: e.target.checked,
                        late_return_allowance: e.target.checked ? '2' : '0'
                      }))}
                      className="rounded border border-input"
                    />
                    <Label htmlFor="is_traveling" className="text-sm font-medium">
                      Traveling with equipment?
                    </Label>
                  </div>
                  
                  {formData.is_traveling && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="allowance" className="text-sm">Late return allowance (extra days)</Label>
                      <Select
                        value={formData.late_return_allowance}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, late_return_allowance: value }))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 extra day</SelectItem>
                          <SelectItem value="2">2 extra days</SelectItem>
                          <SelectItem value="3">3 extra days</SelectItem>
                          <SelectItem value="5">5 extra days</SelectItem>
                          <SelectItem value="7">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Extra time buffer for travel delays (no additional charge)
                      </p>
                    </div>
                  )}
                </div>

                {/* Calculated Return Date */}
                {formData.pickup_date && formData.rental_days && (
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Pickup Date:</span>
                        <p className="font-medium">{new Date(formData.pickup_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected Return:</span>
                        <p className="font-medium">{calculateReturnDate() ? new Date(calculateReturnDate()).toLocaleDateString() : '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rental Duration:</span>
                        <p className="font-medium">{formData.rental_days} day{parseInt(formData.rental_days) !== 1 ? 's' : ''}</p>
                      </div>
                      {formData.is_traveling && (
                        <div>
                          <span className="text-muted-foreground">Travel Allowance:</span>
                          <p className="font-medium">+{formData.late_return_allowance} day{parseInt(formData.late_return_allowance) !== 1 ? 's' : ''}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Equipment Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Equipment Selection</CardTitle>
                    <CardDescription>Choose the equipment you want to rent</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.items.map((item, index) => {
                  const inventoryItem = inventoryItems.find(inv => inv.id === item.item_id);
                  return (
                    <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
                      <div className="flex-1">
                        <Label>Equipment</Label>
                        <Select
                          value={item.item_id}
                          onValueChange={(value) => updateItemRow(index, 'item_id', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select equipment" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>
                                {inv.name} - KES {inv.price_per_day}/day (Available: {inv.available_quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-32">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          max={inventoryItem?.available_quantity || 1}
                          value={item.quantity}
                          onChange={(e) => updateItemRow(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>

                      {inventoryItem && (
                        <div className="w-32 text-sm text-muted-foreground">
                          KES {(inventoryItem.price_per_day * parseInt(item.quantity || '0')).toLocaleString()}/day
                        </div>
                      )}

                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItemRow(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
                <CardDescription>Review your booking costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="deposit">Deposit Percentage</Label>
                  <Select
                    value={formData.deposit_percentage}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, deposit_percentage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30% Deposit</SelectItem>
                      <SelectItem value="50">50% Deposit</SelectItem>
                      <SelectItem value="100">Full Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {totalCost > 0 && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Total Cost:</span>
                      <span className="font-medium">KES {totalCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deposit ({formData.deposit_percentage}%):</span>
                      <span className="font-medium">KES {depositAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Balance Due:</span>
                      <span className="font-medium">KES {balanceAmount.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                disabled={submitting || totalCost === 0}
                className="min-w-32"
              >
                {submitting ? 'Creating...' : `Create Booking - KES ${totalCost.toLocaleString()}`}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}