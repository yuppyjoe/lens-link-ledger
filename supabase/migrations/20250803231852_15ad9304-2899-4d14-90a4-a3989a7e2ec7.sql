-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'staff', 'customer');

-- Create app_user_roles table for role management
CREATE TABLE public.app_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    id_number TEXT NOT NULL UNIQUE,
    id_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referrals table for tracking customer referrals
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    referee_name TEXT,
    referee_phone TEXT,
    referring_customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory items table
CREATE TABLE public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_per_day DECIMAL(10,2) NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    hire_start_date DATE NOT NULL,
    hire_end_date DATE NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    balance_amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'fully_paid')),
    mpesa_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create booking items table (many-to-many between bookings and inventory items)
CREATE TABLE public.booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    daily_rate DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL
);

-- Create payments table for tracking Mpesa payments
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    mpesa_reference TEXT NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'balance', 'full')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.app_user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'staff' THEN 2
      WHEN 'customer' THEN 3
    END
  LIMIT 1
$$;

-- RLS Policies for app_user_roles
CREATE POLICY "Users can view their own roles" ON public.app_user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.app_user_roles
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.app_user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins and staff can view all profiles" ON public.profiles
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for referrals
CREATE POLICY "Users can view their own referrals" ON public.referrals
    FOR SELECT USING (
        referred_user_id = auth.uid() OR 
        referring_customer_id = auth.uid()
    );

CREATE POLICY "Admins and staff can view all referrals" ON public.referrals
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Users can create referrals" ON public.referrals
    FOR INSERT WITH CHECK (referred_user_id = auth.uid());

-- RLS Policies for inventory_items
CREATE POLICY "Everyone can view inventory items" ON public.inventory_items
    FOR SELECT USING (true);

CREATE POLICY "Admins and staff can manage inventory" ON public.inventory_items
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff')
    );

-- RLS Policies for bookings
CREATE POLICY "Users can view their own bookings" ON public.bookings
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Staff can view bookings they handle" ON public.bookings
    FOR SELECT USING (
        staff_id = auth.uid() OR
        public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Customers can create bookings" ON public.bookings
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff and admins can update bookings" ON public.bookings
    FOR UPDATE USING (
        staff_id = auth.uid() OR 
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'staff')
    );

-- RLS Policies for booking_items
CREATE POLICY "Users can view booking items for their bookings" ON public.booking_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE id = booking_id AND customer_id = auth.uid()
        ) OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Users can manage booking items for their bookings" ON public.booking_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE id = booking_id AND customer_id = auth.uid()
        ) OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'staff')
    );

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their bookings" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE id = booking_id AND customer_id = auth.uid()
        ) OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'staff')
    );

CREATE POLICY "Staff and admins can manage payments" ON public.payments
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'staff')
    );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    -- Create default customer role for new users
    INSERT INTO public.app_user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();