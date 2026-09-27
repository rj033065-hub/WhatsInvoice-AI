'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Building2, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const BUSINESS_TYPES = [
  'Retail Store / Shop',
  'Wholesale & Distribution',
  'Professional Services & Consulting',
  'Freelancer / Agency',
  'Manufacturing & Fabrication',
  'E-commerce & Online Selling',
  'Food & Restaurant',
  'Healthcare & Wellness',
  'Construction & Real Estate',
  'Other Business',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Form Fields
  const [formData, setFormData] = useState({
    business_name: '',
    business_type: 'Retail Store / Shop',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    logo_url: '',
  });

  useEffect(() => {
    checkExistingBusiness();
  }, []);

  async function checkExistingBusiness() {
    setIsChecking(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirectTo=/onboarding');
        return;
      }

      // Check if user already has a business profile
      const res = await fetch('/api/business');
      const data = await res.json();

      if (res.ok && data.hasBusiness && data.business?.business_name) {
        // Skip onboarding if already set up
        router.replace('/dashboard');
        return;
      }

      // Prefill email if available from auth
      if (user.email) {
        setFormData((prev) => ({ ...prev, email: prev.email || user.email || '' }));
      }
    } catch {
      // Allow user to proceed with form
    } finally {
      setIsChecking(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors.length > 0) setErrors([]);
  };

  const validateClientSide = (): boolean => {
    const errs: string[] = [];
    if (!formData.business_name.trim()) {
      errs.push('Business name is required.');
    }
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errs.push('Please enter a valid email address.');
      }
    }
    if (formData.pincode.trim() && !/^\d{4,8}$/.test(formData.pincode.trim())) {
      errs.push('Please enter a valid pincode (4-8 digits).');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateClientSide()) return;

    setIsSubmitting(true);
    setErrors([]);

    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorList = Array.isArray(data.details) ? data.details : [data.error || 'Failed to save business profile'];
        setErrors(errorList);
        setIsSubmitting(false);
        return;
      }

      // Set cookie to prevent redundant middleware redirection
      document.cookie = 'wi_onboarded=1; path=/; max-age=31536000; SameSite=Lax';

      // Save local backup profile
      localStorage.setItem('wi_profile', JSON.stringify(data.business));

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrors([err.message || 'An unexpected error occurred while saving your profile.']);
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500 font-medium">Checking business profile status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="mb-6 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-base">WhatsInvoice AI</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Set up your Business Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Fill in your business details. These will appear on all generated invoices and WhatsApp messages.
          </p>
        </div>

        {/* Error Banners */}
        {errors.length > 0 && (
          <div className="mb-6 p-4 rounded-md bg-rose-50 border border-rose-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Please correct the following:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-rose-700 pl-1">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Section 1: Business Identity */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Business Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Business Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="business_name"
                  required
                  value={formData.business_name}
                  onChange={handleChange}
                  placeholder="e.g. Apex Traders Pvt Ltd"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Type</label>
                <select
                  name="business_type"
                  value={formData.business_type}
                  onChange={handleChange}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="billing@company.com"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  GSTIN <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  placeholder="27ABCDE1234F1Z5"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Address & Location
            </h2>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
              <textarea
                name="address"
                rows={2}
                value={formData.address}
                onChange={handleChange}
                placeholder="Shop No. 4, Commercial Complex, MG Road"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Mumbai"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Maharashtra"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="400001"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Branding */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              3. Branding & Logo <span className="font-normal text-slate-400 lowercase">(optional)</span>
            </h2>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Logo URL</label>
              <input
                type="url"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                placeholder="https://example.com/logo.png"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Direct image link to your business logo to appear on printed invoices.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Business Profile…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Setup & Launch Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
