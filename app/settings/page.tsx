'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Building2, Save, Check, Loader2, AlertCircle, Key, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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
    const key = localStorage.getItem('whatsinvoice_llm_key') || '';
    setApiKey(key);
    fetchBusinessProfile();
  }, []);

  async function fetchBusinessProfile() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/business');
      const data = await res.json();
      if (res.ok && data.success && data.business) {
        setFormData({
          business_name: data.business.business_name || '',
          business_type: data.business.business_type || 'Retail Store / Shop',
          phone: data.business.phone || '',
          email: data.business.email || '',
          gstin: data.business.gstin || '',
          address: data.business.address || '',
          city: data.business.city || '',
          state: data.business.state || '',
          pincode: data.business.pincode || '',
          logo_url: data.business.logo_url || '',
        });
      }
    } catch (err: any) {
      console.warn('Failed to load business profile:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors.length > 0) setErrors([]);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrors([]);

    // Save local API key override
    if (apiKey.trim()) {
      localStorage.setItem('whatsinvoice_llm_key', apiKey.trim());
    } else {
      localStorage.removeItem('whatsinvoice_llm_key');
    }

    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errList = Array.isArray(data.details) ? data.details : [data.error || 'Failed to update business profile'];
        setErrors(errList);
        setIsSaving(false);
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrors([err.message || 'Error updating settings']);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar
        user={null}
        onOpenAuth={() => {}}
        onOpenApiKey={() => {}}
        onSignOut={() => {}}
        hasCustomApiKey={!!apiKey}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Settings & Business Profile
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your store information, tax identifiers, and extraction preferences
            </p>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Business settings updated successfully!</span>
          </div>
        )}

        {errors.length > 0 && (
          <div className="p-4 rounded-md bg-rose-50 border border-rose-200 space-y-1">
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

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading business profile...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveAll} className="space-y-6">
            {/* Business Profile Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="p-2 rounded bg-blue-50 text-blue-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Business Profile</h2>
                  <p className="text-xs text-slate-500">
                    Your company details printed on generated invoices
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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
                    placeholder="My Company Pvt Ltd"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Type</label>
                  <select
                    name="business_type"
                    value={formData.business_type}
                    onChange={handleChange}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
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
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                <textarea
                  name="address"
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address, shop number, locality"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Pincode"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">Logo URL (Optional)</label>
                <input
                  type="url"
                  name="logo_url"
                  value={formData.logo_url}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* AI API Configuration Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="p-2 rounded bg-amber-50 text-amber-600">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Custom LLM Key (Optional)</h2>
                  <p className="text-xs text-slate-500">
                    Optionally override the server-side extraction key with your own Gemini or OpenAI API key
                  </p>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza... or sk-..."
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Settings…</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save All Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
