
    const r = await fetch('/api/public-key');
    const j = await r.json();
    RAZORPAY_KEY_ID = j.key || null;
  } catch {}
}
getPublicKey();

const datesContainer = document.getElementById('datesContainer');
const addDateBtn = document.getElementById('addDate');
const pkg = document.getElementById('package');
const adv = document.getElementById('advance');
const total = document.getElementById('total');
const msg = document.getElementById('msg');

let payNowAmount = 0;
const EXTRA_DATE_FEE = 1000;

// Add another date
addDateBtn.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'grid grid-2 mt';
  row.innerHTML = `<input type="date" class="eventDate" required>
                   <input type="text" class="eventName" placeholder="Event (e.g. Reception)" required>`;
  datesContainer.appendChild(row);
  calc();
});

// Calculate total
function calc() {
  const count = document.querySelectorAll('#datesContainer .eventDate').length;
  const base = parseFloat(pkg.value || 0);
  const advP = parseFloat(adv.value || 0);
  if (base > 0) {
    const gross = base + Math.max(0, count - 1) * EXTRA_DATE_FEE;
    const payNow = advP ? Math.round(gross * advP / 100) : 0;
    total.value = advP ? `₹${gross} | Pay now: ₹${payNow}` : `₹${gross}`;
    payNowAmount = Number(payNow || gross);
  } else total.value = '';
}

pkg.addEventListener('change', calc);
adv.addEventListener('change', calc);
datesContainer.addEventListener('input', calc);

// Collect booking data
function collectBookingData() {
  const events = [];
  document.querySelectorAll('#datesContainer .grid.grid-2').forEach(row => {
    const date = row.querySelector('.eventDate')?.value || '';
    const name = row.querySelector('.eventName')?.value || '';
    if (date && name) events.push({ date, name });
  });
  return {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    package: pkg.options[pkg.selectedIndex]?.text || '',
    packageAmount: parseFloat(pkg.value || 0),
    advance: parseFloat(adv.value || 0),
    events,
    totalGross: total.value
  };
}

// Submit booking form
document.getElementById('bookingForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  msg.textContent = 'Creating order...';

  // Ensure public key loaded
  if (!RAZORPAY_KEY_ID) {
    msg.textContent = 'Payment system not ready, please wait a moment.';
    return;
  }

  // Ensure payNowAmount valid
  if (isNaN(payNowAmount) || payNowAmount <= 0) {
    msg.textContent = 'Invalid payment amount. Please check package/advance selection.';
    return;
  }

  try {
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: payNowAmount, currency: 'INR' })
    });
    const order = await res.json();
    if (!order.id) {
      msg.textContent = 'Order creation failed';
      return;
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'Mahadev Photography',
      description: 'Wedding Booking Advance',
      order_id: order.id,
      handler: async function(response) {
        try {
          const verifyRes = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, bookingData: collectBookingData(), payNowAmount })
          });
          const result = await verifyRes.json();
          msg.textContent = result.success
            ? 'Payment Successful! Invoice sent to your email.'
            : 'Payment verification failed.';
        } catch (err) {
          msg.textContent = 'Verification error: ' + err.message;
        }
      },
      theme: { color: '#3399cc' }
    };

    // Open Razorpay checkout safely
    if (typeof Razorpay !== 'undefined') {
      new Razorpay(options).open();
    } else {
      msg.textContent = 'Payment script not loaded, please try again.';
    }

  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
});
