import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Phone, Banknote, Loader2 } from 'lucide-react';

interface DepositPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    deposit_amount: number;
    balance_amount: number;
    payment_status: string;
    profiles?: {
      full_name: string;
      phone_number: string;
    };
  };
  onPaymentComplete: () => void;
}

export default function DepositPaymentDialog({ 
  open, 
  onOpenChange, 
  booking, 
  onPaymentComplete 
}: DepositPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState(booking.profiles?.phone_number || '');
  const [cashAmount, setCashAmount] = useState(booking.deposit_amount.toString());
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleMpesaPayment = async () => {
    if (!phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number for M-Pesa payment",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Call M-Pesa STK Push
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone_number: phoneNumber,
          amount: booking.deposit_amount,
          account_reference: `DEP-${booking.id.slice(0, 8)}`,
          transaction_desc: `Deposit payment for booking ${booking.id.slice(0, 8)}`
        }
      });

      if (error) throw error;

      if (data.success) {
        // Record the payment attempt
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            booking_id: booking.id,
            amount: booking.deposit_amount,
            payment_type: 'deposit',
            mpesa_reference: data.data.CheckoutRequestID || 'PENDING',
            status: 'pending'
          });

        if (paymentError) throw paymentError;

        // Update booking with M-Pesa reference
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ 
            mpesa_reference: data.data.CheckoutRequestID,
            payment_status: 'partial'
          })
          .eq('id', booking.id);

        if (bookingError) throw bookingError;

        toast({
          title: "STK Push Sent",
          description: "Please check your phone and enter your M-Pesa PIN to complete the payment",
        });

        onPaymentComplete();
        onOpenChange(false);
      } else {
        throw new Error(data.message || 'M-Pesa payment failed');
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate M-Pesa payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCashPayment = async () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid cash amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > booking.deposit_amount) {
      toast({
        title: "Amount Too High",
        description: `Cash amount cannot exceed deposit amount of KES ${booking.deposit_amount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Record the cash payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          amount: amount,
          payment_type: 'deposit',
          mpesa_reference: `CASH-${Date.now()}`,
          status: 'completed'
        });

      if (paymentError) throw paymentError;

      // Update booking payment status
      const newPaymentStatus = amount >= booking.deposit_amount ? 'partial' : 'unpaid';
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          payment_status: newPaymentStatus
        })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      toast({
        title: "Cash Payment Recorded",
        description: `Successfully recorded cash payment of KES ${amount.toLocaleString()}`,
      });

      onPaymentComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to record cash payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'mpesa') {
      handleMpesaPayment();
    } else {
      handleCashPayment();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Deposit Payment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Booking Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Booking ID:</span>
                <span className="font-mono">#{booking.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span>Deposit Amount:</span>
                <span className="font-medium">KES {booking.deposit_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Status:</span>
                <span className="capitalize">{booking.payment_status}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <div>
            <Label className="text-base font-medium">Payment Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as 'mpesa' | 'cash')}
              className="mt-2"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="mpesa" id="mpesa" />
                <Label htmlFor="mpesa" className="flex items-center gap-2 flex-1 cursor-pointer">
                  <Phone className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="font-medium">M-Pesa Payment</div>
                    <div className="text-sm text-muted-foreground">Pay via M-Pesa STK Push</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex items-center gap-2 flex-1 cursor-pointer">
                  <Banknote className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="font-medium">Cash Payment</div>
                    <div className="text-sm text-muted-foreground">Manual cash entry</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Payment Details */}
          {paymentMethod === 'mpesa' ? (
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Enter phone number to receive STK push
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="amount">Cash Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={booking.deposit_amount}
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                required
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum: KES {booking.deposit_amount.toLocaleString()}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {paymentMethod === 'mpesa' ? 'Send STK Push' : 'Record Payment'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}