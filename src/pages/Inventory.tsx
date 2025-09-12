import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  price_per_day: number;
  total_quantity: number;
  available_quantity: number;
  image_url?: string;
  category: string;
  created_at: string;
}

export default function Inventory() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_per_day: '',
    total_quantity: '',
    available_quantity: '',
    image_url: '',
    category: 'Camera Accessories'
  });

  // Show loading while auth is being checked
  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // Authorization is handled by ProtectedRoute in App.tsx

  useEffect(() => {
    // Only fetch inventory if user is authenticated and authorized
    if (user && (userRole === 'admin' || userRole === 'staff')) {
      fetchInventory();
    }
  }, [user, userRole]);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price_per_day: '',
      total_quantity: '',
      available_quantity: '',
      image_url: '',
      category: 'Camera Accessories'
    });
    setEditingItem(null);
  };

  const openEditDialog = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      price_per_day: item.price_per_day.toString(),
      total_quantity: item.total_quantity.toString(),
      available_quantity: item.available_quantity.toString(),
      image_url: item.image_url || '',
      category: item.category || 'Camera Accessories'
    });
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const itemData = {
        name: formData.name,
        description: formData.description || null,
        price_per_day: parseFloat(formData.price_per_day),
        total_quantity: parseInt(formData.total_quantity),
        available_quantity: parseInt(formData.available_quantity),
        image_url: formData.image_url || null,
        category: formData.category
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast({ title: "Success", description: "Item updated successfully" });
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert([itemData]);

        if (error) throw error;
        toast({ title: "Success", description: "Item added successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchInventory();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive",
      });
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Item deleted successfully" });
      fetchInventory();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
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
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-sm text-muted-foreground">Manage camera equipment inventory</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/item-analysis')}>
              View Analytics
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
                <DialogDescription>
                  {editingItem ? 'Update item details' : 'Add a new item to the inventory'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="Camera Accessories">Camera Accessories</option>
                    <option value="Camera">Camera</option>
                    <option value="Bags & Cases">Bags & Cases</option>
                    <option value="Batteries & Power Accessories">Batteries & Power Accessories</option>
                    <option value="Cables">Cables</option>
                    <option value="Transmitters">Transmitters</option>
                    <option value="Cameras">Cameras</option>
                    <option value="Lighting & Studio">Lighting & Studio</option>
                    <option value="Audio">Audio</option>
                    <option value="Storage & Card Accessories">Storage & Card Accessories</option>
                    <option value="Tripods & Support">Tripods & Support</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Portable Speakers & Electronics">Portable Speakers & Electronics</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="price">Price per Day (KES)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price_per_day}
                    onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="total">Total Quantity</Label>
                  <Input
                    id="total"
                    type="number"
                    value={formData.total_quantity}
                    onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="available">Available Quantity</Label>
                  <Input
                    id="available"
                    type="number"
                    value={formData.available_quantity}
                    onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="image">Image URL</Label>
                  <Input
                    id="image"
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingItem ? 'Update Item' : 'Add Item'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Equipment Inventory</CardTitle>
            <CardDescription>Manage your camera gear and equipment</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price/Day (KES)</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                    <TableCell>KES {item.price_per_day.toLocaleString()}</TableCell>
                    <TableCell>{item.available_quantity}</TableCell>
                    <TableCell>{item.total_quantity}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {userRole === 'admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}