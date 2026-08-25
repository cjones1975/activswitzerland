import Stripe from 'stripe';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import User from '../models/User.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_PRICE_IDS = {
    monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ID_YEARLY,
};

// @desc    Create a Stripe Checkout Session for the AI chat subscription
// @route   POST /api/v1/billing/checkout
// @access  Private
export const createCheckoutSession = asyncHandler(async (req, res, next) => {
    const priceId = PLAN_PRICE_IDS[req.body.plan];
    if (!priceId) {
        return next(new ErrorResponse('Invalid plan', 400));
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: req.user.email,
        client_reference_id: req.user.id,
        metadata: { userId: req.user.id },
        success_url: `${process.env.FRONTEND_URL}/profile?checkout=success`,
        cancel_url: `${process.env.FRONTEND_URL}/profile?checkout=cancel`,
    });

    res.status(200).json({ success: true, data: { url: session.url } });
});

// @desc    Create a Stripe Customer Portal session for managing/cancelling the subscription
// @route   POST /api/v1/billing/portal
// @access  Private
export const createPortalSession = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+stripeCustomerId');
    if (!user.stripeCustomerId) {
        return next(new ErrorResponse('No subscription to manage', 400));
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL}/profile`,
    });

    res.status(200).json({ success: true, data: { url: session.url } });
});

// @desc    Stripe webhook — keeps isPro/stripeCustomerId/stripeSubscriptionId in sync with
//          the actual subscription state. Mounted with express.raw ahead of the global
//          express.json() (see server.js) — signature verification needs the raw body.
// @route   POST /api/v1/billing/webhook
// @access  Public (verified by Stripe signature instead of auth)
export const handleWebhook = asyncHandler(async (req, res) => {
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const userId = session.metadata?.userId || session.client_reference_id;
            if (userId) {
                await User.findByIdAndUpdate(userId, {
                    isPro: true,
                    stripeCustomerId: session.customer,
                    stripeSubscriptionId: session.subscription,
                });
            }
            break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const isActive = ['active', 'trialing'].includes(subscription.status);
            await User.findOneAndUpdate({ stripeSubscriptionId: subscription.id }, { isPro: isActive });
            break;
        }
    }

    res.status(200).json({ received: true });
});
