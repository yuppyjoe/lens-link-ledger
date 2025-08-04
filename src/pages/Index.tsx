import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Professional Camera Gear <span className="text-primary">Hire</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Rent high-quality camera equipment for your photography and videography projects. 
            Professional gear, competitive rates, expert support.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="/auth">Get Started</a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="/auth">Sign In</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Our Service?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Professional Equipment</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Access to the latest cameras, lenses, lighting, and accessories 
                  from top brands like Canon, Sony, Nikon, and more.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Flexible Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Easy online booking system with flexible rental periods. 
                  Pay just 50% deposit to secure your gear.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expert Support</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Our experienced team provides guidance on equipment selection 
                  and technical support throughout your rental period.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Register</h3>
              <p className="text-muted-foreground">Create your account and complete verification</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Browse & Book</h3>
              <p className="text-muted-foreground">Select your equipment and choose rental dates</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Pay Deposit</h3>
              <p className="text-muted-foreground">Secure your booking with 50% deposit via M-Pesa</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold mb-2">Collect & Create</h3>
              <p className="text-muted-foreground">Pick up your gear and start creating amazing content</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Creating?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of photographers and videographers who trust us with their projects
          </p>
          <Button size="lg" variant="secondary" asChild>
            <a href="/auth">Sign Up Now</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-muted">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">
            © 2024 Camera Gear Hire. Professional equipment rental made simple.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
