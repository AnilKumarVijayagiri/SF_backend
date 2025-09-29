// const express = require('express');
// const fetch = require('node-fetch');
// const crypto = require('crypto');
// const app = express();
// app.use(express.json());

// app.post('/create_order', async (req,res)=>{
//   const { amount } = req.body;
//   const response = await fetch('https://api.razorpay.com/v1/orders', {
//     method:'POST',
//     headers:{'Content-Type':'application/json', 'Authorization':'Basic ' + Buffer.from('rzp_test_RL9XyzhjRRghGr:8S2nF3t718Yxsi7U4De6GEkI').toString('base64')},
//     body: JSON.stringify({ amount: amount*100, currency:"INR", receipt:"qwsaq1", partial_payment:true, first_payment_min_amount: amount*100 })
//   });
//   const data = await response.json();
//   res.json(data);
// });

// app.post('/verify_payment', (req,res)=>{
//   const { order_id, payment_id, signature } = req.body;
//   const generated_signature = crypto.createHmac('sha256','8S2nF3t718Yxsi7U4De6GEkI').update(order_id + "|" + payment_id).digest('hex');
//   res.json({ valid: generated_signature===signature });
// });
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const cors = require('cors');



const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: [
        'https://sf-lyart.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true
}));

// Validate environment variables
const REQUIRED_ENV_VARS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
REQUIRED_ENV_VARS.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not set in environment variables`);
    process.exit(1);
  }
});

// Create Razorpay Order
app.post('/create_order', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount provided' });
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to paise and ensure integer
        currency: "INR",
        receipt: `rcpt_${Date.now()}`, // Unique receipt ID
        partial_payment: true,
        first_payment_min_amount: Math.round(amount * 100)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Razorpay API Error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to create order',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Razorpay Payment Signature
app.post('/verify_payment', (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['order_id', 'payment_id', 'signature']
      });
    }

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest('hex');

    const isValid = generated_signature === signature;

    if (!isValid) {
      console.warn('Invalid payment signature detected:', {
        order_id,
        payment_id,
        receivedSignature: signature,
        generatedSignature: generated_signature
      });
    }

    res.json({ 
      valid: isValid,
      order_id: order_id,
      payment_id: payment_id
    });
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment signature' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

