import { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  X,
  Check,
  Loader2,
  AlertCircle,
  FileText,
  Download,
  Zap,
  Calendar,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Crown,
  Sparkles,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  current?: boolean;
}

type BillingSection = 'main' | 'payment-methods' | 'invoices' | 'change-plan';

const BillingTab = () => {
  const { user } = useAuth();
  const [section, setSection] = useState<BillingSection>('main');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  
  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [isSavingCard, setIsSavingCard] = useState(false);

  // Current subscription info
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [nextBillingDate, setNextBillingDate] = useState<string>('');

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'month',
      features: [
        '50 messages/month',
        '10 minutes calls',
        'Basic AI responses',
        'Email support'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29,
      interval: 'month',
      popular: true,
      features: [
        'Unlimited messages',
        '500 minutes calls',
        'Advanced AI with sentiment',
        'Priority inbox',
        'Custom rules engine',
        'Priority support'
      ]
    },
    {
      id: 'business',
      name: 'Business',
      price: 99,
      interval: 'month',
      features: [
        'Everything in Pro',
        'Unlimited call minutes',
        'Multiple phone numbers',
        'Team accounts',
        'API access',
        'Dedicated support',
        'Custom integrations'
      ]
    }
  ];

  // Load billing data
  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      // Mock data - replace with real API calls
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock payment methods
      setPaymentMethods([
        {
          id: 'pm_1',
          type: 'card',
          brand: 'Visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
          isDefault: true
        }
      ]);

      // Mock invoices
      setInvoices([
        {
          id: 'inv_1',
          number: 'INV-2024-001',
          date: 'Jan 1, 2024',
          amount: 29.00,
          status: 'paid'
        },
        {
          id: 'inv_2',
          number: 'INV-2024-002',
          date: 'Feb 1, 2024',
          amount: 29.00,
          status: 'paid'
        },
        {
          id: 'inv_3',
          number: 'INV-2024-003',
          date: 'Mar 1, 2024',
          amount: 29.00,
          status: 'pending'
        }
      ]);

      // Set current plan
      setCurrentPlan(plans[1]); // Pro plan
      setNextBillingDate('April 1, 2024');
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!cardNumber || !expiry || !cvc || !cardName) {
      toast.error('Please fill in all card details');
      return;
    }

    setIsSavingCard(true);
    try {
      // In production, use Stripe Elements or Stripe.js
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newCard: PaymentMethod = {
        id: `pm_${Date.now()}`,
        type: 'card',
        brand: cardNumber.startsWith('4') ? 'Visa' : 'Mastercard',
        last4: cardNumber.slice(-4),
        expMonth: parseInt(expiry.split('/')[0]),
        expYear: parseInt('20' + expiry.split('/')[1]),
        isDefault: paymentMethods.length === 0
      };
      
      setPaymentMethods([...paymentMethods, newCard]);
      setShowAddCard(false);
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setCardName('');
      toast.success('Card added successfully');
    } catch (error) {
      toast.error('Failed to add card');
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setPaymentMethods(paymentMethods.map(pm => ({
      ...pm,
      isDefault: pm.id === id
    })));
    toast.success('Default payment method updated');
  };

  const handleRemoveCard = async (id: string) => {
    setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    toast.success('Card removed');
  };

  const handleChangePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan || plan.id === currentPlan?.id) return;

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentPlan(plan);
      setSection('main');
      toast.success(`Switched to ${plan.name} plan`);
    } catch (error) {
      toast.error('Failed to change plan');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  if (isLoading && section === 'main') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Sub-sections
  if (section !== 'main') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSection('main')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        {section === 'payment-methods' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-800">Payment Methods</h2>
              <Button 
                size="sm" 
                className="gap-1.5 h-7 text-xs bg-indigo-500 hover:bg-indigo-600"
                onClick={() => setShowAddCard(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Add Card
              </Button>
            </div>

            {/* Add Card Form */}
            {showAddCard && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Add New Card</span>
                  <button onClick={() => setShowAddCard(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500">Name on Card</label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-gray-500">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="4242 4242 4242 4242"
                    maxLength={19}
                    className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Expiry</label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">CVC</label>
                    <input
                      type="text"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      maxLength={4}
                      className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-8 text-xs border-gray-200"
                    onClick={() => setShowAddCard(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600"
                    onClick={handleAddCard}
                    disabled={isSavingCard}
                  >
                    {isSavingCard ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Card'}
                  </Button>
                </div>
              </div>
            )}

            {/* Existing Cards */}
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No payment methods added yet
              </div>
            ) : (
              <div className="space-y-2">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800">
                          {pm.brand} •••• {pm.last4}
                        </span>
                        {pm.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Expires {pm.expMonth}/{pm.expYear}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!pm.isDefault && (
                        <button
                          onClick={() => handleSetDefault(pm.id)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Set as default"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveCard(pm.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'invoices' && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Billing History</h2>
            
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No invoices yet
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800">{invoice.number}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded",
                          invoice.status === 'paid' ? "bg-green-100 text-green-700" :
                          invoice.status === 'pending' ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{invoice.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">${invoice.amount.toFixed(2)}</span>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'change-plan' && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Change Plan</h2>
            
            <div className="space-y-3">
              {plans.map((plan) => (
                <div 
                  key={plan.id}
                  className={cn(
                    "relative p-4 bg-white border rounded-lg transition-all",
                    plan.id === currentPlan?.id 
                      ? "border-indigo-500 ring-1 ring-indigo-500" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-2 right-3 px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-medium rounded">
                      Popular
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {plan.id === 'pro' && <Sparkles className="w-4 h-4 text-indigo-500" />}
                        {plan.id === 'business' && <Crown className="w-4 h-4 text-amber-500" />}
                        <h3 className="text-sm font-medium text-gray-800">{plan.name}</h3>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                        <span className="text-xs text-gray-500">/{plan.interval}</span>
                      </div>
                    </div>
                    
                    {plan.id === currentPlan?.id ? (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                        Current Plan
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={plan.price > (currentPlan?.price || 0) ? "default" : "outline"}
                        className={cn(
                          "h-7 text-xs",
                          plan.price > (currentPlan?.price || 0) 
                            ? "bg-indigo-500 hover:bg-indigo-600" 
                            : "border-gray-200"
                        )}
                        onClick={() => handleChangePlan(plan.id)}
                        disabled={isLoading}
                      >
                        {plan.price > (currentPlan?.price || 0) ? 'Upgrade' : 'Downgrade'}
                      </Button>
                    )}
                  </div>
                  
                  <ul className="space-y-1.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main billing overview
  return (
    <div className="space-y-4">
      {/* Current Plan Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/70">Current Plan</p>
            <div className="flex items-center gap-2 mt-1">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg font-semibold">{currentPlan?.name || 'Free'}</h3>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">${currentPlan?.price || 0}</p>
            <p className="text-xs text-white/70">/month</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <Calendar className="w-3.5 h-3.5" />
            <span>Next billing: {nextBillingDate}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <button
          onClick={() => setSection('change-plan')}
          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-gray-800">Change Plan</p>
              <p className="text-xs text-gray-500">Upgrade or downgrade</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        <button
          onClick={() => setSection('payment-methods')}
          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-gray-800">Payment Methods</p>
              <p className="text-xs text-gray-500">
                {paymentMethods.length > 0 
                  ? `${paymentMethods.length} card${paymentMethods.length > 1 ? 's' : ''} on file`
                  : 'Add a payment method'
                }
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        <button
          onClick={() => setSection('invoices')}
          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-gray-800">Billing History</p>
              <p className="text-xs text-gray-500">{invoices.length} invoices</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Usage Stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-xs font-medium text-gray-800 mb-3">Current Usage</h3>
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Messages</span>
              <span className="text-gray-800 font-medium">1,234 / Unlimited</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Call Minutes</span>
              <span className="text-gray-800 font-medium">342 / 500</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '68%' }} />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">AI Responses</span>
              <span className="text-gray-800 font-medium">567 / Unlimited</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Subscription */}
      <button className="w-full text-center text-xs text-gray-500 hover:text-red-600 transition-colors py-2">
        Cancel subscription
      </button>
    </div>
  );
};

export default BillingTab;
