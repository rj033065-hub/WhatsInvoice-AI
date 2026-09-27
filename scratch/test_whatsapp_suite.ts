import {
  generateWhatsAppShareUrl,
  formatWhatsAppInvoiceMessage,
  cleanWhatsAppPhone,
} from '../lib/whatsapp';
import { Invoice } from '../lib/types/invoice';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

function runWhatsAppTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING WHATSAPP WA.ME URL GENERATOR TESTS');
  console.log('======================================================\n');

  const baseInvoice: Invoice = {
    invoice_number: 'INV-202609-8492',
    customer_name: 'Rahul Sharma',
    customer_phone: '9876543210',
    subtotal: 1000,
    discount: 0,
    gst_rate: 18,
    gst_amount: 180,
    total: 1180,
    status: 'pending',
    items: [{ product_name: 'Shoes', quantity: 1, unit_price: 1000, amount: 1000 }],
  };

  // Test 1: Phone cleaning
  console.log('--- TEST 1: Phone Cleaning ---');
  {
    assert(cleanWhatsAppPhone('9876543210') === '919876543210', '10-digit number is prepended with 91');
    assert(cleanWhatsAppPhone('+91 98765 43210') === '919876543210', 'Formatted +91 number is cleaned properly');
    assert(cleanWhatsAppPhone('+1 (555) 123-4567') === '15551234567', 'International number keeps digits only');
    assert(cleanWhatsAppPhone('') === '', 'Empty phone returns empty string');
    assert(cleanWhatsAppPhone(null) === '', 'Null phone returns empty string');
  }

  // Test 2: Message Content
  console.log('\n--- TEST 2: Message Content ---');
  {
    const msg = formatWhatsAppInvoiceMessage({
      invoice: baseInvoice,
      businessName: 'Sharma Electronics',
    });

    assert(msg.includes('Sharma Electronics'), 'Includes business name');
    assert(msg.includes('INV-202609-8492'), 'Includes invoice number');
    assert(msg.includes('Rahul Sharma'), 'Includes customer name');
    assert(msg.includes('1180.00'), 'Includes total amount');
    assert(msg.includes('printed copy or tax invoice breakdown'), 'Includes short instruction to view/print');
    assert(!msg.includes('http://'), 'No insecure public URLs included');
    assert(!msg.includes('.pdf'), 'No false PDF auto-attachment claims');
  }

  // Test 3: URL Generation with Customer Phone
  console.log('\n--- TEST 3: URL with Phone ---');
  {
    const url = generateWhatsAppShareUrl({
      invoice: baseInvoice,
      businessName: 'Sharma Electronics',
    });

    assert(url.startsWith('https://wa.me/919876543210?text='), 'Generates https://wa.me/<phone>?text= format');
    const params = new URL(url).searchParams;
    const textParam = params.get('text');
    assert(textParam !== null && textParam.includes('INV-202609-8492'), 'Text parameter is properly encoded');
  }

  // Test 4: URL Generation without Phone
  console.log('\n--- TEST 4: URL without Phone ---');
  {
    const noPhoneInvoice = { ...baseInvoice, customer_phone: null };
    const url = generateWhatsAppShareUrl({
      invoice: noPhoneInvoice,
      businessName: 'Sharma Electronics',
    });

    assert(url.startsWith('https://wa.me/?text='), 'Generates https://wa.me/?text= format when phone is absent');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL WHATSAPP URL UNIT TESTS PASSED!');
  console.log('======================================================\n');
}

runWhatsAppTests();
